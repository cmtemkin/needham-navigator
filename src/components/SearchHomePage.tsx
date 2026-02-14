"use client";

import { useState, useRef, useCallback } from "react";
import { Search, FileText, Trash2, Building2, School, DollarSign, Bus } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SearchResultCard } from "@/components/search/SearchResultCard";
import { AIAnswerCard } from "@/components/search/AIAnswerCard";
import { FloatingChat, type FloatingChatHandle } from "@/components/search/FloatingChat";
import { useTown } from "@/lib/town-context";
import { parseStreamResponse } from "@/lib/stream-parser";
import type { SearchResponse, CachedAnswer } from "@/types/search";
import type { MockSource } from "@/lib/mock-data";
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
  | { type: "prompt" };

export function SearchHomePage() {
  const town = useTown();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");
  const chatRef = useRef<FloatingChatHandle>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [aiAnswer, setAiAnswer] = useState<AIAnswerState>({ type: "idle" });
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(
    async (q: string) => {
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

        // 3. No cache → auto-generate AI answer in background
        // Only if top result has high similarity (>= 0.7)
        if (data.results.length > 0 && data.results[0].similarity >= 0.7) {
          setAiAnswer({ type: "loading" });

          const chatRes = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: q }],
              town_id: town.town_id,
            }),
          });

          if (!chatRes.ok) {
            setAiAnswer({ type: "idle" });
            return;
          }

          let fullText = "";
          let sources: MockSource[] = [];

          await parseStreamResponse(chatRes, {
            onText: (delta) => {
              fullText += delta;
            },
            onSources: (srcs) => {
              sources = srcs;
            },
            onDone: () => {
              setAiAnswer({
                type: "loaded",
                html: fullText,
                sources: sources.map((s) => ({ title: s.title ?? "Source", url: s.url ?? "" })),
              });
            },
            onError: (error) => {
              console.error("AI answer stream error:", error);
              setAiAnswer({ type: "idle" });
            },
          });
        } else {
          // Low similarity or no results → show prompt button
          setAiAnswer({ type: "prompt" });
          if (data.results.length === 0) {
            trackEvent('search_no_results', {
              query_length: q.length,
              town_id: town.town_id,
            });
          }
        }
      } catch (error) {
        console.error("Search error:", error);
        setIsSearching(false);
      }
    },
    [town.town_id]
  );

  const handleGenerateAnswer = useCallback(async () => {
    if (!query) return;

    setAiAnswer({ type: "loading" });

    trackEvent('ai_answer_requested', {
      query_length: query.length,
      town_id: town.town_id,
    });

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: query }],
          town_id: town.town_id,
        }),
      });

      if (!chatRes.ok) {
        setAiAnswer({ type: "idle" });
        return;
      }

      let fullText = "";
      let sources: MockSource[] = [];

      await parseStreamResponse(chatRes, {
        onText: (delta) => {
          fullText += delta;
        },
        onSources: (srcs) => {
          sources = srcs;
        },
        onDone: () => {
          setAiAnswer({
            type: "loaded",
            html: fullText,
            sources: sources.map((s) => ({ title: s.title ?? "Source", url: s.url ?? "" })),
          });
          trackEvent('ai_answer_generated', {
            query_length: query.length,
            town_id: town.town_id,
            response_length: fullText.length,
            source_count: sources.length,
          });
        },
        onError: (error) => {
          console.error("AI answer stream error:", error);
          setAiAnswer({ type: "idle" });
        },
      });
    } catch (error) {
      console.error("Generate answer error:", error);
      setAiAnswer({ type: "idle" });
    }
  }, [query, town.town_id]);

  const handleAskAbout = useCallback((question: string) => {
    trackEvent('ask_about_clicked', {
      question_length: question.length,
      town_id: town.town_id,
    });
    chatRef.current?.openWithMessage(question);
  }, [town.town_id]);

  const handleFollowUp = useCallback((question: string) => {
    chatRef.current?.openWithMessage(question);
  }, []);

  const showResults = searchResults !== null;

  return (
    <>
      <Header />

      <main>
        {/* Search Hero */}
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
            {!showResults && (
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
            )}
          </div>
        </section>

        {/* Default State (no query) */}
        {!showResults && (
          <>
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
          <section className="mx-auto mt-8 max-w-content px-4 sm:px-6 pb-12">
            {/* AI Answer */}
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
            {aiAnswer.type === "prompt" && (
              <AIAnswerCard state="prompt" onGenerate={handleGenerateAnswer} data-pendo="generate-ai-answer" />
            )}

            {/* Results header */}
            <div className="flex items-center gap-3 mb-4">
              <FileText size={18} className="text-[var(--primary)]" />
              <h2 className="text-xl font-bold text-text-primary">
                Source Documents
              </h2>
              {searchResults && (
                <span className="text-[13px] text-text-muted">
                  {searchResults.results.length} results · {searchResults.timing_ms}ms
                </span>
              )}
            </div>

            {/* Result cards */}
            {searchResults && searchResults.results.length > 0 ? (
              <div className="space-y-3">
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
              <div className="text-center py-12 text-text-secondary">
                <p className="text-[15px]">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-[13px] mt-2">Try a different search term</p>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />

      {/* Floating Chat */}
      <FloatingChat ref={chatRef} townId={town.town_id} />
    </>
  );
}
