/**
 * scripts/scraper.ts — Custom web scraper for municipal sites
 *
 * Replaces Firecrawl with a free, purpose-built scraper optimized for
 * CivicPlus municipal websites. Uses:
 *   - cheerio for link extraction
 *   - JSDOM + @mozilla/readability for main content extraction
 *   - turndown for HTML → markdown conversion
 *   - robots-parser for robots.txt compliance
 *
 * Produces data compatible with the existing chunk.ts / embed.ts pipeline.
 */

import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import robotsParser from "robots-parser";
import {
  ScraperConfig,
  NEEDHAM_CONFIG,
  getScraperConfig,
  getDepartmentFromUrl,
  shouldSkipUrl,
  isAllowedDomain,
  isPdfUrl,
} from "./scraper-config";

// ---------------------------------------------------------------------------
// Types (compatible with existing pipeline)
// ---------------------------------------------------------------------------

export interface ScrapedDocument {
  /** Clean markdown content */
  content: string;
  /** Source URL */
  source_url: string;
  /** Page title */
  document_title: string;
  /** "html" or "pdf" */
  document_type: string;
  /** Detected department from URL path */
  department: string | undefined;
  /** Last-Modified header or crawl date */
  last_updated: string;
  /** SHA-256 hash of content */
  content_hash: string;
  /** Content size in bytes */
  size_bytes: number;
}

/** For backward-compat with CrawlResult expected by ingest.ts */
export interface CrawlResult {
  url: string;
  title: string;
  markdown: string;
  sourceType: "html" | "pdf";
  contentHash: string;
  fileSizeBytes: number;
  pdfUrls: string[];
}

interface CrawlProgress {
  visited: string[];
  queue: Array<{ url: string; depth: number }>;
  pdfUrls: string[];
  results: ScrapedDocument[];
  startedAt: string;
  lastSavedAt: string;
}

// ---------------------------------------------------------------------------
// Turndown setup
// ---------------------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Preserve tables
turndown.addRule("tableCell", {
  filter: ["th", "td"],
  replacement(content, node) {
    return ` ${content.trim()} |`;
  },
});

turndown.addRule("tableRow", {
  filter: "tr",
  replacement(content) {
    return `|${content}\n`;
  },
});

turndown.addRule("table", {
  filter: "table",
  replacement(content, node) {
    // Add header separator row after the first row
    const rows = content.trim().split("\n").filter(Boolean);
    if (rows.length >= 1) {
      const firstRow = rows[0];
      const colCount = (firstRow.match(/\|/g) || []).length - 1;
      const separator = "|" + " --- |".repeat(Math.max(colCount, 1));
      return "\n\n" + rows[0] + "\n" + separator + "\n" + rows.slice(1).join("\n") + "\n\n";
    }
    return content;
  },
});

