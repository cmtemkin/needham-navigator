"use client";

import { useState, useEffect } from "react";
import { Newspaper, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Article } from "@/types/article";
import { useTownHref, useTown } from "@/lib/town-context";

export function DailyBriefBanner() {
  const [brief, setBrief] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const dailyBriefHref = useTownHref("/daily-brief");
  const town = useTown();

  useEffect(() => {
    async function fetchDailyBrief() {
      try {
        const res = await fetch(`/api/articles/daily-brief?town=${town.town_id}`);
        if (!res.ok) {
          setBrief(null);
          return;
        }
        const data = await res.json();
        setBrief(data.article);
      } catch (error) {
        console.error("Failed to fetch daily brief:", error);
        setBrief(null);
      } finally {
        setLoading(false);
      }
    }

    void fetchDailyBrief();
  }, [town.town_id]);

  // Don't render anything if loading or no brief exists
  if (loading || !brief) {
    return null;
  }

  // Extract bullet points from summary (simple version - just split by periods/dashes)
  const bulletPoints = brief.summary
    ?.split(/[.•-]\s+/)
    .filter((s) => s.trim().length > 10)
    .slice(0, 4) || [];

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white rounded-xl p-6 shadow-lg mb-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 bg-white/10 rounded-lg p-3">
          <Newspaper size={28} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold mb-1">
            Today in {town.name.replace(/,\s*[A-Z]{2}$/i, "")}
          </h2>
          <p className="text-white/80 text-sm mb-4">{today}</p>

          {bulletPoints.length > 0 && (
            <ul className="space-y-2 mb-4">
              {bulletPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2 text-[15px] text-white/95">
                  <span className="text-[var(--accent)] mt-1">•</span>
                  <span className="flex-1">{point.trim()}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={dailyBriefHref}
            className="inline-flex items-center gap-1 text-[var(--accent)] hover:text-white font-medium text-sm transition-colors group"
          >
            Read full brief
            <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
