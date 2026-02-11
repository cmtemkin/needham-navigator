/**
 * scripts/crawl.ts — DEPRECATED: Now delegates to scripts/scraper.ts
 *
 * This file previously used Firecrawl API for web crawling.
 * It has been replaced by a custom scraper (cheerio + readability + turndown).
 *
 * This file re-exports types and functions from scraper.ts for backward
 * compatibility with any code that still imports from "./crawl".
 */

export { CrawlResult, scrape, toCrawlResults } from "./scraper";
export { ScrapedDocument, ScrapeResult, ScrapeOptions } from "./scraper";
import { scrape, toCrawlResults, CrawlResult } from "./scraper";

// Backward-compatible wrapper
export interface CrawlOptions {
  baseUrl?: string;
  limit?: number;
  includePaths?: string[];
  excludePaths?: string[];
  townId?: string;
}

export async function crawlWebsite(
  options: CrawlOptions = {}
): Promise<CrawlResult[]> {
  const { townId = "needham", limit = 200 } = options;
  const result = await scrape({ townId, maxPages: limit });
  return toCrawlResults(result.documents, result.pdfUrls);
}

export async function discoverUrls(
  baseUrl: string = "https://www.needhamma.gov"
): Promise<string[]> {
  const result = await scrape({ townId: "needham", maxPages: 500 });
  return result.documents.map((d) => d.source_url);
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "200");

  (async () => {
    try {
      const results = await crawlWebsite({ limit });
      console.log(`\nCrawl complete. ${results.length} pages processed.`);
    } catch (err) {
      console.error("Crawl failed:", err);
      process.exit(1);
    }
  })();
}
