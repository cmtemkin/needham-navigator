/**
 * src/lib/connectors/ical.ts — Generic iCal/ICS feed connector
 *
 * Fetches and parses iCal feeds (VCALENDAR/VEVENT). Config-driven: just
 * provide a feed URL and the connector handles parsing, normalization, and dedup.
 *
 * Config shape:
 *   { feedUrl: string, sourceName?: string, daysAhead?: number }
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
// iCal parsing (lightweight, no dependencies)
// ---------------------------------------------------------------------------

interface ICalEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  location: string;
  url: string;
}

function parseICalFeed(icsText: string): ICalEvent[] {
  const events: ICalEvent[] = [];

  // Split into VEVENT blocks
  const eventBlocks = icsText.split("BEGIN:VEVENT");

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];

    events.push({
      uid: extractICalProp(block, "UID"),
      summary: unfoldICalText(extractICalProp(block, "SUMMARY")),
      description: unfoldICalText(extractICalProp(block, "DESCRIPTION")),
      dtstart: extractICalDate(block, "DTSTART"),
      dtend: extractICalDate(block, "DTEND"),
      location: unfoldICalText(extractICalProp(block, "LOCATION")),
      url: extractICalProp(block, "URL"),
    });
  }

  return events;
}

function extractICalProp(block: string, prop: string): string {
  // iCal properties can have parameters like DTSTART;VALUE=DATE:20260101
  const regex = new RegExp(`^${prop}[;:](.*)$`, "im");
  const match = block.match(regex);
  if (!match) return "";

  let value = match[1];
  // Remove parameters (everything before the last colon in cases like ;VALUE=DATE:20260101)
  if (prop !== "URL" && value.includes(":")) {
    // Only split on colon for non-URL properties
    const parts = value.split(":");
    value = parts[parts.length - 1];
  }

  return value.trim();
}

function extractICalDate(block: string, prop: string): string {
  // Handle both DTSTART:20260101T120000Z and DTSTART;VALUE=DATE:20260101
  const regex = new RegExp(`^${prop}[^:]*:(.*)$`, "im");
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
}

function unfoldICalText(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseICalDateTime(dtStr: string): Date {
  if (!dtStr) return new Date();

  // Format: 20260101T120000Z or 20260101
  if (dtStr.length === 8) {
    // Date only: YYYYMMDD
    const y = dtStr.slice(0, 4);
    const m = dtStr.slice(4, 6);
    const d = dtStr.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00Z`);
  }

  // Full datetime: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const y = dtStr.slice(0, 4);
  const m = dtStr.slice(4, 6);
  const d = dtStr.slice(6, 8);
  const h = dtStr.slice(9, 11) || "00";
  const min = dtStr.slice(11, 13) || "00";
  const s = dtStr.slice(13, 15) || "00";
  const tz = dtStr.endsWith("Z") ? "Z" : "";

  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}${tz}`);
}

// ---------------------------------------------------------------------------
// iCal Connector
// ---------------------------------------------------------------------------

export function createICalConnector(
  townId: string,
  config: ConnectorConfig
): SourceConnector {
  const feedUrl = config.config.feedUrl as string;
  const sourceName = (config.config.sourceName as string) ?? config.id;
  const daysAhead = (config.config.daysAhead as number) ?? 90;

  if (!feedUrl) {
    throw new Error(`iCal connector "${config.id}" missing feedUrl in config`);
  }

  return {
    id: config.id,
    type: "ical",
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
          `iCal fetch failed for ${feedUrl}: ${response.status} ${response.statusText}`
        );
      }

      const icsText = await response.text();
      const events = parseICalFeed(icsText);

      // Filter to events within the lookahead window
      const now = new Date();
      const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      return events
        .filter((e) => {
          if (!e.dtstart) return false;
          const start = parseICalDateTime(e.dtstart);
          return start >= now && start <= cutoff;
        })
        .map((e) => ({ ...e } as unknown as RawItem));
    },

    normalize(raw: RawItem[]): ContentItem[] {
      return raw.map((item) => {
        const event = item as unknown as ICalEvent;
        const start = parseICalDateTime(event.dtstart);
        const end = event.dtend
          ? parseICalDateTime(event.dtend)
          : undefined;

        const contentParts = [event.description];
        if (event.location) contentParts.push(`Location: ${event.location}`);
        const content = contentParts.filter(Boolean).join("\n\n");

        const hash = createHash("sha256")
          .update(event.uid || `${event.summary}-${event.dtstart}`)
          .digest("hex");

        return {
          source_id: config.id,
          category: config.category as ContentCategory,
          title: event.summary || "Untitled Event",
          content,
          published_at: start,
          expires_at: end,
          url: event.url || undefined,
          metadata: {
            source_name: sourceName,
            event_location: event.location || undefined,
            event_start: start.toISOString(),
            event_end: end?.toISOString(),
          },
          content_hash: hash,
        };
      });
    },
  };
}
