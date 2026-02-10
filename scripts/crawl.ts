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
      "*.jpg",
      "*.png",
      "*.gif",
    ],
    townId = "needham",
  } = options;

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: FIRECRAWL_API_KEY");
  }

  const firecrawl = new Firecrawl({ apiKey });

  console.log(`[crawl] Starting crawl of ${baseUrl} (limit: ${limit})`);

  // v2 API: crawl() polls until complete and returns CrawlJob
  const crawlJob = await firecrawl.crawl(baseUrl, {
    limit,
    includePaths,
    excludePaths,
    scrapeOptions: {
      formats: ["markdown"],
    },
  });

  const results: CrawlResult[] = [];
  const allPdfUrls: string[] = [];

  for (const page of crawlJob.data || []) {
    const markdown = page.markdown || "";
    const url = (page.metadata?.sourceURL as string) || (page.metadata?.url as string) || "";
    if (!url || !markdown) continue;

    const pdfUrls = extractPdfUrls(markdown, baseUrl);
    allPdfUrls.push(...pdfUrls);

    const result: CrawlResult = {
      url,
      title: (page.metadata?.title as string) || extractTitle(markdown, url),
      markdown,
      sourceType: "html",
      contentHash: hashContent(markdown),
      fileSizeBytes: Buffer.byteLength(markdown, "utf-8"),
      pdfUrls,
    };

    results.push(result);
  }

  console.log(
    `[crawl] Crawled ${results.length} pages, discovered ${allPdfUrls.length} PDF links`
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

  (async () => {
    try {
      if (mapOnly) {
        const urls = await discoverUrls();
        console.log(`\nDiscovered ${urls.length} URLs:`);
        urls.forEach((u) => console.log(`  ${u}`));
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
