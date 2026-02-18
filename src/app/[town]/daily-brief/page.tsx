"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { useTown } from "@/lib/town-context";
import type { Article, ArticleListResponse } from "@/types/article";
import ReactMarkdown from "react-markdown";

export default function DailyBriefPage() {
  const town = useTown();
  const [todayBrief, setTodayBrief] = useState<Article | null>(null);
  const [previousBriefs, setPreviousBriefs] = useState<Article[]>([]);
  const [expandedBriefs, setExpandedBriefs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  useEffect(() => {
    async function fetchBriefs() {
      try {
        let todayArticleId: string | undefined;
        const todayRes = await fetch(`/api/articles/daily-brief?town=${town.town_id}`);
        if (todayRes.ok) {
          const todayData = await todayRes.json();
          setTodayBrief(todayData.article);
          todayArticleId = todayData.article?.id;
        }

        const params = new URLSearchParams({
          town: town.town_id,
          limit: "7",
        });

        const previousRes = await fetch(`/api/articles?${params}`);
        if (previousRes.ok) {
          const previousData: ArticleListResponse = await previousRes.json();
          const briefs = previousData.articles.filter(
            (a) => a.is_daily_brief && a.id !== todayArticleId
          );
          setPreviousBriefs(briefs);
        }
      } catch (error) {
        console.error("Error fetching briefs:", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchBriefs();
  }, [town.town_id]);

  const toggleBrief = (id: string) => {
    setExpandedBriefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-[800px] mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <Calendar size={36} />
              <h1 className="text-4xl font-bold">
                Daily <span className="text-[var(--accent)]">Brief</span>
              </h1>
            </div>
            <p className="text-lg text-white/90">
              Your daily digest of {shortTownName} news and updates
            </p>
          </div>
        </div>

        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-gray-200 rounded-lg" />
              <div className="h-32 bg-gray-200 rounded-lg" />
              <div className="h-32 bg-gray-200 rounded-lg" />
            </div>
          ) : (
            <>
              {todayBrief ? (
                <div className="bg-white rounded-lg p-8 shadow-sm border border-border-default mb-8">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {"Today's Brief"}
                    </span>
                    <span className="text-sm text-text-muted">{today}</span>
                  </div>

                  <h2 className="text-3xl font-bold text-text-primary mb-6">{todayBrief.title}</h2>

                  <div className="prose prose-slate max-w-none"><ReactMarkdown>{todayBrief.body}</ReactMarkdown></div>

                  {todayBrief.source_urls && todayBrief.source_urls.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-border-light">
                      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                        Sources
                      </h3>
                      <ul className="space-y-1">
                        {todayBrief.source_urls.map((url, i) => {
                          let hostname: string;
                          try {
                            hostname = new URL(url).hostname.replace(/^www\./, "");
                          } catch {
                            hostname = url;
                          }
                          return (
                            <li key={i}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-[var(--primary)] hover:underline"
                              >
                                {todayBrief.source_names?.[i] || hostname}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-lg p-12 shadow-sm border border-border-default mb-8 text-center">
                  <div className="text-6xl mb-4">📰</div>
                  <h2 className="text-2xl font-bold text-text-primary mb-2">
                    {"Today's brief hasn't been generated yet"}
                  </h2>
                  <p className="text-text-secondary">
                    Check back after 5 AM for your daily digest of {shortTownName} news.
                  </p>
                </div>
              )}

              {previousBriefs.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-text-primary mb-4">Previous Briefs</h2>

                  <div className="space-y-3">
                    {previousBriefs.map((brief) => {
                      const isExpanded = expandedBriefs.has(brief.id);
                      const date = new Date(brief.published_at).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <div
                          key={brief.id}
                          className="bg-white rounded-lg border border-border-default shadow-sm overflow-hidden"
                        >
                          <button
                            onClick={() => toggleBrief(brief.id)}
                            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div>
                              <h3 className="text-lg font-bold text-text-primary mb-1">
                                {brief.title}
                              </h3>
                              <p className="text-sm text-text-muted">{date}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronDown size={20} className="text-text-muted flex-shrink-0" />
                            ) : (
                              <ChevronRight size={20} className="text-text-muted flex-shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-border-light pt-5">
                              <div className="prose prose-slate max-w-none"><ReactMarkdown>{brief.body}</ReactMarkdown></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!loading && !todayBrief && previousBriefs.length === 0 && (
                <div className="bg-white rounded-lg p-12 shadow-sm border border-border-default text-center">
                  <div className="text-6xl mb-4">📭</div>
                  <h2 className="text-2xl font-bold text-text-primary mb-2">
                    No briefs available yet
                  </h2>
                  <p className="text-text-secondary max-w-md mx-auto">
                    Daily briefs will appear here as they are generated. Check back soon!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
