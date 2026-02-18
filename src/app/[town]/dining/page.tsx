"use client";

import { useState, useEffect } from "react";
import { UtensilsCrossed, ExternalLink, Star, MapPin, Clock } from "lucide-react";
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
  url: string | null;
  image_url: string | null;
  metadata: Record<string, string> | null;
};

const ITEMS_PER_PAGE = 20;
const FETCH_TIMEOUT_MS = 10000;

export default function DiningPage() {
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

    async function fetchDining() {
      setLoading(true);
      setError(false);
      setOffset(0);

      try {
        const params = new URLSearchParams({
          town: town.town_id,
          category: "dining",
          limit: ITEMS_PER_PAGE.toString(),
          offset: "0",
        });

        const res = await fetch(`/api/content?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch dining");

        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching dining:", err);
          setError(true);
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    void fetchDining();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id, retryCount]);

  const handleLoadMore = () => {
    const newOffset = offset + ITEMS_PER_PAGE;
    setOffset(newOffset);
    setLoadingMore(true);

    const params = new URLSearchParams({
      town: town.town_id,
      category: "dining",
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
        console.error("Error loading more dining:", err);
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
              {shortTownName} <span className="text-[var(--accent)]">Dining</span>
            </h1>
            <p className="text-lg text-white/90">
              Restaurants, cafes, and local eateries
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-border-light rounded-xl p-5 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Unable to load dining</h2>
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
                {total} place{total !== 1 ? "s" : ""} found
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-white border border-border-light rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
                        <UtensilsCrossed size={18} className="text-[var(--primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                          {item.title}
                        </h3>
                        <div className="flex flex-wrap gap-2 text-[13px] text-text-secondary mb-2">
                          {item.metadata?.address && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {item.metadata.address}
                            </span>
                          )}
                          {item.metadata?.hours && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {item.metadata.hours}
                            </span>
                          )}
                          {item.metadata?.rating && (
                            <span className="flex items-center gap-1">
                              <Star size={12} className="text-yellow-500" />
                              {item.metadata.rating}
                            </span>
                          )}
                        </div>
                        {(item.summary || item.content) && (
                          <p className="text-[13px] text-text-secondary line-clamp-2">
                            {item.summary || item.content}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[13px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium mt-2 transition-colors"
                          >
                            Visit
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
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
              <div className="text-6xl mb-4">🍽️</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Coming soon</h2>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Local dining listings are being added. In the meantime, ask Navigator for restaurant recommendations.
              </p>
              <button
                onClick={() => openChat(`What are some good restaurants in ${shortTownName}?`)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Ask About Dining
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
