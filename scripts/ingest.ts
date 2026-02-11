/**
 * scripts/ingest.ts — Main ingestion orchestrator
 *
 * Coordinates the full pipeline:
 * 1. Crawl needhamma.gov with Firecrawl -> markdown pages
 * 2. Download & extract discovered PDFs -> text
 * 3. Chunk all content by document type (Section 4)
 * 4. Generate embeddings & upsert into Supabase pgvector
 * 5. Log the ingestion run with structured success/failure counts
 *
 * Usage:
 *   npx tsx scripts/ingest.ts                    # Full ingestion
 *   npx tsx scripts/ingest.ts --limit=10         # Crawl 10 pages only
 *   npx tsx scripts/ingest.ts --pdf-only         # Only process PDFs
 *   npx tsx scripts/ingest.ts --url=<url>        # Re-ingest single URL
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { crawlWebsite, CrawlResult } from "./crawl";
import { extractPdfs, PdfExtractionResult } from "./extract-pdf";
import { chunkDocument, Chunk, detectDocumentType } from "./chunk";
import { embedAndStoreChunks } from "./embed";
import { IngestionLogger, StageTimer } from "./logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IngestResult {
  pagesProcessed: number;
  pdfsProcessed: number;
  totalChunks: number;
  totalErrors: number;
  durationMs: number;
}

interface IngestOptions {
  townId?: string;
  limit?: number;
  pdfOnly?: boolean;
  singleUrl?: string;
  triggeredBy?: string;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function ingestCrawledPages(
  pages: CrawlResult[],
  townId: string,
  stage: StageTimer
): Promise<{ chunks: number; errors: number }> {
  const supabase = getSupabaseServiceClient();
  let totalChunks = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      const { data: doc, error: upsertError } = await supabase
        .from("documents")
        .upsert(
          {
            town_id: townId,
            url: page.url,
            title: page.title,
            source_type: "html",
            content_hash: page.contentHash,
            file_size_bytes: page.fileSizeBytes,
            downloaded_at: new Date().toISOString(),
          },
          { onConflict: "town_id,url" }
        )
        .select("id")
        .single();

      if (upsertError || !doc) {
        console.error(`[ingest] Error upserting doc for ${page.url}: ${upsertError?.message}`);
        errors++;
        stage.recordFailure(1, `Upsert failed for ${page.url}: ${upsertError?.message}`);
        continue;
      }

      const chunks = chunkDocument(page.markdown, {
        documentId: doc.id,
        documentUrl: page.url,
        documentTitle: page.title,
      });

      const result = await embedAndStoreChunks(chunks, doc.id, { townId });
      totalChunks += result.chunksEmbedded;
      errors += result.errors;
      stage.recordSuccess();
      if (result.errors > 0) {
        stage.recordFailure(result.errors, `Embedding errors for ${page.url}`);
      }
    } catch (err) {
      console.error(`[ingest] Error processing page ${page.url}:`, err);
      errors++;
      stage.recordFailure(1, `Exception processing ${page.url}`);
    }
  }

  return { chunks: totalChunks, errors };
}

async function ingestPdfs(
  pdfResults: PdfExtractionResult[],
  townId: string,
  stage: StageTimer
): Promise<{ chunks: number; errors: number }> {
  const supabase = getSupabaseServiceClient();
  let totalChunks = 0;
  let errors = 0;

  for (const pdf of pdfResults) {
    try {
      const { data: doc } = await supabase
        .from("documents")
        .select("id")
        .eq("town_id", townId)
        .eq("url", pdf.url)
        .single();

      if (!doc) {
        const { data: newDoc, error: insertError } = await supabase
          .from("documents")
          .insert({
            town_id: townId,
            url: pdf.url,
            title: pdf.title,
            source_type: "pdf",
            content_hash: pdf.contentHash,
            file_size_bytes: pdf.fileSizeBytes,
            downloaded_at: new Date().toISOString(),
            metadata: { page_count: pdf.pageCount, extraction_method: pdf.extractionMethod },
          })
          .select("id")
          .single();

        if (insertError || !newDoc) {
          console.error(`[ingest] Error creating doc for ${pdf.url}: ${insertError?.message}`);
          errors++;
          stage.recordFailure(1, `Insert failed for ${pdf.url}: ${insertError?.message}`);
          continue;
        }

        const chunks = chunkDocument(pdf.text, { documentId: newDoc.id, documentUrl: pdf.url, documentTitle: pdf.title });
        const result = await embedAndStoreChunks(chunks, newDoc.id, { townId });
        totalChunks += result.chunksEmbedded;
        errors += result.errors;
      } else {
        const chunks = chunkDocument(pdf.text, { documentId: doc.id, documentUrl: pdf.url, documentTitle: pdf.title });
        const result = await embedAndStoreChunks(chunks, doc.id, { townId });
        totalChunks += result.chunksEmbedded;
        errors += result.errors;
      }

      stage.recordSuccess();
    } catch (err) {
      console.error(`[ingest] Error processing PDF ${pdf.url}:`, err);
      errors++;
      stage.recordFailure(1, `Exception processing ${pdf.url}`);
    }
  }

  return { chunks: totalChunks, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runIngestion(options: IngestOptions = {}): Promise<IngestResult> {
  const { townId = "needham", limit = 200, pdfOnly = false, singleUrl, triggeredBy = "cli" } = options;

  const logger = new IngestionLogger({ townId, action: "crawl", triggeredBy });

  let pagesProcessed = 0;
  let pdfsProcessed = 0;
  let totalChunks = 0;
  let totalErrors = 0;

  let crawlResults: CrawlResult[] = [];
  let allPdfUrls: string[] = [];

  if (!pdfOnly && !singleUrl) {
    const crawlStage = logger.startStage("Crawl");
    try {
      crawlResults = await crawlWebsite({ townId, limit });
      pagesProcessed = crawlResults.length;
      crawlStage.recordSuccess(crawlResults.length);
      allPdfUrls = Array.from(new Set(crawlResults.flatMap((r) => r.pdfUrls)));
      crawlStage.addDetail("pdf_urls_discovered", allPdfUrls.length);
    } catch (err) {
      crawlStage.recordFailure(1, `Crawl failed: ${err}`);
    }
    logger.addStageResult(crawlStage.finish());
  }

  if (singleUrl) {
    const singleStage = logger.startStage("Single URL Re-ingest");
    try {
      if (singleUrl.endsWith(".pdf")) {
        allPdfUrls = [singleUrl];
        singleStage.recordSuccess();
      } else {
        const Firecrawl = (await import("@mendable/firecrawl-js")).default;
        const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
        const scrapeResult = await firecrawl.scrape(singleUrl, { formats: ["markdown"] });
        if (scrapeResult.markdown) {
          const { createHash } = await import("crypto");
          crawlResults = [{
            url: singleUrl,
            title: (scrapeResult.metadata?.title as string) || "Untitled",
            markdown: scrapeResult.markdown,
            sourceType: "html",
            contentHash: createHash("sha256").update(scrapeResult.markdown).digest("hex"),
            fileSizeBytes: Buffer.byteLength(scrapeResult.markdown, "utf-8"),
            pdfUrls: [],
          }];
          pagesProcessed = 1;
          singleStage.recordSuccess();
        } else {
          singleStage.recordFailure(1, "No markdown returned from scrape");
        }
      }
    } catch (err) {
      singleStage.recordFailure(1, `Single URL re-ingest failed: ${err}`);
    }
    logger.addStageResult(singleStage.finish());
  }

  if (crawlResults.length > 0) {
    const embedPageStage = logger.startStage("Chunk & Embed Pages");
    const pageResult = await ingestCrawledPages(crawlResults, townId, embedPageStage);
    totalChunks += pageResult.chunks;
    totalErrors += pageResult.errors;
    embedPageStage.addDetail("total_chunks", pageResult.chunks);
    logger.addStageResult(embedPageStage.finish());
  }

  if (allPdfUrls.length > 0) {
    const pdfExtractStage = logger.startStage("PDF Extraction");
    let pdfResults: PdfExtractionResult[] = [];
    try {
      pdfResults = await extractPdfs(allPdfUrls, { townId });
      pdfsProcessed = pdfResults.length;
      pdfExtractStage.recordSuccess(pdfResults.length);
      pdfExtractStage.addDetail("pdf_urls_attempted", allPdfUrls.length);
      const skipped = allPdfUrls.length - pdfResults.length;
      if (skipped > 0) pdfExtractStage.recordSkip(skipped, "PDFs failed extraction or were empty");
    } catch (err) {
      pdfExtractStage.recordFailure(allPdfUrls.length, `PDF extraction failed: ${err}`);
    }
    logger.addStageResult(pdfExtractStage.finish());

    if (pdfResults.length > 0) {
      const embedPdfStage = logger.startStage("Chunk & Embed PDFs");
      const pdfChunkResult = await ingestPdfs(pdfResults, townId, embedPdfStage);
      totalChunks += pdfChunkResult.chunks;
      totalErrors += pdfChunkResult.errors;
      embedPdfStage.addDetail("total_chunks", pdfChunkResult.chunks);
      logger.addStageResult(embedPdfStage.finish());
    }
  }

  const summary = await logger.finish({
    pages_processed: pagesProcessed,
    pdfs_processed: pdfsProcessed,
    total_chunks: totalChunks,
    crawl_limit: limit,
    pdf_only: pdfOnly,
    single_url: singleUrl || null,
  });

  return { pagesProcessed, pdfsProcessed, totalChunks, totalErrors: summary.totalErrors, durationMs: summary.totalDurationMs };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "200");
  const pdfOnly = args.includes("--pdf-only");
  const singleUrl = args.find((a) => a.startsWith("--url="))?.split("=").slice(1).join("=");

  (async () => {
    try {
      await runIngestion({ limit, pdfOnly, singleUrl });
    } catch (err) {
      console.error("Ingestion failed:", err);
      process.exit(1);
    }
  })();
}
