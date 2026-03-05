"use client";

import { Calendar } from "lucide-react";
import { EventRow } from "./EventRow";
import type { EventItem } from "./CalendarView";

interface EventDetailPanelProps {
  date?: Date;
  events: EventItem[];
  getSourceColor: (sourceId: string) => { bg: string; text: string; dot: string; label: string };
  isListView?: boolean;
}

export function EventDetailPanel({
  date,
  events,
  getSourceColor,
  isListView = false,
}: Readonly<EventDetailPanelProps>) {
  if (events.length === 0 && date) {
    return (
      <div className="mt-4 bg-white border border-border-default rounded-xl p-8 text-center">
        <Calendar size={32} className="mx-auto text-text-muted mb-2 opacity-40" />
        <p className="text-sm text-text-secondary">
          No events on {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className={isListView ? "" : "mt-4"}>
      {date && !isListView && (
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Calendar size={15} className="text-[var(--primary)]" />
          {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          <span className="text-text-muted font-normal">({events.length} event{events.length === 1 ? "" : "s"})</span>
        </h3>
      )}
      <div className="space-y-3">
        {events.map((event) => (
          <EventRow key={event.id} event={event} getSourceColor={getSourceColor} />
        ))}
      </div>
    </div>
  );
}
