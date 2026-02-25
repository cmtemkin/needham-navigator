/**
 * /api/events/ics — Combined iCal feed for calendar subscriptions
 *
 * Returns a VCALENDAR with all events for the next 90 days.
 * Residents can add this URL to Google Calendar, Apple Calendar,
 * or Outlook for live-syncing Needham events.
 *
 * GET /api/events/ics?town=needham
 */

import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID } from "@/lib/towns";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  url: string | null;
  published_at: string;
  metadata: {
    event_start?: string;
    event_end?: string;
    event_location?: string;
    source_name?: string;
  };
}

function escapeICalText(text: string): string {
  // Escape backslash first, then other special chars
  // Use string literals (not regex) for CodeQL sanitization tracking
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function toICalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateVCalendar(events: EventRow[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NeedhamNavigator//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Needham Navigator Events",
    "X-WR-TIMEZONE:America/New_York",
  ];

  for (const event of events) {
    const start = event.metadata?.event_start || event.published_at;
    const end = event.metadata?.event_end || start;
    const description = escapeICalText(
      (event.summary || event.content?.slice(0, 500) || "") +
        (event.url ? `\\n\\nDetails: ${event.url}` : ""),
    );

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@needhamnavigator.com`,
      `DTSTART:${toICalDate(start)}`,
      `DTEND:${toICalDate(end)}`,
      `SUMMARY:${escapeICalText(event.title)}`,
      `DESCRIPTION:${description}`,
    );

    if (event.metadata?.event_location) {
      lines.push(`LOCATION:${escapeICalText(event.metadata.event_location)}`);
    }

    if (event.url) {
      lines.push(`URL:${event.url}`);
    }

    const source = event.metadata?.source_name;
    if (source) {
      lines.push(`CATEGORIES:${escapeICalText(source)}`);
    }

    lines.push(
      `DTSTAMP:${toICalDate(new Date().toISOString())}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function GET(request: NextRequest): Promise<Response> {
  const townId = request.nextUrl.searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;

  try {
    const supabase = getSupabaseClient({ townId });

    // Fetch events for the next 90 days + past 7 days (for recently added events)
    const pastCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("content_items")
      .select("id, title, content, summary, url, published_at, metadata")
      .eq("town_id", townId)
      .eq("category", "events")
      .gte("published_at", pastCutoff)
      .order("published_at", { ascending: true })
      .limit(500);

    if (error) throw new Error(error.message);

    const ics = generateVCalendar((data ?? []) as EventRow[]);

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="needham-events.ics"',
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate calendar feed";
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
