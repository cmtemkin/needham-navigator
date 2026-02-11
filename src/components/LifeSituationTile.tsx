"use client";

import { useRouter } from "next/navigation";
import type { TileData } from "@/lib/mock-data";
import { useTownHref } from "@/lib/town-context";

interface LifeSituationTileProps {
  tile: TileData;
}

export function LifeSituationTile({ tile }: LifeSituationTileProps) {
  const router = useRouter();
  const chatHref = useTownHref("/chat");

  const navigate = (question: string) => {
    router.push(`${chatHref}?q=${encodeURIComponent(question)}`);
  };

  return (
    <div
      onClick={() => navigate(tile.defaultQuestion)}
      className="bg-white border border-border-light rounded-xl p-[22px_20px_18px] transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group"
      role="button"
      tabIndex={0}
      aria-label={tile.title}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(tile.defaultQuestion);
        }
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] mb-3.5"
        style={{ background: tile.iconBg }}
      >
        {tile.icon}
      </div>
      <div className="text-[15px] font-bold text-text-primary mb-[5px] tracking-tight">
        {tile.title}
      </div>
      <div className="text-[12.5px] text-text-secondary leading-relaxed mb-3">
        {tile.description}
      </div>
      <div className="flex flex-col gap-[5px]">
        {tile.subPrompts.map((prompt) => (
          <button
            key={prompt.label}
            onClick={(e) => {
              e.stopPropagation();
              navigate(prompt.question);
            }}
            className="flex items-center gap-1.5 text-xs text-primary font-medium px-2 py-[5px] rounded-md hover:bg-[#EBF0F8] transition-colors text-left group/prompt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span>{prompt.label}</span>
            <span className="text-[10px] opacity-0 -translate-x-1 group-hover/prompt:opacity-100 group-hover/prompt:translate-x-0 transition-all">
              &rarr;
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
