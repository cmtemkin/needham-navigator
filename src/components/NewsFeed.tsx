"use client";

import { useState, useEffect, useCallback } from "react";
import { Newspaper, ExternalLink, Filter, Loader2 } from "lucide-react";
import { useTown } from "@/lib/town-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentItem {
  id: string;
  source_id: string;
  category: string;
  title: string;
  content: string;
  summary: string | null;
  published_at: string;
  url: string | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
}

interface ContentResponse {
  items: ContentItem[];
  total: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getSourceLabel(sourceId: string, townNewsSources?: Record<string, string>): string {
  if (townNewsSources?.[sourceId]) return townNewsSources[sourceId];
  return sourceId.split(":").pop() ?? sourceId;
}

function getSourceColor(sourceId: string): string {
  const colors: Record<string, string> = {
    "needham:patch-news": "bg-orange-100 text-orange-700",
    "needham:observer-news": "bg-blue-100 text-blue-700",
    "needham:needham-local": "bg-green-100 text-green-700",
    "needham:town-rss": "bg-purple-100 text-purple-700",
  };
  return colors[sourceId] ?? "bg-gray-100 text-gray-700";
}

// ---------------------------------------------------------------------------
// News Card Component
// ---------------------------------------------------------------------------

function NewsCard({ item, newsSources }: { item: ContentItem; newsSources?: Record<string, string> }) {
  const displayText = item.summary || item.content?.slice(0, 200) || "";

  return (
    <article className="group rounded-xl border border-border-light bg-white p-4 transition-all hover:border-border hover:shadow-sm">
      <div className="flex items-start gap-4">
        {item.image_url && (
          <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:block">
            <img
              src={item.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getSourceColor(item.source_id)}`}
            >
              {getSourceLabel(item.source_id, newsSources)}
            </span>
            <span className="text-[12px] text-text-muted">
              {timeAgo(item.published_at)}
            </span>
          </div>

          <h3 className="mb-1 text-[15px] font-semibold leading-snug text-text-primary group-hover:text-primary">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>

          {displayText && (
            <p className="line-clamp-2 text-[13.5px] leading-relaxed text-text-secondary">
              {displayText}
            </p>
          )}

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              Read more
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// NewsFeed Component
// ---------------------------------------------------------------------------

interface NewsFeedProps {
  /** Show only this many items (for widget mode) */
  maxItems?: number;
  /** Hide filter chips */
  compact?: boolean;
}

export function NewsFeed({ maxItems, compact = false }: NewsFeedProps) {
  const town = useTown();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const limit = maxItems ?? 20;

  const fetchItems = useCallback(
    async (offset = 0, append = false) => {
      try {
        if (offset === 0) setLoading(true);
        else setLoadingMore(true);

        const params = new URLSearchParams({
          town: town.town_id,
          category: "news",
          limit: String(limit),
          offset: String(offset),
        });

        if (sourceFilter) {
          params.set("source", sourceFilter);
        }

        const res = await fetch(`/api/content?${params}`);
        if (!res.ok) throw new Error("Failed to fetch news");

        const data: ContentResponse = await res.json();

        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setTotal(data.total);
        setHasMore(data.hasMore);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [town.town_id, limit, sourceFilter]
  );

  useEffect(() => {
    fetchItems(0);
  }, [fetchItems]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchItems(items.length, true);
    }
  };

  const sources = [
    { id: null, label: "All" },
    { id: "needham:patch-news", label: "Patch" },
    { id: "needham:observer-news", label: "Observer" },
    { id: "needham:needham-local", label: "Local" },
    { id: "needham:town-rss", label: "Town" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-center text-[14px] text-text-secondary">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-light bg-surface p-8 text-center">
        <Newspaper size={32} className="mx-auto mb-3 text-text-muted" />
        <p className="text-[14px] text-text-secondary">
          No news articles yet. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Source filter chips */}
      {!compact && (
        <div className="mb-4 flex items-center gap-2">
          <Filter size={14} className="text-text-muted" />
          {sources.map((src) => (
            <button
              key={src.id ?? "all"}
              onClick={() => setSourceFilter(src.id)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-all ${
                sourceFilter === src.id
                  ? "bg-primary text-white"
                  : "bg-surface text-text-secondary hover:bg-border-light"
              }`}
            >
              {src.label}
            </button>
          ))}
          {total > 0 && (
            <span className="ml-auto text-[12px] text-text-muted">
              {total} article{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* News cards */}
      <div className="space-y-3">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} newsSources={town.news_sources} />
        ))}
      </div>

      {/* Load more */}
      {!compact && hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-[13.5px] font-medium text-text-secondary transition-all hover:bg-surface disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
