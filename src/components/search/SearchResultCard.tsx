"use client";

import { ExternalLink, MessageSquare } from "lucide-react";
import type { SearchResult } from "@/types/search";
import { trackEvent } from "@/lib/pendo";

interface SearchResultCardProps {
  result: SearchResult;
  onAskAbout: (question: string) => void;
  "data-pendo"?: string;
}

/**
 * Generate a contextual "Ask about this" question from the result title.
 * Examples:
 * - "Transfer Station - Hours & Information" → "Tell me more about transfer station hours"
 * - "Building Permits Guide" → "Tell me more about building permits"
 */
function generateAskQuestion(title: string): string {
  // Remove common suffixes
  const cleaned = title
    .replace(/\s*-\s*(Hours?|Information|Guide|Overview|Details|FAQ).*$/i, "")
    .trim();

  return `Tell me more about ${cleaned.toLowerCase()}`;
}

export function SearchResultCard({ result, onAskAbout, "data-pendo": dataPendo }: SearchResultCardProps) {
  const similarityPercent = Math.round(result.similarity * 100);

  // Determine similarity color
  const similarityColor =
    result.similarity >= 0.8
      ? "text-success"
      : result.similarity >= 0.6
      ? "text-[#0891B2]"
      : "text-text-muted";

  return (
    <div
      className="group bg-white border border-border-default rounded-[10px] p-4 hover:border-[var(--primary)] hover:shadow-sm transition-all"
      data-pendo={dataPendo}
    >
      {/* Department tag */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0891B2]" />
        <span className="text-[11px] uppercase tracking-wider font-medium text-[#0891B2]">
          {result.department}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[16px] font-bold text-[var(--primary)] mb-2 leading-snug">
        {result.title}
      </h3>

      {/* Snippet with highlights */}
      <div
        className="text-[14px] text-text-secondary leading-relaxed mb-3 [&_mark]:bg-[var(--accent-light)] [&_mark]:text-text-primary [&_mark]:font-medium [&_mark]:px-0.5"
        dangerouslySetInnerHTML={{ __html: result.snippet }}
      />

      {/* Bottom row: metadata + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[12px] text-text-muted">
          {/* Date */}
          {result.date && <span>{result.date}</span>}

          {/* Similarity */}
          <span className={`font-medium ${similarityColor}`}>
            {similarityPercent}% match
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View source button */}
          {result.source_url && (
            <a
              href={result.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent('source_link_clicked', {
                  title: result.title,
                  department: result.department,
                  similarity: result.similarity,
                  source_url: result.source_url,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:text-[var(--primary)] transition-colors"
            >
              <ExternalLink size={12} />
              View source
            </a>
          )}

          {/* Ask about this button */}
          <button
            onClick={() => {
              trackEvent('result_ask_about_clicked', {
                title: result.title,
                department: result.department,
              });
              onAskAbout(generateAskQuestion(result.title));
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EBF5FF] text-[var(--primary)] text-[12px] font-medium rounded-md hover:bg-[#D1E7FF] transition-colors"
          >
            <MessageSquare size={12} />
            Ask about this
          </button>
        </div>
      </div>
    </div>
  );
}
