"use client";

import { useState, useEffect } from "react";
import { Calendar, MapPin, Clock, ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";

type ContentItem = {
  id: string;
  title: string;
  content: string | null;
  summary: string | null;
  published_at: string | null;
  expires_at: string | null;
  url: string | null;
  metadata: Record<string, string> | null;
};

const ITEMS_PER_PAGE = 20;
const FETCH_TIMEOUT_MS = 10000;

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventsPage() {
  const town = useTown();
  const { openChat } = useChatWidget();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchEvents() {
      setLoading(true);
      setError(false);
      setOffset(0);

      try {
        const params = new URLSearchParams({
          town: town.town_id,
          category: "events",
          limit: ITEMS_PER_PAGE.toString(),
          offset: "0",
        });

        const res = await fetch(`/api/content?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch events");

        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching events:", err);
          setError(true);
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    void fetchEvents();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id, retryCount]);

  const handleLoadMore = () => {
    const newOffset = offset + ITEMS_PER_PAGE;
    setOffset(newOffset);
    setLoadingMore(true);

    const params = new URLSearchParams({
      town: town.town_id,
      category: "events",
      limit: ITEMS_PER_PAGE.toString(),
      offset: newOffset.toString(),
    });

    fetch(`/api/content?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setItems((prev) => [...prev, ...(data.items ?? [])]);
        setLoadingMore(false);
      })
      .catch((err) => {
        console.error("Error loading more events:", err);
        setLoadingMore(false);
      });
  };

  const hasMore = items.length < total;

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">Events</span>
            </h1>
            <p className="text-lg text-white/90">
              Community events, meetings, and activities
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {loading && (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-border-light rounded-xl p-5 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Unable to load events</h2>
              <p className="text-text-secondary mb-6">Something went wrong. Please try again.</p>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="text-sm text-text-muted mb-4">
                {total} event{total !== 1 ? "s" : ""} found
              </div>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-white border border-border-light rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[16px] font-semibold text-text-primary mb-2">
                          {item.title}
                        </h3>
                        <div className="flex flex-wrap gap-3 text-[13px] text-text-secondary mb-2">
                          {item.published_at && (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} className="text-[var(--primary)]" />
                              {formatEventDate(item.published_at)}
                            </span>
                          )}
                          {item.published_at && (
                            <span className="flex items-center gap-1">
                              <Clock size={14} className="text-[var(--primary)]" />
                              {formatEventTime(item.published_at)}
                            </span>
                          )}
                          {item.metadata?.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} className="text-[var(--primary)]" />
                              {item.metadata.location}
                            </span>
                          )}
                        </div>
                        {(item.summary || item.content) && (
                          <p className="text-[14px] text-text-secondary line-clamp-2">
                            {item.summary || item.content}
                          </p>
                        )}
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1 text-[13px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors"
                        >
                          Details
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📅</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">No events yet</h2>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Community events will appear here as they&apos;re added. In the meantime, ask Navigator about upcoming town meetings and activities.
              </p>
              <button
                onClick={() => openChat(`What events are coming up in ${shortTownName}?`)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Ask About Events
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
