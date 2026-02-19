/**
 * src/lib/connectors/scraper.ts — Generic web scraper connector
 *
 * Config-driven web scraper that uses cheerio + readability to extract
 * content from any website. Suitable for news sites, blogs, and other
 * content pages.
 *
 * Config shape:
 *   {
 *     url: string,                 // Base URL to scrape
 *     sourceName?: string,         // Display name
 *     articleSelector?: string,    // CSS selector for article links (default: "a")
 *     articleUrlPattern?: string,  // Regex pattern to filter article URLs
 *     maxPages?: number,           // Max pages to scrape per run (default: 20)
 *     maxDepth?: number,           // Max crawl depth (default: 1)
 *   }
 */

import { createHash } from "crypto";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import type {
  ConnectorConfig,
  ContentCategory,
  ContentItem,
  RawItem,
  SourceConnector,
} from "./types";

// ---------------------------------------------------------------------------
// Turndown instance (reusable)
// ---------------------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// ---------------------------------------------------------------------------
// Content extraction
// ---------------------------------------------------------------------------

interface ExtractedPage {
  url: string;
  title: string;
  content: string;
  publishedDate?: string;
  image?: string;
}

async function extractPage(url: string): Promise<ExtractedPage | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CommunityNavigator/1.0" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent?.trim()) return null;

    const markdown = turndown.turndown(article.content ?? "");

    // Try to find published date from meta tags
    const $ = cheerio.load(html);
    const publishedDate =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $('time[datetime]').first().attr("datetime") ||
      undefined;

    // Try to find image
    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      undefined;

    return {
      url,
      title: article.title || $("title").text() || url,
      content: markdown,
      publishedDate,
      image: image ? new URL(image, url).href : undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Link discovery
// ---------------------------------------------------------------------------

async function discoverLinks(
  baseUrl: string,
  articleSelector: string,
  urlPattern?: RegExp,
  maxLinks: number = 20
): Promise<string[]> {
  try {
    const response = await fetch(baseUrl, {
      headers: { "User-Agent": "CommunityNavigator/1.0" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const links: string[] = [];
    const seen = new Set<string>();

    $(articleSelector).each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      try {
        const parsedUrl = new URL(href, baseUrl);
        // Only allow http/https URLs (blocks javascript:, data:, vbscript:, etc.)
        const allowedProtocols = new Set(["http:", "https:"]);
        if (!allowedProtocols.has(parsedUrl.protocol)) {
          return;
        }
        const resolved = parsedUrl.href;
        // Skip fragment-only links
        if (resolved.includes("#")) {
          return;
        }

        // Apply URL pattern filter
        if (urlPattern && !urlPattern.test(resolved)) return;

        if (!seen.has(resolved) && links.length < maxLinks) {
          seen.add(resolved);
          links.push(resolved);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return links;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Scraper Connector
// ---------------------------------------------------------------------------

export function createScraperConnector(
  townId: string,
  config: ConnectorConfig
): SourceConnector {
  const baseUrl = config.config.url as string;
  const sourceName = (config.config.sourceName as string) ?? config.id;
  const articleSelector =
    (config.config.articleSelector as string) ?? "a[href]";
  const urlPatternStr = config.config.articleUrlPattern as string | undefined;
  const urlPattern = urlPatternStr ? new RegExp(urlPatternStr) : undefined;
  const maxPages = (config.config.maxPages as number) ?? 20;

  if (!baseUrl) {
    throw new Error(`Scraper connector "${config.id}" missing url in config`);
  }

  return {
    id: config.id,
    type: "scrape",
    category: config.category as ContentCategory,
    schedule: config.schedule,
    townId,
    shouldEmbed: config.shouldEmbed,

    async fetch(): Promise<RawItem[]> {
      // Discover article links from the base URL
      const links = await discoverLinks(
        baseUrl,
        articleSelector,
        urlPattern,
        maxPages
      );

      // Extract content from each link
      const results: RawItem[] = [];
      for (const link of links) {
        const page = await extractPage(link);
        if (page) {
          results.push(page as unknown as RawItem);
        }
        // Polite crawling delay
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return results;
    },

    normalize(raw: RawItem[]): ContentItem[] {
      return raw
        .map((item) => {
          const page = item as unknown as ExtractedPage;
          if (!page.content || page.content.length < 50) return null;

          const hash = createHash("sha256")
            .update(page.url)
            .digest("hex");

          return {
            source_id: config.id,
            category: config.category as ContentCategory,
            title: page.title,
            content: page.content,
            published_at: page.publishedDate
              ? new Date(page.publishedDate)
              : new Date(),
            url: page.url,
            image_url: page.image,
            metadata: {
              source_name: sourceName,
              source_url: baseUrl,
            },
            content_hash: hash,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) as ContentItem[];
    },
  };
}
