"use client";

import { Clock, MapPin, ExternalLink } from "lucide-react";
import { AddToCalendar } from "./AddToCalendar";
import type { EventItem } from "./CalendarView";
import { formatEasternTime, EASTERN_TZ } from "@/lib/timezone";

export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EventRow({
  event,
  getSourceColor,
}: Readonly<{
  event: EventItem;
  getSourceColor: (sourceId: string) => { bg: string; text: string; dot: string; label: string };
}>) {
  const start = event.metadata?.event_start
    ? new Date(event.metadata.event_start)
    : new Date(event.published_at);
  const eventEndStr = event.metadata?.event_end;
  const end = eventEndStr ? new Date(eventEndStr) : null;
  const source = getSourceColor(event.source_id);

  return (
    <div className="group bg-white border border-border-default rounded-lg hover:border-[var(--primary)] hover:shadow-sm transition-all p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Date badge */}
        <div className="flex shrink-0 items-center gap-2 w-fit">
          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <span className="text-[10px] font-semibold uppercase leading-tight">
              {start.toLocaleDateString("en-US", { month: "short" })}
            </span>
            <span className="text-lg font-bold leading-tight -mt-0.5">
              {start.getDate()}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${source.bg} ${source.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${source.dot}`} />
              {source.label}
            </span>
          </div>

          <h3 className="font-bold text-text-primary group-hover:text-[var(--primary)] transition-colors mb-1.5 text-base">
            {event.url ? (
              <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {event.title}
              </a>
            ) : (
              event.title
            )}
          </h3>

          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="shrink-0 text-text-muted" />
              <span>
                {formatEventDate(event.metadata?.event_start || event.published_at)}
                {event.metadata?.event_start && (
                  <> at {formatEasternTime(event.metadata.event_start)}</>
                )}
                {end && eventEndStr && <>{" – "}{formatEasternTime(eventEndStr)}</>}
              </span>
            </div>
            {event.metadata?.event_location && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-text-muted" />
                <span>{event.metadata.event_location}</span>
              </div>
            )}
          </div>

          {(event.summary || event.content) && (
            <p className="mt-2 line-clamp-2 text-sm text-text-secondary leading-relaxed">
              {event.summary || event.content?.slice(0, 200)}
            </p>
          )}

          <div className="flex items-center gap-3 mt-3">
            <AddToCalendar event={event} />
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
              >
                View details <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
