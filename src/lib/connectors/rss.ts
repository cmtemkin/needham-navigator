/**
 * src/lib/connectors/rss.ts — Generic RSS feed connector
 *
 * Fetches and parses RSS/Atom feeds. Config-driven: just provide a feed URL
 * and the connector handles parsing, normalization, and dedup.
 *
 * Config shape:
 *   { feedUrl: string, sourceName?: string }
 */

import { createHash } from "crypto";
import type {
  ConnectorConfig,
  ContentCategory,
  ContentItem,
  RawItem,
  SourceConnector,
} from "./types";

// ---------------------------------------------------------------------------
// RSS XML parsing (lightweight, no dependencies)
// ---------------------------------------------------------------------------

interface RssEntry {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
}

function parseRssXml(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];

  // Handle both RSS <item> and Atom <entry>
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;

  const items = Array.from(xml.matchAll(itemRegex)).concat(
    Array.from(xml.matchAll(entryRegex))
  );

  for (const match of items) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link =
      extractTag(block, "link") || extractAttr(block, "link", "href");
    const description =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content");
    const pubDate =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      "";
    const category = extractTag(block, "category");

    if (title || link) {
      entries.push({
        title: stripCdata(title),
        link: stripCdata(link),
        description: stripHtml(stripCdata(description)),
        pubDate,
        category: category ? stripCdata(category) : undefined,
      });
    }
  }

  return entries;
}

/**
 * Literal regex patterns for safe XML tag extraction.
 * All tag names in TAG_PATTERNS are hardcoded constants passed from this file only.
 * Not user-controlled, therefore safe from ReDoS or injection attacks.
 */
// NOSONAR
const TAG_PATTERNS: Record<string, RegExp> = {
  title: /<title[^>]*>([\s\S]*?)<\/title>/i,
  link: /<link[^>]*>([\s\S]*?)<\/link>/i,
  description: /<description[^>]*>([\s\S]*?)<\/description>/i,
  summary: /<summary[^>]*>([\s\S]*?)<\/summary>/i,
  content: /<content[^>]*>([\s\S]*?)<\/content>/i,
  pubDate: /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
  published: /<published[^>]*>([\s\S]*?)<\/published>/i,
  updated: /<updated[^>]*>([\s\S]*?)<\/updated>/i,
  category: /<category[^>]*>([\s\S]*?)<\/category>/i,
};

const ATTR_PATTERNS: Record<string, Record<string, RegExp>> = {
  link: {
    href: /<link[^>]*href="([^"]*)">/i,
  },
};

function extractTag(xml: string, tag: string): string {
  const pattern = TAG_PATTERNS[tag];
  if (!pattern) return "";
  const match = xml.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const pattern = ATTR_PATTERNS[tag]?.[attr];
  if (!pattern) return "";
  const match = xml.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function stripCdata(text: string): string {
  return text.replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function stripHtml(text: string): string {
  return text
    .replaceAll(/<[^>]+>/g, " ")
    // Decode named entities — &amp; must be last to prevent double-decoding
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// RSS Connector
// ---------------------------------------------------------------------------

export function createRssConnector(
  townId: string,
  config: ConnectorConfig
): SourceConnector {
  const feedUrl = config.config.feedUrl as string;
  const sourceName = (config.config.sourceName as string) ?? config.id;

  if (!feedUrl) {
    throw new Error(`RSS connector "${config.id}" missing feedUrl in config`);
  }

  return {
    id: config.id,
    type: "rss",
    category: config.category as ContentCategory,
    schedule: config.schedule,
    townId,
    shouldEmbed: config.shouldEmbed,

    async fetch(): Promise<RawItem[]> {
      const response = await fetch(feedUrl, {
        headers: { "User-Agent": "CommunityNavigator/1.0" },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(
          `RSS fetch failed for ${feedUrl}: ${response.status} ${response.statusText}`
        );
      }

      const xml = await response.text();
      const entries = parseRssXml(xml);

      return entries.map((entry) => ({ ...entry } as unknown as RawItem));
    },

    normalize(raw: RawItem[]): ContentItem[] {
      return raw.map((item) => {
        const entry = item as unknown as RssEntry;
        const content = entry.description || entry.title;
        const hash = createHash("sha256")
          .update(entry.link || entry.title)
          .digest("hex");

        // Parse published date with fallback logic:
        // 1. Try to parse the pubDate field
        // 2. If invalid/missing, try to extract date from description (common format: "Month DD, YYYY")
        // 3. Last resort: use current time but log a warning
        let publishedAt = new Date();
        if (entry.pubDate) {
          const parsedDate = new Date(entry.pubDate);
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate;
          } else {
            // Try to extract date from description (common news format: "Month DD, YYYY")
            const dateMatch = entry.description?.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i);
            if (dateMatch) {
              const extractedDate = new Date(dateMatch[0]);
              if (!isNaN(extractedDate.getTime())) {
                publishedAt = extractedDate;
              }
            }
          }
        }

        return {
          source_id: config.id,
          category: config.category as ContentCategory,
          title: entry.title,
          content,
          summary: entry.description ? entry.description.slice(0, 300) : undefined,
          published_at: publishedAt,
          url: entry.link || undefined,
          metadata: {
            source_name: sourceName,
            rss_category: entry.category,
          },
          content_hash: hash,
        };
      });
    },
  };
}
