"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Trash2, Building2, School, DollarSign, Bus, ChevronRight, ExternalLink, Clock } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchResultCard } from "@/components/search/SearchResultCard";
import { AIAnswerCard } from "@/components/search/AIAnswerCard";
import { DailyBriefBanner } from "@/components/DailyBriefBanner";
import { LiveWidgets } from "@/components/LiveWidgets";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleSkeleton } from "@/components/ArticleSkeleton";
import { useTown, useTownHref } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";
import type { SearchResponse, CachedAnswer } from "@/types/search";
import type { Article, ArticleListResponse } from "@/types/article";
import { trackEvent } from "@/lib/pendo";

// ---------------------------------------------------------------------------
// Unified content types for homepage news feed
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

function ContentItemGridCard({ item, newsSources }: { item: ContentItem; newsSources?: Record<string, string> }) {
  const displayText = item.summary || item.content?.slice(0, 150) || "";
  const sourceLabel = newsSources?.[item.source_id] || item.source_id.split(":").pop() || item.source_id;
  const sourceColor = SOURCE_COLORS[item.source_id] ?? "bg-gray-100 text-gray-700";

  return (
    <a
      href={item.url || "#"}
      target={item.url ? "_blank" : undefined}
      rel={item.url ? "noopener noreferrer" : undefined}
      className="group block bg-white border border-border-default rounded-lg hover:border-[var(--primary)] hover:shadow-md transition-all p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceColor}`}>
          {sourceLabel}
        </span>
        <ExternalLink size={14} className="text-gray-400" />
      </div>
      <h3 className="font-bold text-text-primary group-hover:text-[var(--primary)] transition-colors mb-2 text-base line-clamp-2">
        {item.title}
      </h3>
      {displayText && (
        <p className="text-sm text-text-secondary mb-3 line-clamp-2">
          {displayText}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-light">
        <span>{sourceLabel}</span>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{formatRelativeTime(item.published_at)}</span>
        </div>
      </div>
    </a>
  );
}

const QUICK_LINKS = [
  { label: "Transfer Station", icon: Trash2 },
  { label: "Building Permits", icon: Building2 },
  { label: "Tax Rate", icon: DollarSign },
  { label: "Schools", icon: School },
  { label: "Transportation", icon: Bus },
];

const TOPIC_CARDS: {
  icon: string;
  title: string;
  description: string;
  /** If set, clicking navigates to this path (relative to town root) instead of searching */
  townPath?: string;
}[] = [
  {
    icon: "🎓",
    title: "Schools",
    description: "Enrollment, calendar, bus routes",
  },
  {
    icon: "💰",
    title: "Taxes & Assessments",
    description: "Property tax info, payments, exemptions",
  },
  {
    icon: "🏗️",
    title: "Permits & Zoning",
    description: "Building permits, zoning districts, applications",
    townPath: "/permits",
  },
  {
    icon: "🗑️",
    title: "Trash & Recycling",
    description: "Transfer station hours, recycling rules, stickers",
  },
  {
    icon: "🚌",
    title: "Transportation",
    description: "Live commuter rail, parking, roads",
    townPath: "/transit",
  },
  {
    icon: "🏞️",
    title: "Recreation & Parks",
    description: "Programs, fields, pools, rentals",
  },
];

const POPULAR_QUESTIONS = [
  "When is the transfer station open?",
  "How do I apply for a building permit?",
  "What are the property tax rates?",
  "How do I enroll my child in school?",
  "Where can I find parking?",
  "What programs does Parks & Rec offer?",
];

type AIAnswerState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "cached"; answer: CachedAnswer }
  | { type: "loaded"; html: string; sources: { title: string; url: string }[] }
  | { type: "error"; message: string };

function normalizeQuery(value: string | null): string {
  return (value ?? "").trim();
}

interface SearchHomePageProps {
  initialQuery?: string;
}

export function SearchHomePage({ initialQuery = "" }: SearchHomePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const town = useTown();
  const { openChat } = useChatWidget();
  const searchHref = useTownHref("/search");
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");
  const latestExecutedQueryRef = useRef<string | null>(null);

  const articlesHref = useTownHref("/articles");

  const queryFromUrl = normalizeQuery(searchParams.get("q"));
  const [query, setQuery] = useState(initialQuery || queryFromUrl);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [aiAnswer, setAiAnswer] = useState<AIAnswerState>({ type: "idle" });
  const [isSearching, setIsSearching] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<UnifiedItem[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [lastVisitTimestamp, setLastVisitTimestamp] = useState<number | undefined>(undefined);

  // Track last visit for "NEW" badges on articles
  useEffect(() => {
    try {
      const stored = localStorage.getItem("nn_last_visit");
      if (stored) {
        setLastVisitTimestamp(parseInt(stored, 10));
      }
      localStorage.setItem("nn_last_visit", String(Date.now()));
    } catch {
      // localStorage unavailable (SSR / private browsing)
    }
  }, []);

  const executeSearch = useCallback(
    async (rawQuery: string) => {
      const q = normalizeQuery(rawQuery);
      if (!q) {
        setQuery("");
        setSearchResults(null);
        setAiAnswer({ type: "idle" });
        setIsSearching(false);
        latestExecutedQueryRef.current = null;
        return;
      }

      latestExecutedQueryRef.current = q;
      setQuery(q);
      setIsSearching(true);
      setSearchResults(null);
      setAiAnswer({ type: "idle" });

      try {
        // 1. INSTANT: fetch search results (with one retry for cold-start timeouts)
        const searchBody = JSON.stringify({ query: q, town_id: town.town_id });
        const searchHeaders = { "Content-Type": "application/json" };
        let res = await fetch("/api/search", {
          method: "POST",
          headers: searchHeaders,
          body: searchBody,
        });

        if (!res.ok) {
          // Retry once after a short delay — Vercel cold starts can cause 500s
          console.warn(`/api/search returned ${res.status}, retrying in 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
          res = await fetch("/api/search", {
            method: "POST",
            headers: searchHeaders,
            body: searchBody,
          });
        }

        if (!res.ok) {
          console.error(`/api/search failed after retry: ${res.status}`);
          setSearchResults({ results: [], cached_answer: null, timing_ms: 0 });
          setIsSearching(false);
          return;
        }

        const data: SearchResponse = await res.json();
        setSearchResults(data);
        setIsSearching(false);

        // Track successful search
        trackEvent('search_performed', {
          query_length: q.length,
          result_count: data.results.length,
          has_cached_answer: !!data.cached_answer,
          top_similarity: data.results[0]?.similarity ?? 0,
          timing_ms: data.timing_ms,
          town_id: town.town_id,
        });

        // 2. Check for cached answer
        if (data.cached_answer) {
          setAiAnswer({ type: "cached", answer: data.cached_answer });
          return;
        }

        // 3. Always generate AI answer for uncached queries
        if (data.results.length > 0) {
          // Only generate if we have results
          setAiAnswer({ type: "loading" });

          try {
            const chatBody = JSON.stringify({
              messages: [{ role: "user", content: q }],
              town_id: town.town_id,
            });
            const chatHeaders = { "Content-Type": "application/json" };
            let chatRes = await fetch("/api/chat", {
              method: "POST",
              headers: chatHeaders,
              body: chatBody,
            });

            if (!chatRes.ok) {
              // Retry once for cold-start timeouts
              await new Promise((r) => setTimeout(r, 2000));
              chatRes = await fetch("/api/chat", {
                method: "POST",
                headers: chatHeaders,
                body: chatBody,
              });
            }

            if (!chatRes.ok) {
              throw new Error("Failed to generate AI answer");
            }

            // Parse the streaming response
            const reader = chatRes.body?.getReader();
            if (!reader) {
              throw new Error("No response body");
            }

            let answerHtml = "";
            let sources: { title: string; url: string }[] = [];
            const decoder = new TextDecoder();

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split("\n");

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data || data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);

                  // Handle text deltas
                  if (parsed.type === "text-delta") {
                    answerHtml += parsed.delta;
                  }

                  // Handle sources
                  if (parsed.type === "data-sources") {
                    sources = parsed.data.map((s: { document_title: string; document_url?: string }) => ({
                      title: s.document_title,
                      url: s.document_url ?? "",
                    }));
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }

            if (answerHtml) {
              setAiAnswer({ type: "loaded", html: answerHtml, sources });
            } else {
              setAiAnswer({ type: "error", message: "No answer generated" });
            }
          } catch (error) {
            console.error("AI answer generation error:", error);
            setAiAnswer({ type: "error", message: "Failed to generate AI answer" });
          }
        }

        if (data.results.length === 0) {
          trackEvent('search_no_results', {
            query_length: q.length,
            town_id: town.town_id,
          });
        }
      } catch (error) {
        console.error("Search error:", error);
        setIsSearching(false);
      }
    },
    [town.town_id]
  );

  const handleSearch = useCallback(
    (rawQuery: string) => {
      const trimmed = normalizeQuery(rawQuery);
      if (!trimmed) {
        return;
      }

      const currentQuery = normalizeQuery(searchParams.get("q"));
      if (pathname === searchHref && currentQuery === trimmed) {
        executeSearch(trimmed).catch(() => {});
        return;
      }

      router.push(`${searchHref}?q=${encodeURIComponent(trimmed)}`);
    },
    [executeSearch, pathname, router, searchHref, searchParams]
  );

  useEffect(() => {
    if (!queryFromUrl) {
      latestExecutedQueryRef.current = null;
      setQuery("");
      setSearchResults(null);
      setAiAnswer({ type: "idle" });
      setIsSearching(false);
      return;
    }

    if (pathname !== searchHref) {
      router.replace(`${searchHref}?q=${encodeURIComponent(queryFromUrl)}`);
      return;
    }

    if (latestExecutedQueryRef.current === queryFromUrl) {
      return;
    }

    executeSearch(queryFromUrl).catch(() => {});
  }, [executeSearch, pathname, queryFromUrl, router, searchHref]);

  // Fetch unified news for homepage (both AI articles + external content)
  useEffect(() => {
    async function fetchUnifiedNews() {
      try {
        const [articlesRes, contentRes] = await Promise.all([
          fetch(`/api/articles?town=${town.town_id}&limit=6`),
          fetch(`/api/content?town=${town.town_id}&limit=6`),
        ]);

        const items: UnifiedItem[] = [];

        if (articlesRes.ok) {
          const data: ArticleListResponse = await articlesRes.json();
          items.push(...data.articles.map((a): UnifiedItem => ({ type: "article", data: a })));
        }

        if (contentRes.ok) {
          const data: { items: ContentItem[] } = await contentRes.json();
          items.push(...data.items.map((c): UnifiedItem => ({ type: "content", data: c })));
        }

        // Sort by date, take top 6
        items.sort((a, b) => {
          const dateA = new Date(a.data.published_at).getTime();
          const dateB = new Date(b.data.published_at).getTime();
          return dateB - dateA;
        });

        setFeaturedItems(items.slice(0, 6));
      } catch (error) {
        console.error("Failed to fetch news:", error);
      } finally {
        setArticlesLoading(false);
      }
    }
    fetchUnifiedNews().catch(() => {});
  }, [town.town_id]);

  const handleAskAbout = useCallback((question: string) => {
    trackEvent('ask_about_clicked', {
      question_length: question.length,
      town_id: town.town_id,
    });
    openChat(question);
  }, [openChat, town.town_id]);

  const handleFollowUp = useCallback((question: string) => {
    const answerText = aiAnswer.type === "loaded" ? aiAnswer.html :
                       aiAnswer.type === "cached" ? aiAnswer.answer.answer_html : "";
    const sources = aiAnswer.type === "loaded" ? aiAnswer.sources :
                    aiAnswer.type === "cached" ? aiAnswer.answer.sources : [];
    openChat({
      message: question,
      context: {
        searchQuery: query,
        aiAnswer: answerText,
        sources: sources.map((s) => ({ title: s.title, url: s.url ?? "" })),
      },
    });
  }, [openChat, query, aiAnswer]);

  const showResults = isSearching || searchResults !== null;

  return (
    <>
      <Header />

      <main>
        {/* Search Hero - Only show when no results */}
        {!showResults && (
          <section className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-8 px-4">
            <div className="max-w-[720px] mx-auto text-center">
              <h1 className="text-3xl font-bold mb-2 leading-tight">
                Search{" "}
                <span className="text-[var(--accent)]">{shortTownName}</span>
              </h1>
              <p className="text-base text-white/90 mb-5">
                Find answers from official documents, bylaws, meeting minutes, and more
              </p>

              {/* Quick-link pills */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_LINKS.map((link) => (
                  <button
                    key={link.label}
                    onClick={() => {
                      trackEvent('quick_link_clicked', {
                        label: link.label,
                        town_id: town.town_id,
                      });
                      handleSearch(link.label);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm text-white text-[13px] font-medium rounded-full hover:bg-white/20 transition-colors border border-white/20"
                    data-pendo={`quick-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <link.icon size={14} />
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sticky Search Bar - Only show when results exist */}
        {showResults && (
          <div className="sticky top-0 z-40 bg-white border-b border-border-default h-[56px] px-4">
            <div className="max-w-content mx-auto h-full flex items-center gap-2">
              <Search size={18} className="text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                placeholder={`Search ${shortTownName} documents...`}
                className="flex-1 border-none bg-transparent outline-none text-[14px] text-text-primary placeholder:text-text-muted"
                data-pendo="search-input-sticky"
              />
              <button
                onClick={() => handleSearch(query)}
                disabled={isSearching || !query.trim()}
                className="px-4 py-1.5 bg-[var(--primary)] text-white text-[13px] font-medium rounded-md hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-pendo="search-button-sticky"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
        )}

        {/* Default State (no query) */}
        {!showResults && (
          <div className="mx-auto mt-8 max-w-content px-4 sm:px-6 pb-12">
            {/* Daily Brief — full width above the grid */}
            <DailyBriefBanner />

            {/* Two-column layout: content left, widgets right */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
              {/* Left column: articles, topics, questions */}
              <div>
                {(articlesLoading || featuredItems.length > 0) && (
                  <div className="mb-10">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-2xl font-bold text-text-primary">Latest News</h2>
                      <Link
                        href={articlesHref}
                        className="flex items-center gap-1 text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium text-sm transition-colors group"
                      >
                        View all news
                        <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>

                    {articlesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...Array(4)].map((_, i) => (
                          <ArticleSkeleton key={`skeleton-${i}`} variant="grid" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {featuredItems.map((item) =>
                          item.type === "article" ? (
                            <ArticleCard key={`art-${item.data.id}`} article={item.data} variant="grid" lastVisitTimestamp={lastVisitTimestamp} />
                          ) : (
                            <ContentItemGridCard key={`cnt-${item.data.id}`} item={item.data} newsSources={town.news_sources} />
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Browse by Topic */}
                <div className="mb-10">
                  <h2 className="text-2xl font-bold text-text-primary mb-5">
                    Browse by Topic
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TOPIC_CARDS.map((topic) => {
                      const cardClass = "text-left bg-white border border-border-default rounded-xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all group";
                      const cardContent = (
                        <>
                          <div className="text-3xl mb-3">{topic.icon}</div>
                          <h3 className="text-[16px] font-bold text-text-primary mb-2 group-hover:text-[var(--primary)] transition-colors">
                            {topic.title}
                          </h3>
                          <p className="text-[14px] text-text-secondary leading-relaxed">
                            {topic.description}
                          </p>
                        </>
                      );

                      if (topic.townPath) {
                        return (
                          <Link
                            key={topic.title}
                            href={`/${town.town_id}${topic.townPath}`}
                            className={cardClass}
                            data-pendo={`topic-${topic.title.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => trackEvent('topic_card_clicked', { topic: topic.title, town_id: town.town_id })}
                          >
                            {cardContent}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={topic.title}
                          onClick={() => {
                            trackEvent('topic_card_clicked', { topic: topic.title, town_id: town.town_id });
                            handleSearch(topic.title);
                          }}
                          className={cardClass}
                          data-pendo={`topic-${topic.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {cardContent}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Popular Questions */}
                <div>
                  <h2 className="text-2xl font-bold text-text-primary mb-5">
                    Popular Questions
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          trackEvent('popular_question_clicked', {
                            question: q,
                            town_id: town.town_id,
                          });
                          handleSearch(q);
                        }}
                        className="px-4 py-2 bg-white border border-border-default rounded-full text-[13px] text-text-secondary hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[#F5F8FC] transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column: sticky sidebar with live widgets */}
              <aside className="hidden lg:block">
                <div className="sticky top-[76px] self-start">
                  <LiveWidgets variant="sidebar" />
                </div>
              </aside>
            </div>

            {/* LiveWidgets shown inline on mobile/tablet (below content) */}
            <div className="lg:hidden mt-8">
              <LiveWidgets />
            </div>
          </div>
        )}

        {/* Results State */}
        {showResults && (
          <section className="mx-auto mt-6 max-w-content px-4 sm:px-6 pb-12">
            {/* Results count header (Google-style) */}
            {searchResults && (
              <div className="text-[14px] text-text-muted mb-4">
                About {searchResults.results.length} result{searchResults.results.length !== 1 ? 's' : ''} ({(searchResults.timing_ms / 1000).toFixed(2)} seconds)
              </div>
            )}

            {/* AI Answer (loading, cached, loaded, or error) */}
            {aiAnswer.type === "loading" && <AIAnswerCard state="loading" />}
            {aiAnswer.type === "cached" && (
              <AIAnswerCard
                state="cached"
                answer={aiAnswer.answer}
                onFollowUp={handleFollowUp}
              />
            )}
            {aiAnswer.type === "loaded" && (
              <AIAnswerCard
                state="loaded"
                answerHtml={aiAnswer.html}
                sources={aiAnswer.sources}
                onFollowUp={handleFollowUp}
              />
            )}
            {aiAnswer.type === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-[14px] text-red-700">
                Failed to generate AI answer. Try asking in chat instead.
              </div>
            )}

            {/* Result cards */}
            {searchResults && searchResults.results.length > 0 ? (
              <div className="space-y-4">
                {searchResults.results.map((result, index) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    onAskAbout={handleAskAbout}
                    data-pendo={`result-${index}`}
                  />
                ))}
              </div>
            ) : (
              !isSearching && (
                <div className="text-center py-12 text-text-secondary">
                  <p className="text-[15px]">No results found for &ldquo;{query}&rdquo;</p>
                  <p className="text-[13px] mt-2">Try a different search term</p>
                </div>
              )
            )}
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
