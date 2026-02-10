"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap } from "lucide-react";

export function HeroSection() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary via-primary-dark to-[#001A3D] px-6 pt-14 pb-12 text-center">
      {/* Decorative gradient overlay */}
      <div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 30% 50%, rgba(212,175,55,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.04) 0%, transparent 40%)",
        }}
      />

      <div className="relative z-10 max-w-[640px] mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-[20px] px-3.5 py-[5px] text-xs text-white/85 font-medium mb-5 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
          AI-Powered &middot; Always Up to Date
        </div>

        <h1 className="text-[34px] font-extrabold text-white leading-tight tracking-tight mb-3">
          Your guide to everything{" "}
          <span className="text-accent">Needham</span>
        </h1>

        <p className="text-base text-white/70 leading-relaxed max-w-[480px] mx-auto mb-7">
          Ask questions about town services, permits, schools, zoning, and more.
          Get instant answers with official sources.
        </p>

        {/* Search bar */}
        <div className="max-w-[560px] mx-auto">
          <div className="flex items-center bg-white rounded-[14px] p-[5px] pl-[18px] shadow-hero focus-within:shadow-hero-focus transition-shadow">
            <Search size={18} className="text-text-muted shrink-0 mr-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder='Try: "What permits do I need for a deck?"'
              className="flex-1 border-none bg-transparent outline-none text-[15px] text-text-primary py-3 placeholder:text-[#B0B5C0]"
            />
            <button
              onClick={handleSubmit}
              className="px-5 py-[11px] bg-primary text-white rounded-[10px] text-sm font-semibold hover:bg-primary-light transition-colors whitespace-nowrap"
            >
              Ask Navigator
            </button>
          </div>

          <p className="text-xs text-white/45 mt-3 flex items-center justify-center gap-1.5">
            <Zap size={12} />
            Powered by AI &middot; Sourced from official Needham documents
          </p>
        </div>
      </div>
    </section>
  );
}
