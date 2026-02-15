/**
 * scripts/ingest.ts — Main ingestion orchestrator
 *
 * Coordinates the full pipeline:
 * 1. Scrape needhamma.gov with custom scraper -> clean markdown pages
 * 2. Download & extract discovered PDFs -> text
 * 3. Chunk all content by document type (Section 4)
 * 4. Generate embeddings & upsert into Supabase pgvector
 * 5. Log the ingestion run with structured success/failure counts
 *
 * Usage:
 *   npx tsx scripts/ingest.ts                    # Full ingestion
 *   npx tsx scripts/ingest.ts --limit=10         # Scrape 10 pages only
 *   npx tsx scripts/ingest.ts --pdf-only         # Only process PDFs
 *   npx tsx scripts/ingest.ts --url=<url>        # Re-ingest single URL
 *   npx tsx scripts/ingest.ts --scrape-only      # Run just the scraper, no embedding
 */

import { createHash } from "crypto";
import { getSupabaseServiceClient } from "../src/lib/supabase";
import { scrape, toCrawlResults, CrawlResult } from "./scraper";
import { extractPdfs, PdfExtractionResult } from "./extract-pdf";
import { chunkDocument, Chunk, detectDocumentType } from "./chunk";
import { embedAndStoreChunks } from "./embed";
import { IngestionLogger, StageTimer } from "./logger";
import { getScraperConfig } from "./scraper-config";
import { enrichDocument } from "./enrich";

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
  scrapeOnly?: boolean;
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

      // Enrich document with AI metadata (summary, tags, title, type)
      let enrichment = null;
      try {
        enrichment = await enrichDocument(page.title, page.markdown, page.url);
        await supabase
          .from("documents")
          .update({
            ai_summary: enrichment.ai_summary,
            ai_title: enrichment.ai_title,
            ai_tags: enrichment.ai_tags,
            content_type: enrichment.content_type,
            last_enriched: new Date().toISOString(),
          })
          .eq("id", doc.id);
      } catch (err) {
        console.warn(`[ingest] Enrichment failed for ${page.url}, continuing without enrichment:`, err);
      }

      const chunks = chunkDocument(page.markdown, {
        documentId: doc.id,
        documentUrl: page.url,
        documentTitle: page.title,
      });

      // Add enrichment fields to chunk metadata (for search results)
      if (enrichment) {
        for (const chunk of chunks) {
          chunk.metadata.ai_summary = enrichment.ai_summary;
          chunk.metadata.ai_title = enrichment.ai_title;
          chunk.metadata.ai_tags = enrichment.ai_tags;
          chunk.metadata.content_type = enrichment.content_type;
        }
      }

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

        // Enrich new PDF document
        let enrichment = null;
        try {
          enrichment = await enrichDocument(pdf.title, pdf.text, pdf.url);
          await supabase
            .from("documents")
            .update({
              ai_summary: enrichment.ai_summary,
              ai_title: enrichment.ai_title,
              ai_tags: enrichment.ai_tags,
              content_type: enrichment.content_type,
              last_enriched: new Date().toISOString(),
            })
            .eq("id", newDoc.id);
        } catch (err) {
          console.warn(`[ingest] Enrichment failed for ${pdf.url}, continuing without enrichment:`, err);
        }

        const chunks = chunkDocument(pdf.text, { documentId: newDoc.id, documentUrl: pdf.url, documentTitle: pdf.title });

        // Add enrichment fields to chunk metadata
        if (enrichment) {
          for (const chunk of chunks) {
            chunk.metadata.ai_summary = enrichment.ai_summary;
            chunk.metadata.ai_title = enrichment.ai_title;
            chunk.metadata.ai_tags = enrichment.ai_tags;
            chunk.metadata.content_type = enrichment.content_type;
          }
        }
        const result = await embedAndStoreChunks(chunks, newDoc.id, { townId });
        totalChunks += result.chunksEmbedded;
        errors += result.errors;
      } else {
        // Enrich existing PDF if not already enriched
        let enrichment = null;
        try {
          const { data: existingDoc } = await supabase
            .from("documents")
            .select("ai_summary")
            .eq("id", doc.id)
            .single();

          if (!existingDoc?.ai_summary) {
            enrichment = await enrichDocument(pdf.title, pdf.text, pdf.url);
            await supabase
              .from("documents")
              .update({
                ai_summary: enrichment.ai_summary,
                ai_title: enrichment.ai_title,
                ai_tags: enrichment.ai_tags,
                content_type: enrichment.content_type,
                last_enriched: new Date().toISOString(),
              })
              .eq("id", doc.id);
          }
        } catch (err) {
          console.warn(`[ingest] Enrichment failed for ${pdf.url}, continuing without enrichment:`, err);
        }

        const chunks = chunkDocument(pdf.text, { documentId: doc.id, documentUrl: pdf.url, documentTitle: pdf.title });

        // Add enrichment fields to chunk metadata
        if (enrichment) {
          for (const chunk of chunks) {
            chunk.metadata.ai_summary = enrichment.ai_summary;
            chunk.metadata.ai_title = enrichment.ai_title;
            chunk.metadata.ai_tags = enrichment.ai_tags;
            chunk.metadata.content_type = enrichment.content_type;
          }
        }

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
// Single URL scraping (replaces Firecrawl single-page scrape)
// ---------------------------------------------------------------------------

async function scrapeSingleUrl(url: string, userAgent: string): Promise<CrawlResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`[ingest] HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();

    // Use JSDOM + Readability for content extraction (same as scraper)
    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");
    const TurndownService = (await import("turndown")).default;

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, { charThreshold: 50 });
    const article = reader.parse();

    if (!article?.content) return null;

    const turndown = new TurndownService({ headingStyle: "atx" });
    turndown.remove(["script", "style", "noscript", "iframe"]);
    const markdown = turndown.turndown(article.content);

    const title = article.title
      ?.replace(/\s*[|\-–—]\s*(?:Town of )?Needham,?\s*(?:MA)?/gi, "")
      .trim() || "Untitled";

    return {
      url,
      title,
      markdown,
      sourceType: "html",
      contentHash: createHash("sha256").update(markdown).digest("hex"),
      fileSizeBytes: Buffer.byteLength(markdown, "utf-8"),
      pdfUrls: [],
    };
  } catch (err) {
    console.error(`[ingest] Single URL scrape failed for ${url}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runIngestion(options: IngestOptions = {}): Promise<IngestResult> {
  const {
    townId = "needham",
    limit = 200,
    pdfOnly = false,
    singleUrl,
    scrapeOnly = false,
    triggeredBy = "cli",
  } = options;

  const logger = new IngestionLogger({ townId, action: "scrape", triggeredBy });

  let pagesProcessed = 0;
  let pdfsProcessed = 0;
  let totalChunks = 0;
  let totalErrors = 0;

  let crawlResults: CrawlResult[] = [];
  let allPdfUrls: string[] = [];

  if (!pdfOnly && !singleUrl) {
    const crawlStage = logger.startStage("Scrape");
    try {
      const scrapeResult = await scrape({ townId, maxPages: limit });
      crawlResults = toCrawlResults(scrapeResult.documents, scrapeResult.pdfUrls);
      pagesProcessed = crawlResults.length;
      crawlStage.recordSuccess(crawlResults.length);
      allPdfUrls = scrapeResult.pdfUrls;
      crawlStage.addDetail("pdf_urls_discovered", allPdfUrls.length);
    } catch (err) {
      crawlStage.recordFailure(1, `Scrape failed: ${err}`);
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
        const result = await scrapeSingleUrl(
          singleUrl,
          "NeedhamNavigator/1.0 (community civic tool) Node.js"
        );
        if (result) {
          crawlResults = [result];
          pagesProcessed = 1;
          singleStage.recordSuccess();
        } else {
          singleStage.recordFailure(1, "No content extracted from URL");
        }
      }
    } catch (err) {
      singleStage.recordFailure(1, `Single URL re-ingest failed: ${err}`);
    }
    logger.addStageResult(singleStage.finish());
  }

  // Add direct PDF URLs from config (if any)
  const config = getScraperConfig(townId);
  if (config.directPdfUrls && config.directPdfUrls.length > 0) {
    console.log(`[ingest] Adding ${config.directPdfUrls.length} direct PDF URLs from config`);
    allPdfUrls = [...new Set([...allPdfUrls, ...config.directPdfUrls])]; // Dedupe
  }

  // If scrape-only mode, stop after scraping
  if (scrapeOnly) {
    console.log("\n[ingest] --scrape-only mode: stopping after scrape (no embedding)");
    const summary = await logger.finish({
      pages_processed: pagesProcessed,
      pdfs_discovered: allPdfUrls.length,
      scrape_only: true,
    });
    return {
      pagesProcessed,
      pdfsProcessed: 0,
      totalChunks: 0,
      totalErrors: summary.totalErrors,
      durationMs: summary.totalDurationMs,
    };
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
  const scrapeOnly = args.includes("--scrape-only");
  const singleUrl = args.find((a) => a.startsWith("--url="))?.split("=").slice(1).join("=");

  (async () => {
    try {
      await runIngestion({ limit, pdfOnly, singleUrl, scrapeOnly });
    } catch (err) {
      console.error("Ingestion failed:", err);
      process.exit(1);
    }
  })();
}
