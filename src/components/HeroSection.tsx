"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTown, useTownHref } from "@/lib/town-context";

export function HeroSection() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const town = useTown();
  const chatHref = useTownHref("/chat");
  const { t } = useI18n();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    router.push(`${chatHref}?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary via-primary-dark to-[#001A3D] px-4 pb-12 pt-12 text-center sm:px-6 sm:pt-14">
      <div
        className="pointer-events-none absolute -left-1/2 -top-1/2 h-[200%] w-[200%]"
        style={{
          background:
            "radial-gradient(circle at 30% 50%, rgba(212,175,55,0.08) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.04) 0%, transparent 40%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[640px]">
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-[20px] border border-white/15 bg-white/10 px-3.5 py-[5px] text-xs font-medium text-white/85 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
          {t("hero.badge")}
        </div>

        <h1 className="mb-3 text-[30px] font-extrabold leading-tight tracking-tight text-white sm:text-[34px]">
          {t("hero.title_prefix")} <span className="text-accent">{shortTownName}</span>
        </h1>

        <p className="mx-auto mb-7 max-w-[520px] text-base leading-relaxed text-white/70">
          {t("hero.subtitle")}
        </p>

        <form
          className="mx-auto max-w-[560px]"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex items-center rounded-[14px] bg-white p-[5px] pl-[14px] shadow-hero transition-shadow focus-within:shadow-hero-focus max-sm:flex-col max-sm:items-stretch max-sm:gap-2 max-sm:p-2 max-sm:pl-2">
            <Search
              size={18}
              className="mr-2.5 shrink-0 self-center text-text-muted max-sm:mr-0"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("hero.search_placeholder")}
              className="flex-1 border-none bg-transparent py-3 text-[15px] text-text-primary outline-none placeholder:text-[#B0B5C0]"
              aria-label={t("hero.search_placeholder")}
            />
            <button
              type="submit"
              className="whitespace-nowrap rounded-[10px] bg-primary px-5 py-[11px] text-sm font-semibold text-white transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary max-sm:w-full"
            >
              {t("hero.ask_navigator")}
            </button>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/50">
            <Zap size={12} aria-hidden="true" />
            {t("hero.powered_by", { town: shortTownName })}
          </p>
        </form>
      </div>
    </section>
  );
}
