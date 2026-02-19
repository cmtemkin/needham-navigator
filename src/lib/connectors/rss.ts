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

function extractTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return match?.[1]?.trim() ?? "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i")
  );
  return match?.[1]?.trim() ?? "";
}

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    // Decode named entities — &amp; must be last to prevent double-decoding
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
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

        return {
          source_id: config.id,
          category: config.category as ContentCategory,
          title: entry.title,
          content,
          published_at: entry.pubDate
            ? new Date(entry.pubDate)
            : new Date(),
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
