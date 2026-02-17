"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Trash2, Building2, School, DollarSign, Bus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchResultCard } from "@/components/search/SearchResultCard";
import { AIAnswerCard } from "@/components/search/AIAnswerCard";
import { DailyBriefBanner } from "@/components/DailyBriefBanner";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleSkeleton } from "@/components/ArticleSkeleton";
import { useTown, useTownHref } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";
import type { SearchResponse, CachedAnswer } from "@/types/search";
import type { Article, ArticleListResponse } from "@/types/article";
import { trackEvent } from "@/lib/pendo";

const QUICK_LINKS = [
  { label: "Transfer Station", icon: Trash2 },
  { label: "Building Permits", icon: Building2 },
  { label: "Tax Rate", icon: DollarSign },
  { label: "Schools", icon: School },
  { label: "Transportation", icon: Bus },
];

const TOPIC_CARDS = [
  {
    icon: "🗑️",
    title: "Trash & Recycling",
    description: "Transfer station hours, recycling rules, stickers",
  },
  {
    icon: "🏗️",
    title: "Permits & Zoning",
    description: "Building permits, zoning districts, applications",
  },
  {
    icon: "💰",
    title: "Taxes & Assessments",
    description: "Property tax info, payments, exemptions",
  },
  {
    icon: "🎓",
    title: "Schools",
    description: "Enrollment, calendar, bus routes",
  },
  {
    icon: "🚌",
    title: "Transportation",
    description: "Commuter rail, parking, roads",
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
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

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
        // 1. INSTANT: fetch search results
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, town_id: town.town_id }),
        });

        if (!res.ok) {
          // Fallback: if /api/search doesn't exist yet, just show empty results
          console.warn("/api/search not available yet, showing empty results");
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
            const chatRes = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [{ role: "user", content: q }],
                town_id: town.town_id,
              }),
            });

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
        void executeSearch(trimmed);
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

    void executeSearch(queryFromUrl);
  }, [executeSearch, pathname, queryFromUrl, router, searchHref]);

  // Fetch featured articles for homepage
  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch(`/api/articles?town=${town.town_id}&limit=6`);
        if (res.ok) {
          const data: ArticleListResponse = await res.json();
          setFeaturedArticles(data.articles);
        }
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setArticlesLoading(false);
      }
    }
    void fetchArticles();
  }, [town.town_id]);

  const handleAskAbout = useCallback((question: string) => {
    trackEvent('ask_about_clicked', {
      question_length: question.length,
      town_id: town.town_id,
    });
    openChat(question);
  }, [openChat, town.town_id]);

  const handleFollowUp = useCallback((question: string) => {
    openChat(question);
  }, [openChat]);

  const showResults = isSearching || searchResults !== null;

  return (
    <>
      <Header />

      <main>
        {/* Search Hero - Only show when no results */}
        {!showResults && (
          <section className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-16 px-4">
            <div className="max-w-[720px] mx-auto text-center">
              <h1 className="text-4xl font-bold mb-3 leading-tight">
                Search{" "}
                <span className="text-[var(--accent)]">{shortTownName}</span>
              </h1>
              <p className="text-lg text-white/90 mb-8">
                Find answers from town documents, bylaws, meeting minutes, and more
              </p>

              {/* Search input */}
              <div className="bg-white rounded-xl p-2 shadow-lg flex items-center gap-2">
                <Search size={20} className="text-text-muted ml-2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
                  placeholder={`Search ${shortTownName} documents...`}
                  className="flex-1 border-none bg-transparent outline-none text-[15px] text-text-primary py-2 placeholder:text-text-muted"
                  data-pendo="search-input"
                />
                <button
                  onClick={() => handleSearch(query)}
                  disabled={isSearching || !query.trim()}
                  className="px-5 py-2.5 bg-[var(--primary)] text-white text-[14px] font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-pendo="search-button"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Quick-link pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
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
          <>
            {/* Daily Brief & Featured Articles */}
            <section className="mx-auto mt-8 max-w-content px-4 sm:px-6">
              <DailyBriefBanner />

              {(articlesLoading || featuredArticles.length > 0) && (
                <div className="mb-12">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-2xl font-bold text-text-primary">Latest Articles</h2>
                    <Link
                      href={articlesHref}
                      className="flex items-center gap-1 text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium text-sm transition-colors group"
                    >
                      View all articles
                      <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>

                  {articlesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <ArticleSkeleton key={i} variant="grid" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {featuredArticles.map((article) => (
                        <ArticleCard key={article.id} article={article} variant="grid" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Browse by Topic */}
            <section className="mx-auto mt-12 max-w-content px-4 sm:px-6">
              <h2 className="text-2xl font-bold text-text-primary mb-5">
                Browse by Topic
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TOPIC_CARDS.map((topic) => (
                  <button
                    key={topic.title}
                    onClick={() => {
                      trackEvent('topic_card_clicked', {
                        topic: topic.title,
                        town_id: town.town_id,
                      });
                      handleSearch(topic.title);
                    }}
                    className="text-left bg-white border border-border-default rounded-xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all group"
                    data-pendo={`topic-${topic.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="text-3xl mb-3">{topic.icon}</div>
                    <h3 className="text-[16px] font-bold text-text-primary mb-2 group-hover:text-[var(--primary)] transition-colors">
                      {topic.title}
                    </h3>
                    <p className="text-[14px] text-text-secondary leading-relaxed">
                      {topic.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Popular Questions */}
            <section className="mx-auto mt-10 max-w-content px-4 sm:px-6 pb-12">
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
            </section>
          </>
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
