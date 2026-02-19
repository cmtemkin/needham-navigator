"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Home, MessageSquare, FileCheck, Newspaper, Info,
  ChevronDown, Cloud, Train, Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTown, useTownHref } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";

const NAV_LINK_CLASS =
  "flex items-center gap-[5px] rounded-lg px-3.5 py-[7px] text-[13.5px] font-medium text-text-secondary transition-all hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function Header() {
  const town = useTown();
  const { t } = useI18n();
  const { openChat } = useChatWidget();
  const homeHref = useTownHref();
  const aboutHref = useTownHref("/about");
  const permitsHref = useTownHref("/permits");
  const articlesHref = useTownHref("/articles");
  const weatherHref = useTownHref("/weather");
  const transitHref = useTownHref("/transit");
  const communityHref = useTownHref("/community");
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  // "More" dropdown state
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Collect feature links for the "More" dropdown
  type MoreLink = { href: string; icon: typeof Cloud; label: string };
  const moreLinks: MoreLink[] = [];
  if (town.feature_flags.enableWeather) moreLinks.push({ href: weatherHref, icon: Cloud, label: t("header.weather") });
  if (town.feature_flags.enableTransit) moreLinks.push({ href: transitHref, icon: Train, label: t("header.transit") });
  const hasCommunity = town.feature_flags.enableEvents || town.feature_flags.enableSafety || town.feature_flags.enableDining;
  if (hasCommunity) moreLinks.push({ href: communityHref, icon: Users, label: t("header.community") });

  return (
    <header className="sticky top-0 z-50 border-b border-border-light bg-white shadow-xs">
      <div className="mx-auto flex h-[60px] max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        <Link href={homeHref} className="flex items-center gap-[11px]">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-primary to-primary-light text-[15px] font-extrabold text-white">
            N
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-tight text-primary">
              {shortTownName} Navigator
            </div>
            <div className="text-[10.5px] font-medium text-text-muted">
              {t("header.tagline")}
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <Link href={homeHref} className={NAV_LINK_CLASS}>
            <Home size={15} />
            {t("header.home")}
          </Link>
          {town.feature_flags.enableNews && (
            <Link href={articlesHref} className={NAV_LINK_CLASS}>
              <Newspaper size={15} />
              Articles
            </Link>
          )}
          <Link href={permitsHref} className={NAV_LINK_CLASS}>
            <FileCheck size={15} />
            {t("header.permits")}
          </Link>
          {town.feature_flags.enableAbout && (
            <Link href={aboutHref} className={NAV_LINK_CLASS}>
              <Info size={15} />
              {t("header.about")}
            </Link>
          )}

          {moreLinks.length > 0 && (
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className={`${NAV_LINK_CLASS} ${moreOpen ? "bg-surface text-text-primary" : ""}`}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                More
                <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border-light bg-white py-1 shadow-lg z-50">
                  {moreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
                    >
                      <link.icon size={15} />
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => openChat()}
            className="flex items-center gap-[5px] rounded-lg bg-primary px-4 py-2 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-primary-light hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageSquare size={14} />
            {t("header.ask_question")}
          </button>
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          <button
            onClick={() => openChat()}
            aria-label={t("header.ask_question")}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
