"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import type { EventItem } from "./CalendarView";

function formatGCalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateGoogleCalendarUrl(event: EventItem): string {
  const start = event.metadata?.event_start || event.published_at;
  const end = event.metadata?.event_end || start;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatGCalDate(start)}/${formatGCalDate(end)}`,
    location: event.metadata?.event_location || "",
    details: (event.summary || event.content?.slice(0, 500) || "") + (event.url ? `\n\n${event.url}` : ""),
  });

  return `https://calendar.google.com/calendar/event?${params.toString()}`;
}

function formatICalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateIcsContent(event: EventItem): string {
  const start = event.metadata?.event_start || event.published_at;
  const end = event.metadata?.event_end || start;
  const description = (event.summary || event.content?.slice(0, 500) || "")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NeedhamNavigator//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTART:${formatICalDate(start)}`,
    `DTEND:${formatICalDate(end)}`,
    `SUMMARY:${event.title.replace(/,/g, "\\,").replace(/;/g, "\\;")}`,
    `LOCATION:${(event.metadata?.event_location || "").replace(/,/g, "\\,").replace(/;/g, "\\;")}`,
    `DESCRIPTION:${description}`,
  ];

  if (event.url) {
    lines.push(`URL:${event.url}`);
  }

  lines.push(
    `UID:${event.id}@needhamnavigator.com`,
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.join("\r\n");
}

function downloadIcs(event: EventItem) {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface AddToCalendarProps {
  event: EventItem;
}

export function AddToCalendar({ event }: Readonly<AddToCalendarProps>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-text-secondary border border-border-default rounded-lg hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
      >
        <CalendarPlus size={13} />
        Add to Calendar
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-border-default rounded-lg shadow-lg z-50 min-w-[180px]">
          <a
            href={generateGoogleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
          >
            Google Calendar
          </a>
          <button
            onClick={() => {
              downloadIcs(event);
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors"
          >
            Apple Calendar / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
