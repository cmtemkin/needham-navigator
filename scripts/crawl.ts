/**
 * scripts/crawl.ts — Firecrawl web crawler for needhamma.gov
 *
 * Crawls the Needham town website using Firecrawl API, returning
 * clean markdown for each page. Also discovers and downloads linked PDFs.
 */

import Firecrawl from "@mendable/firecrawl-js";
import { createHash } from "crypto";
import { getSupabaseServiceClient } from "../src/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrawlResult {
  url: string;
  title: string;
  markdown: string;
  sourceType: "html" | "pdf";
  contentHash: string;
  fileSizeBytes: number;
  pdfUrls: string[]; // PDF links discovered on this page
}

export interface CrawlOptions {
  baseUrl?: string;
  limit?: number;
  includePaths?: string[];
  excludePaths?: string[];
  townId?: string;
}

const DEFAULT_BASE_URL = "https://www.needhamma.gov";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Retry a function with exponential backoff
 */
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[crawl] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry exhausted"); // Should never reach here
}

function extractPdfUrls(markdown: string, baseUrl: string): string[] {
  // Match markdown links ending in .pdf
  const linkRegex = /\[([^\]]*)\]\(([^)]*\.pdf[^)]*)\)/gi;
  // Match raw URLs ending in .pdf
  const rawUrlRegex = /https?:\/\/[^\s"'<>]+\.pdf/gi;

  const urls = new Set<string>();

  let match;
  while ((match = linkRegex.exec(markdown)) !== null) {
    const url = match[2];
    urls.add(normalizeUrl(url, baseUrl));
  }
  while ((match = rawUrlRegex.exec(markdown)) !== null) {
    urls.add(normalizeUrl(match[0], baseUrl));
  }

  return Array.from(urls);
}

function normalizeUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return `${baseUrl}/${url}`;
}

function extractTitle(markdown: string, url: string): string {
  // Try to find a heading
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Fallback: use URL path
  const path = new URL(url).pathname;
  return path
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]/g, " ")
    .replace(/\.\w+$/, "") || "Untitled";
}

// ---------------------------------------------------------------------------
// Main crawl function
// ---------------------------------------------------------------------------

