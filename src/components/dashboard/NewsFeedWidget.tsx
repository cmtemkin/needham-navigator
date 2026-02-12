"use client";

import { Newspaper, ArrowRight } from "lucide-react";
import { NewsFeed } from "@/components/NewsFeed";
import { useTownHref } from "@/lib/town-context";

export function NewsFeedWidget() {
  const newsHref = useTownHref("/news");

  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-primary" />
          <h3 className="text-[14px] font-semibold text-text-primary">
            Local News
          </h3>
        </div>
        <a
          href={newsHref}
          className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight size={12} />
        </a>
      </div>

      <NewsFeed maxItems={5} compact />
    </div>
  );
}
