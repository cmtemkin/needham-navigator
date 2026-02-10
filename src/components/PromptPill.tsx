"use client";

import { useRouter } from "next/navigation";

interface PromptPillProps {
  icon: string;
  label: string;
  question: string;
}

export function PromptPill({ icon, label, question }: PromptPillProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/chat?q=${encodeURIComponent(question)}`)}
      className="shrink-0 flex items-center gap-[7px] px-4 py-2.5 bg-white border border-border-default rounded-3xl text-[13px] text-text-primary font-medium shadow-sm hover:border-primary hover:bg-[#F0F4FA] hover:shadow-md hover:-translate-y-px transition-all whitespace-nowrap cursor-pointer"
    >
      <span className="text-[15px]">{icon}</span>
      {label}
    </button>
  );
}
