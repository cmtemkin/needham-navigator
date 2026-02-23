/**
 * scripts/scrape-events.ts — Events scraper for Needham town calendar
 *
 * Scrapes events from needhamma.gov calendar and civic alerts pages,
 * then upserts them into the content_items table with category='events'.
 *
 * Usage:
 *   npx tsx scripts/scrape-events.ts                # Scrape and store events
 *   npx tsx scripts/scrape-events.ts --dry-run      # Log events without writing to DB
 *   npx tsx scripts/scrape-events.ts --town=needham  # Specify town (default: needham)
 */

import { createHash } from "crypto";
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CALENDAR_URLS = [
  "https://www.needhamma.gov/calendar.aspx",
  "https://www.needhamma.gov/CivicAlerts.aspx",
];

const USER_AGENT =
  "NeedhamNavigator/1.0 (+https://needhamnavigator.com; events scraper)";

const FETCH_TIMEOUT_MS = 30_000;
const CRAWL_DELAY_MS = 1_500;
const SOURCE_ID = "needhamma-calendar";
const SOURCE_NAME = "Town Calendar";
const CATEGORY = "events";
const BASE_URL = "https://www.needhamma.gov";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScrapedEvent {
  title: string;
  description: string;
  date: string; // ISO string
  time: string | null;
  endTime: string | null;
  location: string | null;
  url: string | null;
  sourceUrl: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveUrl(href: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_URL}${href}`;
  return `${BASE_URL}/${href}`;
}

/**
 * Parse a date string from CivicPlus calendar pages.
 * Common formats:
 *   "February 25, 2026"
 *   "02/25/2026"
 *   "2026-02-25"
 *   "Feb 25, 2026 7:00 PM"
 */
function parseEventDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null;
  const cleaned = dateStr.trim();

  // Try native Date parsing first
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try extracting date from combined date/time strings
  // Pattern: "Month DD, YYYY at HH:MM AM/PM"
  const withAt = cleaned.replace(/\s+at\s+/i, " ");
  const parsed2 = new Date(withAt);
  if (!isNaN(parsed2.getTime())) return parsed2;

  return null;
}

/**
 * Extract time string from a date or combined date/time string.
 * Returns something like "7:00 PM" or null.
 */
function extractTime(text: string): string | null {
  if (!text || text.length > 200) return null; // Length limit prevents ReDoS
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s?(?:AM|PM))\b/i);
  if (timeMatch) return timeMatch[1].trim();
  return null;
}

const ALLOWED_HOSTS = new Set(["www.needhamma.gov", "needhamma.gov"]);

async function fetchPage(url: string): Promise<string | null> {
  // Restrict fetching to known municipal domains (prevents SSRF)
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    console.error(`[scrape-events] Blocked fetch to untrusted host: ${parsed.hostname}`);
    return null;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[scrape-events] HTTP ${response.status} for ${url}`
      );
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      console.warn(
        `[scrape-events] Non-HTML response for ${url}: ${contentType}`
      );
      return null;
    }

    return await response.text();
  } catch (err) {
    console.error(`[scrape-events] Fetch failed for ${url}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Calendar page parsers
// ---------------------------------------------------------------------------

/**
 * Parse the CivicPlus calendar page (calendar.aspx).
 *
 * CivicPlus calendar pages can have several HTML structures:
 * - List view: `.calendarList` with rows containing date/title/time
 * - Grid view: table cells with date headers and event links
 * - Detail links: anchors to `/Calendar.aspx?EID=...`
 *
 * We look for all common patterns.
 */
function parseCalendarPage(
  html: string,
  sourceUrl: string
): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seenTitles = new Set<string>();

  // ---- Pattern 1: CivicPlus list view (.calendarList, .calendarListItem) ----
  $(".calendarList .calendarListItem, .calendarListRow, tr.calendarRow").each(
    (_i, el) => {
      const $el = $(el);
      const title =
        $el.find(".calendarTitle, .eventTitle, a").first().text().trim() ||
        $el.find("td:nth-child(2), td:nth-child(3)").first().text().trim();

      if (!title || seenTitles.has(title)) return;

      const dateText =
        $el.find(".calendarDate, .eventDate, td:first-child").text().trim();
      const timeText =
        $el.find(".calendarTime, .eventTime").text().trim() || null;
      const locationText =
        $el.find(".calendarLocation, .eventLocation").text().trim() || null;
      const descText =
        $el.find(".calendarDescription, .eventDescription").text().trim() || "";
      const linkHref =
        $el.find("a").attr("href") || null;

      const date = parseEventDate(dateText);
      if (!date) return;

      seenTitles.add(title);
      events.push({
        title,
        description: descText,
        date: date.toISOString(),
        time: timeText || extractTime(dateText),
        endTime: null,
        location: locationText,
        url: linkHref ? resolveUrl(linkHref) : null,
        sourceUrl,
      });
    }
  );

  // ---- Pattern 2: Calendar detail links (a[href*="Calendar.aspx?EID"]) ----
  $('a[href*="Calendar.aspx?EID"], a[href*="calendar.aspx?EID"]').each(
    (_i, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      if (!title || seenTitles.has(title)) return;

      const href = $a.attr("href") || "";
      // Try to find a date in the parent row or surrounding context
      const $parent = $a.closest("tr, .calendarListItem, .eventItem, div");
      const dateText = $parent
        .find(
          ".calendarDate, .eventDate, td:first-child, .date, [class*='date']"
        )
        .text()
        .trim();
      const date = parseEventDate(dateText);
      if (!date) return;

      seenTitles.add(title);
      events.push({
        title,
        description: "",
        date: date.toISOString(),
        time: extractTime(dateText),
        endTime: null,
        location: null,
        url: resolveUrl(href),
        sourceUrl,
      });
    }
  );

  // ---- Pattern 3: CivicPlus grid/table calendar ----
  $("table.calendarTable td, .calendarGrid .calendarDay").each((_i, el) => {
    const $cell = $(el);
    const dateHeader = $cell
      .find(".calendarDayHeader, .dayNumber, .calendarDayNum")
      .text()
      .trim();

    $cell.find("a, .calendarEvent, .eventLink").each((_j, eventEl) => {
      const $event = $(eventEl);
      const title = $event.text().trim();
      if (!title || seenTitles.has(title)) return;

      // Combine dateHeader with month/year context if available
      const monthYear = $("h2.calendarTitle, .calendarMonthTitle, .monthHeader")
        .first()
        .text()
        .trim();
      const dateStr = dateHeader && monthYear
        ? `${monthYear} ${dateHeader}`
        : dateHeader;
      const date = parseEventDate(dateStr);
      if (!date) return;

      const href = $event.attr("href") || "";
      seenTitles.add(title);
      events.push({
        title,
        description: "",
        date: date.toISOString(),
        time: null,
        endTime: null,
        location: null,
        url: href ? resolveUrl(href) : null,
        sourceUrl,
      });
    });
  });

  // ---- Pattern 4: Generic event-like structures ----
  $(
    ".eventItem, .event-card, .event-listing, [class*='event-row'], [class*='eventRow']"
  ).each((_i, el) => {
    const $el = $(el);
    const title = $el
      .find("h2, h3, h4, .event-title, .eventTitle, a")
      .first()
      .text()
      .trim();
    if (!title || seenTitles.has(title)) return;

    const dateText = $el
      .find(
        ".event-date, .eventDate, time, [datetime], [class*='date']"
      )
      .text()
      .trim();
    const date = parseEventDate(dateText);
    if (!date) return;

    const desc = $el
      .find(".event-description, .eventDescription, p")
      .first()
      .text()
      .trim();
    const loc = $el
      .find(".event-location, .eventLocation, [class*='location']")
      .text()
      .trim();
    const href = $el.find("a").attr("href") || "";

    seenTitles.add(title);
    events.push({
      title,
      description: desc || "",
      date: date.toISOString(),
      time: extractTime(dateText),
      endTime: null,
      location: loc || null,
      url: href ? resolveUrl(href) : null,
      sourceUrl,
    });
  });

  return events;
}

/**
 * Parse the CivicAlerts page (CivicAlerts.aspx).
 *
 * CivicAlerts are town announcements/alerts. They have a different
 * structure than the calendar: each alert is typically a card/row
 * with a title, date, and summary.
 */
function parseAlertsPage(
  html: string,
  sourceUrl: string
): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seenTitles = new Set<string>();

  // ---- Pattern 1: CivicAlerts list items ----
  $(
    ".alertItem, .civicAlert, .alertListItem, .alert-card, [class*='alertRow']"
  ).each((_i, el) => {
    const $el = $(el);
    const title = $el
      .find("h2, h3, h4, .alertTitle, .alert-title, a")
      .first()
      .text()
      .trim();
    if (!title || seenTitles.has(title)) return;

    const dateText = $el
      .find(".alertDate, .alert-date, time, [class*='date']")
      .text()
      .trim();
    const date = parseEventDate(dateText);
    if (!date) return;

    const desc = $el
      .find(".alertDescription, .alert-description, p")
      .first()
      .text()
      .trim();
    const href = $el.find("a").attr("href") || "";

    seenTitles.add(title);
    events.push({
      title,
      description: desc || "",
      date: date.toISOString(),
      time: null,
      endTime: null,
      location: null,
      url: href ? resolveUrl(href) : null,
      sourceUrl,
    });
  });

  // ---- Pattern 2: Alert detail links ----
  $(
    'a[href*="CivicAlerts.aspx?AID"], a[href*="civicalerts.aspx?AID"]'
  ).each((_i, el) => {
    const $a = $(el);
    const title = $a.text().trim();
    if (!title || seenTitles.has(title)) return;

    const $parent = $a.closest("tr, div, li, .alertItem");
    const dateText = $parent
      .find("[class*='date'], td:first-child, time")
      .text()
      .trim();
    const date = parseEventDate(dateText);
    // For alerts, if no date found, use today
    const eventDate = date || new Date();

    const href = $a.attr("href") || "";
    seenTitles.add(title);
    events.push({
      title,
      description: "",
      date: eventDate.toISOString(),
      time: null,
      endTime: null,
      location: null,
      url: href ? resolveUrl(href) : null,
      sourceUrl,
    });
  });

  // ---- Pattern 3: Generic list with dates ----
  $("ul.list li, .listItem, .news-item").each((_i, el) => {
    const $el = $(el);
    const title = $el.find("a, h3, h4").first().text().trim();
    if (!title || seenTitles.has(title)) return;

    const dateText = $el
      .find(".date, time, [class*='date']")
      .text()
      .trim();
    const date = parseEventDate(dateText);
    if (!date) return;

    const href = $el.find("a").attr("href") || "";
    seenTitles.add(title);
    events.push({
      title,
      description: "",
      date: date.toISOString(),
      time: null,
      endTime: null,
      location: null,
      url: href ? resolveUrl(href) : null,
      sourceUrl,
    });
  });

  return events;
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error(
      "[scrape-events] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
    process.exit(1);
  }

  return createClient(url, key);
}

async function upsertEvents(
  supabase: SupabaseClient,
  events: ScrapedEvent[],
  townId: string
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;

  for (const event of events) {
    const contentForHash = `${event.title}|${event.date}|${event.description}`;
    const contentHash = hashContent(contentForHash);

    // Build metadata object
    const metadata: Record<string, string> = {
      source_name: SOURCE_NAME,
    };
    if (event.location) metadata.event_location = event.location;
    if (event.time) {
      // Combine date + time for event_start
      const baseDate = new Date(event.date);
      const timeStr = event.time;
      const combined = `${baseDate.toISOString().split("T")[0]} ${timeStr}`;
      const startDate = parseEventDate(combined);
      if (startDate) {
        metadata.event_start = startDate.toISOString();
      } else {
        metadata.event_start = event.date;
      }
    } else {
      metadata.event_start = event.date;
    }
    if (event.endTime) {
      metadata.event_end = event.endTime;
    }

    const row = {
      town_id: townId,
      source_id: SOURCE_ID,
      category: CATEGORY,
      title: event.title,
      content: event.description || null,
      summary: null,
      published_at: event.date,
      expires_at: null,
      url: event.url,
      image_url: null,
      metadata,
      content_hash: contentHash,
      embedding: null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("content_items")
      .upsert(row, {
        onConflict: "town_id,source_id,content_hash",
        ignoreDuplicates: false,
      });

    if (error) {
      if (error.code === "23505") {
        // Duplicate — content unchanged
        skipped++;
      } else {
        console.error(
          `[scrape-events] Upsert error for "${event.title}": ${error.message}`
        );
        skipped++;
      }
    } else {
      upserted++;
    }
  }

  return { upserted, skipped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const townId =
    args.find((a) => a.startsWith("--town="))?.split("=")[1] || "needham";

  const startTime = Date.now();

  console.log("=".repeat(60));
  console.log(`[scrape-events] Starting events scrape for ${townId}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  URLs: ${CALENDAR_URLS.join(", ")}`);
  console.log("=".repeat(60));

  const allEvents: ScrapedEvent[] = [];

  for (const url of CALENDAR_URLS) {
    console.log(`\n[scrape-events] Fetching: ${url}`);
    const html = await fetchPage(url);

    if (!html) {
      console.warn(`[scrape-events] Skipping ${url} — no HTML returned`);
      continue;
    }

    console.log(
      `[scrape-events] Got ${html.length} bytes from ${url}`
    );

    // Choose parser based on URL
    const isAlerts = url.toLowerCase().includes("civicalerts");
    const events = isAlerts
      ? parseAlertsPage(html, url)
      : parseCalendarPage(html, url);

    console.log(
      `[scrape-events] Parsed ${events.length} events from ${url}`
    );
    allEvents.push(...events);

    // Respect crawl delay between pages
    await sleep(CRAWL_DELAY_MS);
  }

  // Deduplicate by title (in case both pages list the same event)
  const uniqueEvents = deduplicateEvents(allEvents);

  console.log(
    `\n[scrape-events] Total unique events: ${uniqueEvents.length}`
  );

  if (dryRun) {
    console.log("\n--- DRY RUN: Events found ---\n");
    for (const event of uniqueEvents) {
      console.log(`  Title:    ${event.title}`);
      console.log(
        `  Date:     ${new Date(event.date).toLocaleDateString()}`
      );
      if (event.time) console.log(`  Time:     ${event.time}`);
      if (event.location) console.log(`  Location: ${event.location}`);
      if (event.url) console.log(`  URL:      ${event.url}`);
      if (event.description)
        console.log(`  Desc:     ${event.description.slice(0, 120)}...`);
      console.log();
    }
    console.log("[scrape-events] Dry run complete — no database writes.");
  } else {
    const supabase = getSupabase();
    const { upserted, skipped } = await upsertEvents(
      supabase,
      uniqueEvents,
      townId
    );

    console.log(
      `\n[scrape-events] Upserted: ${upserted}, Skipped: ${skipped}`
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("=".repeat(60));
  console.log(`[scrape-events] Done in ${duration}s`);
  console.log("=".repeat(60));
}

/**
 * Remove duplicate events by title (case-insensitive).
 * Keeps the first occurrence (which has more detail from the calendar page).
 */
function deduplicateEvents(events: ScrapedEvent[]): ScrapedEvent[] {
  const seen = new Set<string>();
  const unique: ScrapedEvent[] = [];

  for (const event of events) {
    const key = event.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
  }

  return unique;
}

main().catch((err) => {
  console.error("[scrape-events] Fatal error:", err);
  process.exit(1);
});
