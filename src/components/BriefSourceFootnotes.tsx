"use client";

import { ExternalLink } from "lucide-react";
import type { Footnote } from "@/lib/brief-citations";

interface BriefSourceFootnotesProps {
  footnotes: Footnote[];
  briefDate: string;
}

export function BriefSourceFootnotes({ footnotes, briefDate }: Readonly<BriefSourceFootnotesProps>) {
  if (footnotes.length === 0) return null;

  const formattedDate = new Date(briefDate).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mt-8 pt-6 border-t border-border-light">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Sources
      </h3>
      <div className="flex flex-wrap gap-2">
        {footnotes.map((fn) => (
          <a
            key={`fn-${fn.number}`}
            href={fn.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[5px] max-w-[320px] px-2.5 py-[5px] bg-surface border border-border-default rounded-md text-[11.5px] text-primary font-medium hover:border-primary hover:bg-[#EBF0F8] transition-all cursor-pointer no-underline"
          >
            <span className="font-bold text-text-muted shrink-0">[{fn.number}]</span>
            <ExternalLink size={10} className="shrink-0" />
            <span className="truncate">{fn.name}</span>
            <span className="text-text-muted truncate"> &middot; {formattedDate}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
