"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleSkeleton } from "@/components/ArticleSkeleton";
import { useTown } from "@/lib/town-context";
import { ExternalLink, Clock, Filter, ChevronDown } from "lucide-react";
import type { Article, ArticleListResponse } from "@/types/article";

const FETCH_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Unified item type — wraps both articles and content_items
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

type UnifiedItem =
  | { type: "article"; data: Article }
  | { type: "content"; data: ContentItem };

// ---------------------------------------------------------------------------
// Source filter options
// ---------------------------------------------------------------------------

type SourceFilter = "all" | "ai" | "patch" | "observer" | "local" | "town";

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "ai", label: "AI Articles" },
  { value: "patch", label: "Patch" },
  { value: "observer", label: "Observer" },
  { value: "local", label: "Needham Local" },
  { value: "town", label: "Town of Needham" },
];

// ---------------------------------------------------------------------------
// Category filter
// ---------------------------------------------------------------------------

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "government", label: "Town Government" },
  { value: "schools", label: "Schools" },
  { value: "public_safety", label: "Public Safety" },
  { value: "community", label: "Community" },
  { value: "development", label: "Permits & Development" },
  { value: "business", label: "Business" },
  { value: "news", label: "News" },
];

// ---------------------------------------------------------------------------
// Content Item Card (for external news)
// ---------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  "needham:patch-news": "bg-orange-100 text-orange-700",
  "needham:observer-news": "bg-blue-100 text-blue-700",
  "needham:needham-local": "bg-green-100 text-green-700",
  "needham:town-rss": "bg-purple-100 text-purple-700",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ContentItemCard({ item, newsSources }: { item: ContentItem; newsSources?: Record<string, string> }) {
  const displayText = item.summary || item.content?.slice(0, 200) || "";
  const sourceLabel = newsSources?.[item.source_id] || item.source_id.split(":").pop() || item.source_id;
  const sourceColor = SOURCE_COLORS[item.source_id] ?? "bg-gray-100 text-gray-700";

  return (
    <div className="group block bg-white border border-border-default rounded-lg hover:border-[var(--primary)] hover:shadow-md transition-all p-4">
      <div className="flex items-start gap-4">
        {item.image_url && (
          <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg sm:block">
            <img src={item.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* Header badges */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceColor}`}>
              {sourceLabel}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-700">
              External
            </span>
          </div>

          <h3 className="font-bold text-text-primary group-hover:text-[var(--primary)] transition-colors mb-1 text-base">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </h3>

          {displayText && (
            <p className="line-clamp-2 text-sm text-text-secondary mb-2 leading-relaxed">
              {displayText}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-light">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
              >
                Read more <ExternalLink size={12} />
              </a>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formatRelativeTime(item.published_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified News Page
// ---------------------------------------------------------------------------

export default function ArticlesPage() {
  const town = useTown();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  const [unifiedItems, setUnifiedItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  // Track total counts for display
  const [articleTotal, setArticleTotal] = useState(0);
  const [contentTotal, setContentTotal] = useState(0);

  const fetchUnifiedContent = useCallback(async () => {
    setLoading(true);
    setError(false);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      // Determine which APIs to fetch based on source filter
      const fetchArticles = sourceFilter === "all" || sourceFilter === "ai";
      const fetchContent = sourceFilter !== "ai";

      const promises: Promise<void>[] = [];
      let articles: Article[] = [];
      let contentItems: ContentItem[] = [];
      let artTotal = 0;
      let cntTotal = 0;

      if (fetchArticles) {
        const artParams = new URLSearchParams({
          town: town.town_id,
          limit: "50",
          offset: "0",
        });
        if (selectedCategory !== "all") {
          artParams.set("category", selectedCategory);
        }

        promises.push(
          fetch(`/api/articles?${artParams}`, { signal: controller.signal })
            .then((res) => res.json())
            .then((data: ArticleListResponse) => {
              articles = data.articles ?? [];
              artTotal = data.total ?? 0;
            })
        );
      }

      if (fetchContent) {
        const cntParams = new URLSearchParams({
          town: town.town_id,
          limit: "50",
          offset: "0",
        });
        if (selectedCategory !== "all") {
          cntParams.set("category", selectedCategory);
        }
        // Map source filter to source_id
        const sourceMap: Record<string, string> = {
          patch: "needham:patch-news",
          observer: "needham:observer-news",
          local: "needham:needham-local",
          town: "needham:town-rss",
        };
        if (sourceFilter !== "all" && sourceMap[sourceFilter]) {
          cntParams.set("source", sourceMap[sourceFilter]);
        }

        promises.push(
          fetch(`/api/content?${cntParams}`, { signal: controller.signal })
            .then((res) => res.json())
            .then((data: { items: ContentItem[]; total: number }) => {
              contentItems = data.items ?? [];
              cntTotal = data.total ?? 0;
            })
        );
      }

      await Promise.all(promises);

      // Merge and sort by published_at descending
      const merged: UnifiedItem[] = [
        ...articles.map((a): UnifiedItem => ({ type: "article", data: a })),
        ...contentItems.map((c): UnifiedItem => ({ type: "content", data: c })),
      ];
      merged.sort((a, b) => {
        const dateA = new Date(a.data.published_at).getTime();
        const dateB = new Date(b.data.published_at).getTime();
        return dateB - dateA;
      });

      setUnifiedItems(merged);
      setArticleTotal(artTotal);
      setContentTotal(cntTotal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Error fetching unified content:", err);
      }
      setError(true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [town.town_id, sourceFilter, selectedCategory]);

  useEffect(() => {
    fetchUnifiedContent().catch(() => {});
  }, [fetchUnifiedContent, retryCount]);

  const totalItems = articleTotal + contentTotal;
  const selectedCategoryLabel = CATEGORIES.find((c) => c.value === selectedCategory)?.label || "All Categories";

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">News</span>
            </h1>
            <p className="text-lg text-white/90">
              Local news, AI-powered articles, and updates from official sources
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {/* Filters */}
          <div className="bg-white border border-border-default rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Category Dropdown */}
              <div className="relative flex-1">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Category</label>
                <div className="relative">
                  <button
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-border-default rounded-md text-sm text-text-primary hover:border-[var(--primary)] transition-colors"
                  >
                    <span>{selectedCategoryLabel}</span>
                    <ChevronDown size={16} className={`transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {categoryDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCategoryDropdownOpen(false)} onKeyDown={(e) => { if (e.key === "Escape") setCategoryDropdownOpen(false); }} role="presentation" />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-default rounded-md shadow-lg z-20 max-h-64 overflow-auto">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            onClick={() => {
                              setSelectedCategory(cat.value);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                              selectedCategory === cat.value ? "bg-[var(--primary)]/5 text-[var(--primary)] font-medium" : "text-text-primary"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Source Filter Pills */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  <Filter size={12} className="inline mr-1" />
                  Source
                </label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_FILTERS.map((src) => (
                    <button
                      key={src.value}
                      onClick={() => setSourceFilter(src.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        sourceFilter === src.value
                          ? "bg-[var(--primary)] text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!loading && !error && (
            <div className="text-sm text-text-muted mb-4">
              {totalItems} item{totalItems !== 1 ? "s" : ""} found
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <ArticleSkeleton key={`skeleton-${i}`} variant="list" />
              ))}
            </div>
          )}

          {!loading && unifiedItems.length > 0 && (
            <div className="space-y-4">
              {unifiedItems.map((item) =>
                item.type === "article" ? (
                  <ArticleCard key={`art-${item.data.id}`} article={item.data} variant="list" />
                ) : (
                  <ContentItemCard
                    key={`cnt-${item.data.id}`}
                    item={item.data}
                    newsSources={town.news_sources}
                  />
                )
              )}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">&#x26A0;&#xFE0F;</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Unable to load news</h2>
              <p className="text-text-secondary mb-6">Something went wrong. Please try again.</p>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && unifiedItems.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">&#x1F4F0;</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">No news yet</h2>
              <p className="text-text-secondary max-w-md mx-auto">
                News and articles are generated daily from {shortTownName}&apos;s public records, local news sources, and more. Check back soon!
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