export async function crawlWebsite(
  options: CrawlOptions = {}
): Promise<CrawlResult[]> {
  const {
    baseUrl = DEFAULT_BASE_URL,
    limit = 200,
    includePaths = ["/*"],
    excludePaths = [
      "/Calendar.aspx*",
      "/AgendaCenter*",
      "/rss*",
      "/Search.aspx*",
      "/Login.aspx*",
      "/print/*",
      "/email/*",
      "*.jpg",
      "*.png",
      "*.gif",
      "*.xlsx",
      "*.docx",
      "*.zip",
    ],
    townId = "needham",
  } = options;

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: FIRECRAWL_API_KEY");
  }

  const firecrawl = new Firecrawl({ apiKey });

  console.log(`[crawl] Starting crawl of ${baseUrl} (limit: ${limit})`);

  // Fetch existing documents to enable incremental crawling
  const supabase = getSupabaseServiceClient();
  const { data: existingDocs } = await supabase
    .from("documents")
    .select("url, content_hash")
    .eq("town_id", townId);

  const existingHashes = new Map(
    (existingDocs || []).map((d) => [d.url, d.content_hash])
  );
  console.log(`[crawl] Found ${existingHashes.size} existing documents for incremental check`);

  // v2 API: crawl() polls until complete and returns CrawlJob
  // Wrap in retry for transient failures
  const crawlJob = await retry(
    async () =>
      firecrawl.crawl(baseUrl, {
        limit,
        includePaths,
        excludePaths,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    3,
    1000
  );

  const results: CrawlResult[] = [];
  const allPdfUrls: string[] = [];
  let skippedUnchanged = 0;

  for (const page of crawlJob.data || []) {
    const markdown = page.markdown || "";
    const url = (page.metadata?.sourceURL as string) || (page.metadata?.url as string) || "";
    if (!url || !markdown) continue;

    const newHash = hashContent(markdown);
    const existingHash = existingHashes.get(url);

    // Incremental crawling: skip if content unchanged
    if (existingHash === newHash) {
      skippedUnchanged++;
      continue;
    }

    const pdfUrls = extractPdfUrls(markdown, baseUrl);
    allPdfUrls.push(...pdfUrls);

    const result: CrawlResult = {
      url,
      title: (page.metadata?.title as string) || extractTitle(markdown, url),
      markdown,
      sourceType: "html",
      contentHash: newHash,
      fileSizeBytes: Buffer.byteLength(markdown, "utf-8"),
      pdfUrls,
    };

    results.push(result);
  }

  console.log(
    `[crawl] Crawled ${results.length} pages (${skippedUnchanged} unchanged), discovered ${allPdfUrls.length} PDF links`
  );

  // Store results in Supabase
  await storeCrawlResults(results, townId);

  return results;
}

// ---------------------------------------------------------------------------
// Supabase storage
// ---------------------------------------------------------------------------

async function storeCrawlResults(
  results: CrawlResult[],
  townId: string
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  for (const result of results) {
    const { error } = await supabase.from("documents").upsert(
      {
        town_id: townId,
        url: result.url,
        title: result.title,
        source_type: result.sourceType,
        content_hash: result.contentHash,
        file_size_bytes: result.fileSizeBytes,
        downloaded_at: new Date().toISOString(),
        metadata: {
          pdf_urls_found: result.pdfUrls,
        },
      },
      { onConflict: "town_id,url" }
    );

    if (error) {
      console.error(`[crawl] Error storing ${result.url}: ${error.message}`);
    }
  }

  console.log(`[crawl] Stored ${results.length} document records in Supabase`);
}

// ---------------------------------------------------------------------------
// Crawl from source registry
// ---------------------------------------------------------------------------

import { CRAWL_SOURCES, getHighPrioritySources, type CrawlSource } from "../config/crawl-sources";

export async function crawlFromSources(
  sources: CrawlSource[] = CRAWL_SOURCES,
  townId: string = "needham"
): Promise<{ total: number; succeeded: number; failed: number; results: CrawlResult[] }> {
  console.log(`[crawl] Starting crawl from ${sources.length} sources`);

  // Sort by priority (high to low)
  const sortedSources = [...sources].sort((a, b) => b.priority - a.priority);

  let succeeded = 0;
  let failed = 0;
  const allResults: CrawlResult[] = [];

  for (const source of sortedSources) {
    try {
      console.log(`\n[crawl] Processing source: ${source.id} (priority ${source.priority})`);
      console.log(`[crawl] URL: ${source.url}`);

      const results = await crawlWebsite({
        baseUrl: source.url,
        limit: source.maxDepth ? source.maxDepth * 20 : 50, // Rough estimate
        townId,
      });

      allResults.push(...results);
      succeeded++;
      console.log(`[crawl] ✓ ${source.id}: ${results.length} pages`);
    } catch (error) {
      failed++;
      console.error(`[crawl] ✗ ${source.id} failed:`, error);
    }
  }

  console.log(`\n[crawl] Source crawl complete: ${succeeded}/${sources.length} succeeded, ${failed} failed`);
  console.log(`[crawl] Total pages crawled: ${allResults.length}`);

  return {
    total: sources.length,
    succeeded,
    failed,
    results: allResults,
  };
}

// ---------------------------------------------------------------------------
// Map endpoint — discover all URLs on the site
// ---------------------------------------------------------------------------

export async function discoverUrls(
  baseUrl: string = DEFAULT_BASE_URL
): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: FIRECRAWL_API_KEY");
  }

  const firecrawl = new Firecrawl({ apiKey });

  console.log(`[crawl] Discovering URLs on ${baseUrl}...`);

  // v2 API: map() returns MapData with links: SearchResultWeb[]
  const mapData = await firecrawl.map(baseUrl);

  const urls = (mapData.links || []).map((link) => link.url);
  console.log(`[crawl] Discovered ${urls.length} URLs`);
  return urls;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "200");
  const mapOnly = args.includes("--map");
  const sourcesOnly = args.includes("--sources");
  const highPriorityOnly = args.includes("--high-priority");

  (async () => {
    try {
      if (mapOnly) {
        const urls = await discoverUrls();
        console.log(`\nDiscovered ${urls.length} URLs:`);
        urls.forEach((u) => console.log(`  ${u}`));
      } else if (sourcesOnly || highPriorityOnly) {
        const sources = highPriorityOnly ? getHighPrioritySources() : CRAWL_SOURCES;
        const result = await crawlFromSources(sources);
        console.log(`\n=== CRAWL FROM SOURCES COMPLETE ===`);
        console.log(`Total sources: ${result.total}`);
        console.log(`Succeeded: ${result.succeeded}`);
        console.log(`Failed: ${result.failed}`);
        console.log(`Total pages: ${result.results.length}`);
      } else {
        const results = await crawlWebsite({ limit });
        console.log(`\nCrawl complete. ${results.length} pages processed.`);
        const pdfCount = results.reduce(
          (sum, r) => sum + r.pdfUrls.length,
          0
        );
        console.log(`PDF links discovered: ${pdfCount}`);
      }
    } catch (err) {
      console.error("Crawl failed:", err);
      process.exit(1);
    }
  })();
}
