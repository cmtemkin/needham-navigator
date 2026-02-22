"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";
import { Calendar, MapPin, ExternalLink, Clock, RefreshCw } from "lucide-react";

interface EventItem {
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

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventCard({
  event,
  sourceLabels,
}: {
  event: EventItem;
  sourceLabels?: Record<string, string>;
}) {
  const start = event.metadata?.event_start
    ? new Date(event.metadata.event_start)
    : new Date(event.published_at);
  const end = event.metadata?.event_end
    ? new Date(event.metadata.event_end)
    : null;
  const sourceLabel =
    sourceLabels?.[event.source_id] ||
    event.metadata?.source_name ||
    event.source_id.split(":").pop() ||
    event.source_id;

  return (
    <div className="group block bg-white border border-border-default rounded-lg hover:border-[var(--primary)] hover:shadow-md transition-all p-4">
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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 mb-2">
            {sourceLabel}
          </span>
          <h3 className="font-bold text-text-primary group-hover:text-[var(--primary)] transition-colors mb-1.5 text-base">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
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
                  <> at {formatEventTime(event.metadata.event_start)}</>
                )}
                {end && (
                  <>
                    {" – "}
                    {formatEventTime(event.metadata!.event_end!)}
                  </>
                )}
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
              {(event.content?.length ?? 0) > 200 ? "…" : ""}
            </p>
          )}

          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              View details <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const town = useTown();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(false);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const params = new URLSearchParams({
        town: town.town_id,
        category: "events",
        limit: "50",
        offset: "0",
      });
      const res = await fetch(`/api/content?${params}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load events");
      }

      setEvents(data.items ?? []);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Error fetching events:", err);
      }
      setError(true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [town.town_id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, retryCount]);

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={28} className="text-[var(--accent)]" />
              <h1 className="text-4xl font-bold">
                {shortTownName} <span className="text-[var(--accent)]">Events</span>
              </h1>
            </div>
            <p className="text-lg text-white/90">
              Town meetings, library programs, school events, and community
              happenings
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {loading && (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-lg bg-white border border-border-default"
                />
              ))}
            </div>
          )}

          {!loading && events.length > 0 && (
            <div className="space-y-4">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  sourceLabels={town.news_sources}
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">&#x26A0;&#xFE0F;</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Unable to load events
              </h2>
              <p className="text-text-secondary mb-6">
                Something went wrong. Please try again.
              </p>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="text-center py-16">
              <Calendar size={48} className="mx-auto text-text-muted mb-4 opacity-60" />
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                No upcoming events
              </h2>
              <p className="text-text-secondary max-w-md mx-auto">
                Events from town calendars, the library, and schools will appear
                here when available. Check back soon!
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
