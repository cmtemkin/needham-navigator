/**
 * scripts/ingest.ts — Main ingestion orchestrator
 *
 * Coordinates the full pipeline:
 * 1. Crawl needhamma.gov with Firecrawl → markdown pages
 * 2. Download & extract discovered PDFs → text
 * 3. Chunk all content by document type (Section 4)
 * 4. Generate embeddings & upsert into Supabase pgvector
 * 5. Log the ingestion run
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
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function ingestCrawledPages(
  pages: CrawlResult[],
  townId: string
): Promise<{ chunks: number; errors: number }> {
  const supabase = getSupabaseServiceClient();
  let totalChunks = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      // Get or create the document record
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
        continue;
      }

      // Chunk the page content
      const chunks = chunkDocument(page.markdown, {
        documentId: doc.id,
        documentUrl: page.url,
        documentTitle: page.title,
      });

      // Embed and store chunks
      const result = await embedAndStoreChunks(chunks, doc.id, { townId });
      totalChunks += result.chunksEmbedded;
      errors += result.errors;
    } catch (err) {
      console.error(`[ingest] Error processing page ${page.url}:`, err);
      errors++;
    }
  }

  return { chunks: totalChunks, errors };
}

async function ingestPdfs(
  pdfResults: PdfExtractionResult[],
  townId: string
): Promise<{ chunks: number; errors: number }> {
  const supabase = getSupabaseServiceClient();
  let totalChunks = 0;
  let errors = 0;

  for (const pdf of pdfResults) {
    try {
      // Get the document record (should already exist from extractPdfs)
      const { data: doc } = await supabase
        .from("documents")
        .select("id")
        .eq("town_id", townId)
        .eq("url", pdf.url)
        .single();

      if (!doc) {
        // Create if not exists
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
            metadata: {
              page_count: pdf.pageCount,
              extraction_method: pdf.extractionMethod,
            },
          })
          .select("id")
          .single();

        if (insertError || !newDoc) {
          console.error(`[ingest] Error creating doc for ${pdf.url}: ${insertError?.message}`);
          errors++;
          continue;
        }

        const chunks = chunkDocument(pdf.text, {
          documentId: newDoc.id,
          documentUrl: pdf.url,
          documentTitle: pdf.title,
        });

        const result = await embedAndStoreChunks(chunks, newDoc.id, { townId });
        totalChunks += result.chunksEmbedded;
        errors += result.errors;
      } else {
        const chunks = chunkDocument(pdf.text, {
          documentId: doc.id,
          documentUrl: pdf.url,
          documentTitle: pdf.title,
        });

        const result = await embedAndStoreChunks(chunks, doc.id, { townId });
        totalChunks += result.chunksEmbedded;
        errors += result.errors;
      }
    } catch (err) {
      console.error(`[ingest] Error processing PDF ${pdf.url}:`, err);
      errors++;
    }
  }

  return { chunks: totalChunks, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runIngestion(
  options: IngestOptions = {}
): Promise<IngestResult> {
  const {
    townId = "needham",
    limit = 200,
    pdfOnly = false,
    singleUrl,
  } = options;

  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();
  let pagesProcessed = 0;
  let pdfsProcessed = 0;
  let totalChunks = 0;
  let totalErrors = 0;

  console.log("=".repeat(60));
  console.log(`[ingest] Starting ingestion for town: ${townId}`);
  console.log("=".repeat(60));

  // Step 1: Crawl website (unless PDF-only or single URL mode)
  let crawlResults: CrawlResult[] = [];
  let allPdfUrls: string[] = [];

  if (!pdfOnly && !singleUrl) {
    console.log("\n--- Step 1: Crawling needhamma.gov ---");
    crawlResults = await crawlWebsite({ townId, limit });
    pagesProcessed = crawlResults.length;

    // Collect all discovered PDF URLs
    allPdfUrls = Array.from(
      new Set(crawlResults.flatMap((r) => r.pdfUrls))
    );
    console.log(`Discovered ${allPdfUrls.length} unique PDF URLs`);
  }

  // Step 2: Handle single URL re-ingestion
  if (singleUrl) {
    console.log(`\n--- Re-ingesting single URL: ${singleUrl} ---`);
    if (singleUrl.endsWith(".pdf")) {
      allPdfUrls = [singleUrl];
    } else {
      // Re-crawl just this URL using v2 API
      const Firecrawl = (await import("@mendable/firecrawl-js")).default;
      const firecrawl = new Firecrawl({
        apiKey: process.env.FIRECRAWL_API_KEY!,
      });
      const scrapeResult = await firecrawl.scrape(singleUrl, {
        formats: ["markdown"],
      });
      if (scrapeResult.markdown) {
        const { createHash } = await import("crypto");
        crawlResults = [
          {
            url: singleUrl,
            title: (scrapeResult.metadata?.title as string) || "Untitled",
            markdown: scrapeResult.markdown,
            sourceType: "html",
            contentHash: createHash("sha256")
              .update(scrapeResult.markdown)
              .digest("hex"),
            fileSizeBytes: Buffer.byteLength(scrapeResult.markdown, "utf-8"),
            pdfUrls: [],
          },
        ];
        pagesProcessed = 1;
      }
    }
  }

  // Step 3: Process crawled HTML pages
  if (crawlResults.length > 0) {
    console.log(`\n--- Step 2: Chunking & embedding ${crawlResults.length} pages ---`);
    const pageResult = await ingestCrawledPages(crawlResults, townId);
    totalChunks += pageResult.chunks;
    totalErrors += pageResult.errors;
  }

  // Step 4: Extract and process PDFs
  if (allPdfUrls.length > 0) {
    console.log(`\n--- Step 3: Extracting ${allPdfUrls.length} PDFs ---`);
    const pdfResults = await extractPdfs(allPdfUrls, { townId });
    pdfsProcessed = pdfResults.length;

    if (pdfResults.length > 0) {
      console.log(`\n--- Step 4: Chunking & embedding ${pdfResults.length} PDFs ---`);
      const pdfChunkResult = await ingestPdfs(pdfResults, townId);
      totalChunks += pdfChunkResult.chunks;
      totalErrors += pdfChunkResult.errors;
    }
  }

  // Step 5: Log the run
  const durationMs = Date.now() - startTime;

  await supabase.from("ingestion_log").insert({
    town_id: townId,
    action: "crawl",
    documents_processed: pagesProcessed + pdfsProcessed,
    errors: totalErrors,
    duration_ms: durationMs,
    details: {
      pages_processed: pagesProcessed,
      pdfs_processed: pdfsProcessed,
      total_chunks: totalChunks,
      crawl_limit: limit,
      pdf_only: pdfOnly,
      single_url: singleUrl || null,
    },
  });

  console.log("\n" + "=".repeat(60));
  console.log("[ingest] INGESTION COMPLETE");
  console.log(`  Pages processed: ${pagesProcessed}`);
  console.log(`  PDFs processed:  ${pdfsProcessed}`);
  console.log(`  Total chunks:    ${totalChunks}`);
  console.log(`  Errors:          ${totalErrors}`);
  console.log(`  Duration:        ${(durationMs / 1000).toFixed(1)}s`);
  console.log("=".repeat(60));

  return {
    pagesProcessed,
    pdfsProcessed,
    totalChunks,
    totalErrors,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  const limit = parseInt(
    args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "200"
  );
  const pdfOnly = args.includes("--pdf-only");
  const singleUrl = args
    .find((a) => a.startsWith("--url="))
    ?.split("=")
    .slice(1)
    .join("=");

  (async () => {
    try {
      await runIngestion({ limit, pdfOnly, singleUrl });
    } catch (err) {
      console.error("Ingestion failed:", err);
      process.exit(1);
    }
  })();
}
