"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, List, LayoutGrid, Rss } from "lucide-react";
import { CalendarGrid } from "./CalendarGrid";
import { EventDetailPanel } from "./EventDetailPanel";

// Re-export EventItem for other calendar components
export interface EventItem {
  id: string;
  source_id: string;
  category: string;
  title: string;
  content: string;
  summary: string | null;
  published_at: string;
  expires_at: string | null;
  url: string | null;
  image_url: string | null;
  metadata: {
    source_name?: string;
    event_location?: string;
    event_start?: string;
    event_end?: string;
  };
}

export const SOURCE_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  "needham:town-meetings": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", label: "Town" },
  "needham:town-community": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", label: "Town" },
  "needham:town-parks-rec": { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", label: "Town" },
  "needham:library-events": { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Library" },
  "needham:school-calendar": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "Schools" },
};

function getSourceColor(sourceId: string) {
  if (sourceId.includes("town")) return SOURCE_COLORS["needham:town-meetings"];
  if (sourceId.includes("library")) return SOURCE_COLORS["needham:library-events"];
  if (sourceId.includes("school")) return SOURCE_COLORS["needham:school-calendar"];
  return { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400", label: sourceId.split(":").pop() ?? "Other" };
}

type ViewMode = "month" | "list";
type SourceFilter = "all" | "town" | "library" | "schools";

interface CalendarViewProps {
  townId: string;
  townName: string;
}

export function CalendarView({ townId, townName }: Readonly<CalendarViewProps>) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showSubscribe, setShowSubscribe] = useState(false);

  // Fetch events for the current month +/- 1 month buffer
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        town: townId,
        category: "events",
        limit: "200",
        offset: "0",
      });
      const res = await fetch(`/api/content?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.items ?? []);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, [townId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Filter events by source
  const filteredEvents = useMemo(() => {
    if (sourceFilter === "all") return events;
    return events.filter((e) => {
      const color = getSourceColor(e.source_id);
      return color.label.toLowerCase() === sourceFilter;
    });
  }, [events, sourceFilter]);

  // Group events by date for the calendar grid
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const event of filteredEvents) {
      const dateStr = event.metadata?.event_start || event.published_at;
      const date = new Date(dateStr);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [filteredEvents]);

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    return eventsByDate.get(key) ?? [];
  }, [selectedDate, eventsByDate]);

  // Events for list view (sorted by date, future only)
  const listEvents = useMemo(() => {
    const now = new Date();
    return [...filteredEvents]
      .filter((e) => {
        const date = new Date(e.metadata?.event_start || e.published_at);
        return date >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
      })
      .sort((a, b) => {
        const da = new Date(a.metadata?.event_start || a.published_at).getTime();
        const db = new Date(b.metadata?.event_start || b.published_at).getTime();
        return da - db;
      });
  }, [filteredEvents]);

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const subscribeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/events/ics?town=${townId}`
    : `/api/events/ics?town=${townId}`;

  return (
    <div>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          {/* Month navigation */}
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-text-primary min-w-[180px] text-center">
            {monthLabel}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={goToToday}
            className="ml-1 px-3 py-1.5 text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg hover:bg-[var(--primary)]/5 transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Source filters */}
          {(["all", "town", "library", "schools"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                sourceFilter === f
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-white text-text-secondary border-border-default hover:border-[var(--primary)]/40"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}

          {/* View toggle */}
          <div className="flex items-center border border-border-default rounded-lg overflow-hidden ml-2">
            <button
              onClick={() => setViewMode("month")}
              className={`p-2 transition-colors ${viewMode === "month" ? "bg-[var(--primary)] text-white" : "bg-white text-text-secondary hover:bg-gray-50"}`}
              aria-label="Month view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-[var(--primary)] text-white" : "bg-white text-text-secondary hover:bg-gray-50"}`}
              aria-label="List view"
            >
              <List size={16} />
            </button>
          </div>

          {/* Subscribe button */}
          <div className="relative">
            <button
              onClick={() => setShowSubscribe(!showSubscribe)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/30 rounded-lg hover:bg-[var(--primary)]/5 transition-colors"
            >
              <Rss size={14} />
              Subscribe
            </button>
            {showSubscribe && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border-default rounded-lg shadow-lg p-4 z-50">
                <h4 className="text-sm font-semibold text-text-primary mb-2">Subscribe to {townName} Events</h4>
                <p className="text-xs text-text-secondary mb-3">
                  Add this URL to Google Calendar, Apple Calendar, or Outlook to stay synced with all {townName} events.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={subscribeUrl}
                    className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-border-default rounded font-mono truncate"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(subscribeUrl);
                      setShowSubscribe(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-dark)] transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-3 space-y-1.5">
                  <a
                    href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subscribeUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-[var(--primary)] hover:underline"
                  >
                    Add to Google Calendar
                  </a>
                  <a
                    href={subscribeUrl}
                    className="block text-xs text-[var(--primary)] hover:underline"
                  >
                    Download .ics file (Apple Calendar / Outlook)
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div className="text-center py-16 bg-white border border-border-default rounded-xl">
          <LayoutGrid size={48} className="mx-auto text-text-muted mb-4 opacity-40" />
          <h3 className="text-xl font-bold text-text-primary mb-2">No events yet</h3>
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            Events from the Town Calendar, Library, and Schools will appear here once the data pipeline is configured.
          </p>
        </div>
      )}

      {/* Calendar content */}
      {!loading && events.length > 0 && (
        <>
          {viewMode === "month" ? (
            <>
              <CalendarGrid
                month={currentMonth}
                eventsByDate={eventsByDate}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                getSourceColor={getSourceColor}
              />
              {selectedDate && (
                <EventDetailPanel
                  date={selectedDate}
                  events={selectedDateEvents}
                  getSourceColor={getSourceColor}
                />
              )}
            </>
          ) : (
            <EventDetailPanel
              events={listEvents}
              getSourceColor={getSourceColor}
              isListView
            />
          )}
        </>
      )}
    </div>
  );
}
