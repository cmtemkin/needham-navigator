"use client";

import { Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Article } from "@/types/article";
import { useTown, useTownHref } from "@/lib/town-context";

interface ArticleCardProps {
  article: Article;
  variant?: "grid" | "list";
  /** Timestamp of user's last visit — articles newer than this show a "NEW" badge */
  lastVisitTimestamp?: number;
}

const CONTENT_TYPE_STYLES = {
  ai_generated: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    label: "AI Generated",
  },
  ai_summary: {
    bg: "bg-green-100",
    text: "text-green-800",
    label: "AI Summary",
  },
  external: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: "External",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  government: "Town Government",
  schools: "Schools",
  public_safety: "Public Safety",
  community: "Community",
  development: "Permits & Development",
  business: "Business",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function ArticleCard({ article, variant = "grid", lastVisitTimestamp }: ArticleCardProps) {
  const town = useTown();
  const articleHref = useTownHref(`/articles/${article.id}`);
  const isNew = lastVisitTimestamp != null && new Date(article.published_at).getTime() > lastVisitTimestamp;
  const contentTypeStyle = CONTENT_TYPE_STYLES[article.content_type];
  const categoryLabel = CATEGORY_LABELS[article.category] || article.category;

  return (
    <Link
      href={articleHref}
      className={`group block bg-white border border-border-default rounded-lg hover:border-[var(--primary)] hover:shadow-md transition-all ${
        variant === "list" ? "p-5" : "p-4"
      }`}
    >
      {/* Header badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${contentTypeStyle.bg} ${contentTypeStyle.text}`}>
          {contentTypeStyle.label}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-700">
          {categoryLabel}
        </span>
        {isNew && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--accent)] text-white uppercase tracking-wider">
            New
          </span>
        )}
        {article.content_type === "external" && (
          <ExternalLink size={14} className="text-gray-400" />
        )}
      </div>

      {/* Title */}
      <h3 className={`font-bold text-text-primary group-hover:text-[var(--primary)] transition-colors mb-2 ${
        variant === "list" ? "text-lg" : "text-base"
      }`}>
        {article.title}
      </h3>

      {/* Subtitle (if present) */}
      {article.subtitle && (
        <p className="text-sm text-text-secondary mb-2 line-clamp-1">
          {article.subtitle}
        </p>
      )}

      {/* Summary */}
      <p className={`text-sm text-text-secondary mb-3 ${variant === "list" ? "line-clamp-3" : "line-clamp-2"}`}>
        {article.summary || article.body.substring(0, 150) + "..."}
      </p>

      {/* Footer - Source and timestamp */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-light">
        <div className="flex items-center gap-1">
          {article.source_names && article.source_names.length > 0 ? (
            <span className="truncate max-w-[200px]">
              {article.source_names[0]}
            </span>
          ) : (
            <span>{town.app_name}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{formatRelativeTime(article.published_at)}</span>
        </div>
      </div>
    </Link>
  );
}