// Remove script/style tags
turndown.remove(["script", "style", "noscript", "iframe"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    // Strip fragment
    url.hash = "";
    // Strip trailing slash consistently (including root path)
    let normalized = url.toString();
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  config: ScraperConfig,
  attempt = 0
): Promise<Response> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000), // 30s timeout
    });
    return response;
  } catch (err) {
    if (attempt < config.maxRetries - 1) {
      const delay = config.crawlDelayMs * Math.pow(2, attempt + 1);
      console.log(`  [scraper] Retry ${attempt + 1}/${config.maxRetries} for ${url} after ${delay}ms`);
      await sleep(delay);
      return fetchWithRetry(url, config, attempt + 1);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sitemap.xml parsing
// ---------------------------------------------------------------------------

async function fetchSitemap(sitemapUrl: string, config: ScraperConfig): Promise<string[]> {
  try {
    console.log(`[scraper] Fetching sitemap: ${sitemapUrl}`);
    const response = await fetch(sitemapUrl, {
      headers: { "User-Agent": config.userAgent },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.warn(`[scraper] Sitemap fetch failed (${response.status}): ${sitemapUrl}`);
      return [];
    }

    const xml = await response.text();
    const urls: string[] = [];

    // Parse XML for <loc> tags (both sitemap index and urlset)
    const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
    for (const match of locMatches) {
      const url = match[1].trim();
      // If this is a sitemap index (linking to other sitemaps), recursively fetch
      if (url.endsWith(".xml") || url.includes("sitemap")) {
        const nestedUrls = await fetchSitemap(url, config);
        urls.push(...nestedUrls);
      } else {
        urls.push(url);
      }
    }

    console.log(`[scraper] Sitemap parsed: ${urls.length} URLs from ${sitemapUrl}`);
    return urls;
  } catch (err) {
    console.error(`[scraper] Sitemap parsing failed for ${sitemapUrl}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Robots.txt
// ---------------------------------------------------------------------------

const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();

async function checkRobotsTxt(
  url: string,
  config: ScraperConfig
): Promise<boolean> {
  try {
    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

    if (!robotsCache.has(robotsUrl)) {
      const response = await fetch(robotsUrl, {
        headers: { "User-Agent": config.userAgent },
        signal: AbortSignal.timeout(10000),
      });
      const robotsTxt = response.ok ? await response.text() : "";
      robotsCache.set(robotsUrl, robotsParser(robotsUrl, robotsTxt));
    }

    const robots = robotsCache.get(robotsUrl)!;
    return robots.isAllowed(url, config.userAgent) ?? true;
  } catch {
    // If robots.txt is unavailable, assume allowed
    return true;
  }
}

// ---------------------------------------------------------------------------
// Content extraction
// ---------------------------------------------------------------------------

/**
 * Extract the main content from an HTML page using Readability,
 * then convert to clean markdown.
 */
function extractContent(
  html: string,
  url: string
): { title: string; markdown: string } | null {
  try {
    // Create a DOM for Readability
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Get title before Readability modifies the DOM
    const rawTitle = doc.querySelector("title")?.textContent?.trim() || "";

    // Use Readability to extract main content
    const reader = new Readability(doc, {
      charThreshold: 50,
    });
    const article = reader.parse();

    if (!article || !article.content) {
      return null;
    }

    // Convert extracted HTML to markdown
    let markdown = turndown.turndown(article.content);

    // Additional cleanup for CivicPlus boilerplate
    markdown = cleanCivicPlusBoilerplate(markdown);

    // Clean title — remove site name suffix and CivicEngage branding
    let title = article.title || rawTitle;
    title = title
      .replace(/\s*[•|\-–—]\s*(?:Town of )?Needham\s*[•|\-–—]?\s*(?:CivicEngage)?/gi, "")
      .replace(/\s*[|\-–—]\s*(?:Town of )?Needham,?\s*(?:MA)?/gi, "")
      .replace(/\s*[|\-–—]\s*needhamma\.gov/gi, "")
      .replace(/\s*•\s*CivicEngage\s*/gi, "")
      .trim();

    if (!title) {
      // Fallback: derive from URL path
      const pathname = new URL(url).pathname;
      title = pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") || "Untitled";
    }

    return { title, markdown };
  } catch (err) {
    console.error(`  [scraper] Content extraction failed for ${url}:`, err);
    return null;
  }
}

/**
 * Strip CivicPlus CMS boilerplate from markdown.
 */
function cleanCivicPlusBoilerplate(markdown: string): string {
  let cleaned = markdown;

  // Loading placeholders
  cleaned = cleaned.replace(/!\[Loading\]\([^)]*\)/g, "");
  cleaned = cleaned.replace(/^Loading$/gm, "");
  cleaned = cleaned.replace(/(?:Loading\s*\n\s*){2,}/g, "");

  // Skip-to-content
  cleaned = cleaned.replace(/\[Skip to Main Content\]\([^)]*\)/g, "");

  // CivicPlus footer
  cleaned = cleaned.replace(/Government Websites by CivicPlus®?/g, "");
  cleaned = cleaned.replace(/\[Powered by.*?CivicPlus.*?\]\([^)]*\)/g, "");

  // Google Translate picker (massive language list)
  cleaned = cleaned.replace(/Select Language\s*(?:Abkhaz|Acehnese)[\s\S]*?(?:Zulu|Zapotec)\b/g, "");
  cleaned = cleaned.replace(/Powered by \[!\[Google Translate\][^\]]*\]\([^)]*\)\s*/g, "");

  // BESbswy font measurement strings
  cleaned = cleaned.replace(/(?:BESbswy){2,}/g, "");

  // Newsletter CTA
  cleaned = cleaned.replace(/Sign Up for the Town's Weekly e-Newsletter/g, "");

  // Close button leftovers
  cleaned = cleaned.replace(/Do Not Show AgainClose/g, "");
  cleaned = cleaned.replace(/^Close \*\*×\*\*$/gm, "");

  // Slideshow / carousel controls
  cleaned = cleaned.replace(/Arrow LeftArrow Right/g, "");
  cleaned = cleaned.replace(/Slideshow Left Arrow[\s\S]*?Slideshow Right Arrow/g, "");

  // Empty image tags (decorative)
  cleaned = cleaned.replace(/!\[\]\([^)]*\)/g, "");

  // Image alt text spam (repeated image descriptions)
  cleaned = cleaned.replace(/!\[[^\]]{200,}\]\([^)]*\)/g, "");

  // "[Loading]" text blocks
  cleaned = cleaned.replace(/\[Loading\]/g, "");

  // Breadcrumb numbered lists
  cleaned = cleaned.replace(/^(?:\d+\.\s*\[[^\]]*\]\(https?:\/\/(?:www\.)?needhamma\.gov\/[^)]*\)\n?)+/gm, "");

  // Collapse 3+ blank lines → 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Link extraction
// ---------------------------------------------------------------------------

/**
 * Extract all links from an HTML page using cheerio (fast, low-memory).
 */
function extractLinks(html: string, baseUrl: string): { pageLinks: string[]; pdfLinks: string[] } {
  const $ = cheerio.load(html);
  const pageLinks: string[] = [];
  const pdfLinks: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) return;

    if (isPdfUrl(normalized)) {
      pdfLinks.push(normalized);
    } else {
      pageLinks.push(normalized);
    }
  });

  return { pageLinks, pdfLinks };
}

// ---------------------------------------------------------------------------
// Progress management (resume capability)
// ---------------------------------------------------------------------------

function saveProgress(progress: CrawlProgress, config: ScraperConfig): void {
  progress.lastSavedAt = new Date().toISOString();
  fs.writeFileSync(
    path.resolve(config.progressFile),
    JSON.stringify(progress, null, 2)
  );
}

function loadProgress(config: ScraperConfig): CrawlProgress | null {
  try {
    const progressPath = path.resolve(config.progressFile);
    if (fs.existsSync(progressPath)) {
      const data = JSON.parse(fs.readFileSync(progressPath, "utf-8"));
      return data as CrawlProgress;
    }
  } catch {
    // Ignore corrupted progress files
  }
  return null;
}

function clearProgress(config: ScraperConfig): void {
  try {
    const progressPath = path.resolve(config.progressFile);
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
    }
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// Main scraper
// ---------------------------------------------------------------------------

export interface ScrapeOptions {
  /** Town ID (default: "needham") */
  townId?: string;
  /** Resume a previous interrupted crawl */
  resume?: boolean;
  /** Override max pages */
  maxPages?: number;
  /** Override max depth */
  maxDepth?: number;
}

export interface ScrapeResult {
  documents: ScrapedDocument[];
  pdfUrls: string[];
  totalPages: number;
  totalPdfs: number;
  durationMs: number;
}

export async function scrape(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const { townId = "needham", resume = false, maxPages, maxDepth } = options;
  const config = getScraperConfig(townId);

  // Apply overrides
  if (maxPages !== undefined) config.maxPages = maxPages;
  if (maxDepth !== undefined) config.maxDepth = maxDepth;

  const startTime = Date.now();
  console.log("=".repeat(60));
  console.log(`[scraper] Starting crawl for ${townId}`);
  console.log(`  Seed URLs: ${config.seedUrls.join(", ")}`);
  console.log(`  Max depth: ${config.maxDepth}, Max pages: ${config.maxPages}`);
  console.log(`  Crawl delay: ${config.crawlDelayMs}ms`);
  console.log("=".repeat(60));

  // Check for sitemap.xml in seed URLs and expand queue
  const expandedSeeds: string[] = [];
  for (const seed of config.seedUrls) {
    if (seed.endsWith(".xml") || seed.includes("sitemap")) {
      // This is a sitemap URL - fetch and expand
      const sitemapUrls = await fetchSitemap(seed, config);
      expandedSeeds.push(...sitemapUrls);
      console.log(`[scraper] Expanded sitemap ${seed} to ${sitemapUrls.length} URLs`);
    } else {
      // Try to find sitemap.xml at the root
      try {
        const rootUrl = new URL(seed);
        const sitemapUrl = `${rootUrl.protocol}//${rootUrl.host}/sitemap.xml`;
        const sitemapUrls = await fetchSitemap(sitemapUrl, config);
        if (sitemapUrls.length > 0) {
          expandedSeeds.push(...sitemapUrls);
          console.log(`[scraper] Found sitemap.xml at ${sitemapUrl} (${sitemapUrls.length} URLs)`);
        } else {
          // No sitemap found, use regular seed
          expandedSeeds.push(seed);
        }
      } catch {
        expandedSeeds.push(seed);
      }
    }
  }

  // Update config with expanded seeds
  if (expandedSeeds.length > config.seedUrls.length) {
    console.log(`[scraper] Expanded ${config.seedUrls.length} seeds to ${expandedSeeds.length} URLs via sitemaps`);
    config.seedUrls = expandedSeeds.slice(0, config.maxPages); // Limit to maxPages
  }

  // Initialize or resume progress
  let progress: CrawlProgress;
  if (resume) {
    const saved = loadProgress(config);
    if (saved) {
      console.log(`[scraper] Resuming from ${saved.visited.length} visited, ${saved.queue.length} queued`);
      progress = saved;
    } else {
      console.log("[scraper] No progress file found, starting fresh");
      progress = initProgress(config);
    }
  } else {
    progress = initProgress(config);
  }

  const visited = new Set(progress.visited);
  const queue = progress.queue;
  const allPdfUrls = new Set(progress.pdfUrls);
  const results = progress.results;

  // Check robots.txt for seed URLs
  for (const seed of config.seedUrls) {
    const allowed = await checkRobotsTxt(seed, config);
    if (!allowed) {
      console.warn(`[scraper] robots.txt disallows ${seed} — skipping`);
    }
  }

  let pagesProcessed = results.length;

  while (queue.length > 0 && pagesProcessed < config.maxPages) {
    const { url, depth } = queue.shift()!;

    // Skip if already visited
    if (visited.has(url)) continue;
    visited.add(url);

    // Skip if too deep
    if (depth > config.maxDepth) continue;

    // Skip if not in allowed domain
    if (!isAllowedDomain(url, config)) continue;

    // Skip based on URL patterns
    if (shouldSkipUrl(url, config)) continue;

    // Skip PDFs (collected separately)
    if (isPdfUrl(url)) {
      allPdfUrls.add(url);
      continue;
    }

    // Check robots.txt
    const robotsAllowed = await checkRobotsTxt(url, config);
    if (!robotsAllowed) {
      console.log(`  [scraper] Blocked by robots.txt: ${url}`);
      continue;
    }

    // Respect crawl delay
    await sleep(config.crawlDelayMs);

    try {
      console.log(
        `[scraper] Crawled ${pagesProcessed + 1}/~${config.maxPages} (depth ${depth}): ${url}`
      );

      const response = await fetchWithRetry(url, config);

      if (!response.ok) {
        console.warn(`  [scraper] HTTP ${response.status} for ${url}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        // Not an HTML page — skip
        if (contentType.includes("pdf")) {
          allPdfUrls.add(url);
        }
        continue;
      }

      const html = await response.text();
      const lastModified = response.headers.get("last-modified") || new Date().toISOString();

      // Extract links (for crawl queue)
      const { pageLinks, pdfLinks } = extractLinks(html, url);
      pdfLinks.forEach((p) => allPdfUrls.add(p));

      // Add discovered links to queue
      for (const link of pageLinks) {
        if (!visited.has(link) && isAllowedDomain(link, config) && !shouldSkipUrl(link, config)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }

      // Extract main content
      const extracted = extractContent(html, url);
      if (!extracted || extracted.markdown.length < 50) {
        console.log(`  [scraper] Skipping ${url} — insufficient content`);
        continue;
      }

      const department = getDepartmentFromUrl(url, config, extracted.title);
      const contentHash = hashContent(extracted.markdown);

      results.push({
        content: extracted.markdown,
        source_url: url,
        document_title: extracted.title,
        document_type: "html",
        department,
        last_updated: lastModified,
        content_hash: contentHash,
        size_bytes: Buffer.byteLength(extracted.markdown, "utf-8"),
      });

      pagesProcessed++;

      // Save progress every 25 pages
      if (pagesProcessed % 25 === 0) {
        progress.visited = Array.from(visited);
        progress.queue = queue;
        progress.pdfUrls = Array.from(allPdfUrls);
        progress.results = results;
        saveProgress(progress, config);
        console.log(`  [scraper] Progress saved (${pagesProcessed} pages, ${allPdfUrls.size} PDFs discovered)`);
      }
    } catch (err) {
      console.error(`  [scraper] Error crawling ${url}:`, err);
    }
  }

  const durationMs = Date.now() - startTime;

  // Write final output
  const outputPath = path.resolve(config.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n[scraper] Wrote ${results.length} documents to ${config.outputFile}`);

  // Clean up progress file on successful completion
  clearProgress(config);

  console.log("=".repeat(60));
  console.log("[scraper] CRAWL COMPLETE");
  console.log(`  Pages scraped: ${results.length}`);
  console.log(`  PDFs discovered: ${allPdfUrls.size}`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log("=".repeat(60));

  return {
    documents: results,
    pdfUrls: Array.from(allPdfUrls),
    totalPages: results.length,
    totalPdfs: allPdfUrls.size,
    durationMs,
  };
}

function initProgress(config: ScraperConfig): CrawlProgress {
  return {
    visited: [],
    queue: config.seedUrls.map((url) => ({ url, depth: 0 })),
    pdfUrls: [],
    results: [],
    startedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Convert ScrapedDocument[] → CrawlResult[] for pipeline compatibility
// ---------------------------------------------------------------------------

export function toCrawlResults(docs: ScrapedDocument[], pdfUrls: string[]): CrawlResult[] {
  return docs.map((doc) => ({
    url: doc.source_url,
    title: doc.document_title,
    markdown: doc.content,
    sourceType: doc.document_type as "html" | "pdf",
    contentHash: doc.content_hash,
    fileSizeBytes: doc.size_bytes,
    pdfUrls: pdfUrls.filter((p) => {
      // Associate PDFs with the page that linked to them (rough heuristic)
      try {
        return new URL(p).pathname.startsWith(new URL(doc.source_url).pathname.replace(/\/[^/]*$/, ""));
      } catch {
        return false;
      }
    }),
  }));
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const resume = args.includes("--resume");
  const maxPagesArg = args.find((a) => a.startsWith("--max-pages="));
  const maxPages = maxPagesArg ? parseInt(maxPagesArg.split("=")[1]) : undefined;
  const maxDepthArg = args.find((a) => a.startsWith("--max-depth="));
  const maxDepth = maxDepthArg ? parseInt(maxDepthArg.split("=")[1]) : undefined;
  const townId = args.find((a) => a.startsWith("--town="))?.split("=")[1] || "needham";

  (async () => {
    try {
      await scrape({ townId, resume, maxPages, maxDepth });
    } catch (err) {
      console.error("[scraper] Fatal error:", err);
      process.exit(1);
    }
  })();
}
