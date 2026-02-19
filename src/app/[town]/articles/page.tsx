"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArticleCard } from "@/components/ArticleCard";
import { ArticleFilters } from "@/components/ArticleFilters";
import { ArticleSkeleton } from "@/components/ArticleSkeleton";
import { useTown } from "@/lib/town-context";
import type { Article, ArticleListResponse } from "@/types/article";

const ARTICLES_PER_PAGE = 12;
const FETCH_TIMEOUT_MS = 10000;

export default function ArticlesPage() {
  const town = useTown();
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchArticles() {
      setLoading(true);
      setError(false);
      setOffset(0);

      try {
        const params = new URLSearchParams({
          town: town.town_id,
          limit: ARTICLES_PER_PAGE.toString(),
          offset: "0",
        });

        if (selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }

        if (selectedContentType !== "all") {
          params.set("content_type", selectedContentType);
        }

        const res = await fetch(`/api/articles?${params}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error("Failed to fetch articles");
        }

        const data: ArticleListResponse = await res.json();
        setArticles(data.articles ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Timeout — show error state instead of leaving skeleton forever
          setError(true);
        } else {
          console.error("Error fetching articles:", err);
          setError(true);
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    fetchArticles().catch(() => {});
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id, selectedCategory, selectedContentType, retryCount]);

  const handleLoadMore = () => {
    const newOffset = offset + ARTICLES_PER_PAGE;
    setOffset(newOffset);
    setLoadingMore(true);

    const params = new URLSearchParams({
      town: town.town_id,
      limit: ARTICLES_PER_PAGE.toString(),
      offset: newOffset.toString(),
    });

    if (selectedCategory !== "all") {
      params.set("category", selectedCategory);
    }

    if (selectedContentType !== "all") {
      params.set("content_type", selectedContentType);
    }

    fetch(`/api/articles?${params}`)
      .then((res) => res.json())
      .then((data: ArticleListResponse) => {
        setArticles((prev) => [...prev, ...data.articles]);
        setLoadingMore(false);
      })
      .catch((error) => {
        console.error("Error loading more articles:", error);
        setLoadingMore(false);
      });
  };

  const hasMore = articles.length < total;
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">Articles</span>
            </h1>
            <p className="text-lg text-white/90">
              AI-powered news and updates from official sources
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          <ArticleFilters
            selectedCategory={selectedCategory}
            selectedContentType={selectedContentType}
            onCategoryChange={(category) => {
              setSelectedCategory(category);
              setOffset(0);
            }}
            onContentTypeChange={(contentType) => {
              setSelectedContentType(contentType);
              setOffset(0);
            }}
          />

          {!loading && !error && (
            <div className="text-sm text-text-muted mb-4">
              {total} article{total !== 1 ? "s" : ""} found
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <ArticleSkeleton key={`skeleton-${i}`} variant="list" />
              ))}
            </div>
          )}

          {!loading && articles.length > 0 && (
            <div className="space-y-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} variant="list" />
              ))}
            </div>
          )}

          {!loading && hasMore && (
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

          {!loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Unable to load articles
              </h2>
              <p className="text-text-secondary mb-6">
                Something went wrong. Please try again.
              </p>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && articles.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📰</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                No articles yet
              </h2>
              <p className="text-text-secondary max-w-md mx-auto">
                Articles are generated daily from {shortTownName}&apos;s public records, meeting
                minutes, and local news. Check back soon!
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
