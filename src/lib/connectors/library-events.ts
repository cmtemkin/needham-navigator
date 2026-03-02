/**
 * src/lib/connectors/library-events.ts — Needham Public Library event scraper
 *
 * Fetches events from the Assabet Interactive calendar at
 * needhamma.assabetinteractive.com/calendar/ by extracting JSON-LD
 * <script type="application/ld+json"> blocks with Schema.org Event markup.
 *
 * Config shape:
 *   {
 *     baseUrl: string,       // Calendar base URL (default: assabetinteractive URL)
 *     sourceName?: string,   // Display name (default: "Needham Public Library")
 *     daysAhead?: number,    // How far ahead to fetch events (default: 90)
 *   }
 */

import { createHash } from "crypto";
import * as cheerio from "cheerio";
import type {
  ConnectorConfig,
  ContentCategory,
  ContentItem,
  RawItem,
  SourceConnector,
} from "./types";

// ---------------------------------------------------------------------------
// Schema.org Event shape (subset we use)
// ---------------------------------------------------------------------------

interface SchemaEvent {
  "@type": string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  location?: SchemaPlace | string;
}

interface SchemaPlace {
  "@type"?: string;
  name?: string;
  address?: SchemaAddress | string;
}

interface SchemaAddress {
  "@type"?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

// ---------------------------------------------------------------------------
// JSON-LD extraction
// ---------------------------------------------------------------------------

function extractEventsFromHtml(html: string): SchemaEvent[] {
  const $ = cheerio.load(html);
  const events: SchemaEvent[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = JSON.parse($(el).html() ?? "");
      const items: unknown[] = Array.isArray(raw) ? raw : [raw];

      for (const item of items) {
        if (
          item &&
          typeof item === "object" &&
          (item as SchemaEvent)["@type"] === "Event"
        ) {
          events.push(item as SchemaEvent);
        }
      }
    } catch {
      // Malformed JSON-LD, skip this block
    }
  });

  return events;
}

function formatLocation(location: SchemaPlace | string | undefined): string | undefined {
  if (!location) return undefined;
  if (typeof location === "string") return location;

  const parts: string[] = [];
  if (location.name) parts.push(location.name);

  if (location.address && typeof location.address === "object") {
    const addr = location.address as SchemaAddress;
    if (addr.streetAddress) parts.push(addr.streetAddress);
    if (addr.addressLocality) parts.push(addr.addressLocality);
  } else if (typeof location.address === "string") {
    parts.push(location.address);
  }

  return parts.length ? parts.join(", ") : undefined;
}

// ---------------------------------------------------------------------------
// Month URL builder
// ---------------------------------------------------------------------------

function buildMonthUrls(baseUrl: string, monthCount: number): string[] {
  const urls: string[] = [];
  const now = new Date();

  for (let i = 0; i < monthCount; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");

    if (i === 0) {
      // Current month — base URL (no query param needed for first month)
      urls.push(baseUrl);
    } else {
      const sep = baseUrl.includes("?") ? "&" : "?";
      urls.push(`${baseUrl}${sep}month=${yyyy}-${mm}`);
    }
  }

  return urls;
}

// ---------------------------------------------------------------------------
// Library Events Connector
// ---------------------------------------------------------------------------

export function createLibraryEventsConnector(
  townId: string,
  config: ConnectorConfig
): SourceConnector {
  const baseUrl =
    (config.config.baseUrl as string) ??
    "https://needhamma.assabetinteractive.com/calendar/";
  const sourceName =
    (config.config.sourceName as string) ?? "Needham Public Library";
  const daysAhead = (config.config.daysAhead as number) ?? 90;

  // Fetch 3 months (current + next 2) to cover the full daysAhead window
  const monthCount = Math.ceil(daysAhead / 30) < 3 ? 3 : Math.ceil(daysAhead / 30);

  return {
    id: config.id,
    type: "scrape",
    category: config.category as ContentCategory,
    schedule: config.schedule,
    townId,
    shouldEmbed: config.shouldEmbed,

    async fetch(): Promise<RawItem[]> {
      const monthUrls = buildMonthUrls(baseUrl, monthCount);
      const allEvents: SchemaEvent[] = [];
      const seenKeys = new Set<string>();

      for (const url of monthUrls) {
        try {
          const response = await fetch(url, {
            headers: { "User-Agent": "CommunityNavigator/1.0" },
            signal: AbortSignal.timeout(20_000),
          });

          if (!response.ok) continue;

          const html = await response.text();
          const events = extractEventsFromHtml(html);

          for (const event of events) {
            // Dedup across pages by name + startDate
            const key = `${event.name ?? ""}|${event.startDate ?? ""}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allEvents.push(event);
            }
          }

          // Polite delay between page fetches
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch {
          // Failed to fetch one month — continue to next
        }
      }

      // Filter to events within the lookahead window
      const now = new Date();
      const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      return allEvents
        .filter((event) => {
          if (!event.startDate) return false;
          try {
            const start = new Date(event.startDate);
            return start >= now && start <= cutoff;
          } catch {
            return false;
          }
        })
        .map((event) => ({ ...event } as unknown as RawItem));
    },

    normalize(raw: RawItem[]): ContentItem[] {
      return raw
        .map((item) => {
          const event = item as unknown as SchemaEvent;

          if (!event.name || !event.startDate) return null;

          let start: Date;
          try {
            start = new Date(event.startDate);
            if (isNaN(start.getTime())) return null;
          } catch {
            return null;
          }

          let end: Date | undefined;
          if (event.endDate) {
            try {
              const parsed = new Date(event.endDate);
              if (!isNaN(parsed.getTime())) end = parsed;
            } catch {
              // No valid end date
            }
          }

          const locationStr = formatLocation(event.location);

          const contentParts: string[] = [];
          if (event.description) contentParts.push(event.description);
          if (locationStr) contentParts.push(`Location: ${locationStr}`);
          const content = contentParts.join("\n\n") || event.name;

          const hash = createHash("sha256")
            .update(`${event.name}|${event.startDate}`)
            .digest("hex");

          return {
            source_id: config.id,
            category: config.category as ContentCategory,
            title: event.name,
            content,
            published_at: start,
            expires_at: end ?? start,
            url: event.url || undefined,
            metadata: {
              source_name: sourceName,
              event_start: start.toISOString(),
              event_end: end?.toISOString(),
              event_location: locationStr,
            },
            content_hash: hash,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null) as ContentItem[];
    },
  };
}
