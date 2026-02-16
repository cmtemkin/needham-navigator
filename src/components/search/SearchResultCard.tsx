"use client";

import { MessageSquare } from "lucide-react";
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

/**
 * Format department name for display (proper capitalization)
 */
function formatDepartment(dept: string): string {
  return dept
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function SearchResultCard({ result, onAskAbout, "data-pendo": dataPendo }: SearchResultCardProps) {
  // Prefer AI-generated title over raw title
  const displayTitle = result.ai_title || result.title;

  // Prefer AI-generated summary over raw snippet
  const displaySnippet = result.ai_summary || result.snippet;

  // Extract domain from URL for Google-style display
  const displayUrl = result.source_url ? new URL(result.source_url).hostname + new URL(result.source_url).pathname : '';

  return (
    <div className="group pb-4" data-pendo={dataPendo}>
      {/* Department badge - polished pill style */}
      <div className="mb-1.5">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
          {formatDepartment(result.department)}
        </span>
      </div>

      {/* Title as clickable link */}
      {result.source_url ? (
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
          className="text-[18px] font-normal text-[var(--primary)] hover:underline leading-snug block mb-1"
        >
          {displayTitle}
        </a>
      ) : (
        <h3 className="text-[18px] font-normal text-[var(--primary)] leading-snug mb-1">
          {displayTitle}
        </h3>
      )}

      {/* Source URL (Google-style green) */}
      {result.source_url && (
        <div className="text-[14px] text-[#006621] mb-1 truncate">
          {displayUrl}
        </div>
      )}

      {/* Snippet/Summary - prefer AI summary for cleaner display */}
      <div
        className="text-[14px] text-text-secondary leading-relaxed line-clamp-3 mb-2 [&_mark]:bg-[var(--accent-light)] [&_mark]:text-text-primary [&_mark]:font-medium [&_mark]:px-0.5"
        dangerouslySetInnerHTML={{ __html: displaySnippet }}
      />

      {/* AI Tags (if present) */}
      {result.ai_tags && result.ai_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {result.ai_tags.slice(0, 4).map((tag, idx) => (
            <span
              key={idx}
              className="inline-block px-2 py-0.5 text-[11px] bg-gray-50 text-gray-600 rounded border border-gray-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row: metadata + actions */}
      <div className="flex items-center gap-3 flex-wrap text-[12px]">
        {/* Date */}
        {result.date && <span className="text-text-muted">{result.date}</span>}

        {/* Ask about this button - polished with clear affordance */}
        <button
          onClick={() => {
            trackEvent('result_ask_about_clicked', {
              title: result.title,
              department: result.department,
            });
            onAskAbout(generateAskQuestion(displayTitle));
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary)]/5 hover:border-[var(--primary)] transition-all font-medium"
        >
          <MessageSquare size={14} />
          Ask about this
        </button>
      </div>
    </div>
  );
}
