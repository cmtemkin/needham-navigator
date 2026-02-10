"use client";

import { useRouter } from "next/navigation";
import type { PopularQuestion } from "@/lib/mock-data";

interface PopularQuestionCardProps {
  item: PopularQuestion;
}

export function PopularQuestionCard({ item }: PopularQuestionCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/chat?q=${encodeURIComponent(item.chatQuestion)}`)}
      className="bg-white border border-border-light rounded-xl px-[18px] py-4 cursor-pointer transition-all hover:border-primary hover:shadow-sm hover:-translate-y-px flex items-start gap-3 text-left w-full"
    >
      <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {item.rank}
      </div>
      <div>
        <div className="text-[13.5px] text-text-primary leading-snug font-medium">
          {item.question}
        </div>
        <div className="text-[11px] text-text-muted mt-1">{item.category}</div>
      </div>
    </button>
  );
}
