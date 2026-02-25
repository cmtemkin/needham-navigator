"use client";

import type { EventItem } from "./CalendarView";

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: EventItem[];
}

interface CalendarGridProps {
  month: Date;
  eventsByDate: Map<string, EventItem[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  getSourceColor: (sourceId: string) => { dot: string; label: string };
}

function buildCalendarDays(
  month: Date,
  eventsByDate: Map<string, EventItem[]>,
): CalendarDay[] {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const days: CalendarDay[] = [];

  // Fill in days from previous month
  const startDow = firstDay.getDay(); // 0 = Sunday
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, monthIdx, -i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: key === todayStr,
      events: eventsByDate.get(key) ?? [],
    });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, monthIdx, d);
    const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date,
      isCurrentMonth: true,
      isToday: key === todayStr,
      events: eventsByDate.get(key) ?? [],
    });
  }

  // Fill in remaining days from next month
  const remaining = 42 - days.length; // 6 rows x 7 days
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, monthIdx + 1, i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: key === todayStr,
      events: eventsByDate.get(key) ?? [],
    });
  }

  return days;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  month,
  eventsByDate,
  selectedDate,
  onSelectDate,
  getSourceColor,
}: Readonly<CalendarGridProps>) {
  const days = buildCalendarDays(month, eventsByDate);

  const selectedKey = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : null;

  return (
    <div className="bg-white border border-border-default rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-default">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold text-text-secondary uppercase tracking-wide"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}-${String(day.date.getDate()).padStart(2, "0")}`;
          const isSelected = key === selectedKey;
          const hasEvents = day.events.length > 0;

          // Get unique source types for event dots
          const sourceTypes = [...new Set(day.events.map((e) => getSourceColor(e.source_id).dot))];

          return (
            <button
              key={key}
              onClick={() => onSelectDate(day.date)}
              className={`
                relative min-h-[80px] sm:min-h-[96px] p-1.5 sm:p-2 border-b border-r border-border-light text-left transition-colors
                ${day.isCurrentMonth ? "bg-white" : "bg-gray-50/50"}
                ${isSelected ? "bg-[var(--primary)]/5 ring-2 ring-inset ring-[var(--primary)]" : ""}
                ${hasEvents && !isSelected ? "hover:bg-gray-50" : ""}
                ${!hasEvents && !isSelected ? "hover:bg-gray-50/50" : ""}
              `}
            >
              <span
                className={`
                  inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium
                  ${day.isToday ? "bg-[var(--primary)] text-white" : ""}
                  ${!day.isToday && day.isCurrentMonth ? "text-text-primary" : ""}
                  ${!day.isToday && !day.isCurrentMonth ? "text-text-muted" : ""}
                `}
              >
                {day.date.getDate()}
              </span>

              {/* Event dots */}
              {sourceTypes.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {sourceTypes.slice(0, 3).map((dotColor) => (
                    <span
                      key={dotColor}
                      className={`w-2 h-2 rounded-full ${dotColor}`}
                    />
                  ))}
                  {day.events.length > 3 && (
                    <span className="text-[10px] text-text-muted ml-0.5">
                      +{day.events.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Show first event title on larger screens */}
              {day.events.length > 0 && (
                <div className="hidden sm:block mt-1">
                  <p className="text-[11px] text-text-secondary truncate leading-tight">
                    {day.events[0].title}
                  </p>
                  {day.events.length > 1 && (
                    <p className="text-[10px] text-text-muted mt-0.5">
                      +{day.events.length - 1} more
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
