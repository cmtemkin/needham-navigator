"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArticleCard } from "@/components/ArticleCard";
import { ThumbsUp, ThumbsDown, MessageCircle, ExternalLink, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useTown } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";
import type { Article, ArticleListResponse } from "@/types/article";
import { trackEvent } from "@/lib/pendo";
import ReactMarkdown from "react-markdown";

const CONTENT_TYPE_LABELS = {
  ai_generated: "AI Generated",
  ai_summary: "AI Summary",
  external: "External Link",
};

const CATEGORY_LABELS: Record<string, string> = {
  government: "Town Government",
  schools: "Schools",
  public_safety: "Public Safety",
  community: "Community",
  development: "Permits & Development",
  business: "Business",
};

function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export default function ArticleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const town = useTown();
  const { openChat } = useChatWidget();
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [feedback, setFeedback] = useState<"helpful" | "not_helpful" | null>(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/articles/${id}`);
        if (!res.ok) {
          throw new Error("Article not found");
        }
        const data: Article = await res.json();
        setArticle(data);

        const relatedRes = await fetch(
          `/api/articles?town=${town.town_id}&category=${data.category}&limit=3`
        );
        if (relatedRes.ok) {
          const relatedData: ArticleListResponse = await relatedRes.json();
          setRelatedArticles(relatedData.articles.filter((a) => a.id !== id));
        }
      } catch (error) {
        console.error("Error fetching article:", error);
      } finally {
        setLoading(false);
      }
    }

    void fetchArticle();
  }, [id, town.town_id]);

  const handleFeedback = async (type: "helpful" | "not_helpful") => {
    if (!article || feedback) return;

    setFeedback(type);

    try {
      await fetch(`/api/articles/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: type }),
      });

      trackEvent("article_feedback", {
        article_id: id,
        feedback: type,
        category: article.category,
        content_type: article.content_type,
        town_id: town.town_id,
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  const handleAskAboutThis = () => {
    if (!article) return;
    trackEvent("article_ask_about", {
      article_id: id,
      article_title: article.title,
      town_id: town.town_id,
    });
    openChat(`Tell me more about: ${article.title}`);
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-surface">
          <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!article) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-surface flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📰</div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">Article Not Found</h1>
            <p className="text-text-secondary">The requested article could not be found.</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const readingTime = estimateReadingTime(article.body);
  const publishedDate = new Date(article.published_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg p-8 mb-6 shadow-sm border border-border-default">
                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {CONTENT_TYPE_LABELS[article.content_type]}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    {CATEGORY_LABELS[article.category] || article.category}
                  </span>
                </div>

                <h1 className="text-4xl font-bold text-text-primary mb-3 leading-tight">
                  {article.title}
                </h1>

                {article.subtitle && (
                  <p className="text-xl text-text-secondary mb-4">{article.subtitle}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-text-muted border-t border-b border-border-light py-3 mb-6">
                  <span>
                    {article.content_type === "ai_generated" && "AI Generated from "}
                    {article.content_type === "ai_summary" && "Summarized from "}
                    {article.source_type?.replace(/_/g, " ")}
                  </span>
                  <span>•</span>
                  <span>{publishedDate}</span>
                  <span>•</span>
                  <span>{readingTime} min read</span>
                </div>

                {(article.content_type === "ai_generated" || article.content_type === "ai_summary") && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>AI-Generated Content:</strong> This article was generated by AI from public records.
                      Always verify important details with official sources.
                    </div>
                  </div>
                )}

                <div className="prose prose-slate max-w-none"><ReactMarkdown>{article.body}</ReactMarkdown></div>
              </div>

              {/* Sources */}
              {article.source_urls && article.source_urls.length > 0 && (
                <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-border-default">
                  <button
                    onClick={() => setSourcesExpanded(!sourcesExpanded)}
                    className="flex items-center justify-between w-full text-left mb-2"
                  >
                    <h2 className="text-lg font-bold text-text-primary">
                      Sources ({article.source_urls.length})
                    </h2>
                    {sourcesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>

                  {sourcesExpanded && (
                    <div className="space-y-2 mt-4">
                      {article.source_urls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"
                        >
                          <ExternalLink size={14} />
                          {article.source_names?.[index] || url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Engagement */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-border-default">
                <h2 className="text-lg font-bold text-text-primary mb-4">
                  Was this article helpful?
                </h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => void handleFeedback("helpful")}
                    disabled={feedback !== null}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      feedback === "helpful"
                        ? "bg-green-50 border-green-500 text-green-700"
                        : "border-border-default text-text-secondary hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsUp size={18} />
                    Helpful
                  </button>
                  <button
                    onClick={() => void handleFeedback("not_helpful")}
                    disabled={feedback !== null}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      feedback === "not_helpful"
                        ? "bg-red-50 border-red-500 text-red-700"
                        : "border-border-default text-text-secondary hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsDown size={18} />
                    Not Helpful
                  </button>
                  <button
                    onClick={handleAskAboutThis}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] transition-colors ml-auto"
                  >
                    <MessageCircle size={18} />
                    Ask about this
                  </button>
                </div>
                {feedback && (
                  <p className="text-sm text-green-600 mt-3">Thank you for your feedback!</p>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              {relatedArticles.length > 0 && (
                <div className="bg-white rounded-lg p-6 shadow-sm border border-border-default sticky top-4">
                  <h2 className="text-lg font-bold text-text-primary mb-4">Related Articles</h2>
                  <div className="space-y-4">
                    {relatedArticles.map((related) => (
                      <ArticleCard key={related.id} article={related} variant="grid" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
