"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, MessageSquare, Newspaper, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTown, useTownHref } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";

export function Header() {
  const town = useTown();
  const { t } = useI18n();
  const { openChat } = useChatWidget();
  const router = useRouter();
  const pathname = usePathname();
  const homeHref = useTownHref();
  const searchHref = useTownHref("/search");
  const articlesHref = useTownHref("/articles");
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Hide header search bar when on results page (it has its own sticky bar)
  const isOnSearchResults = pathname?.includes("/search");

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchRef.current) {
      mobileSearchRef.current.focus();
    }
  }, [mobileSearchOpen]);

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`${searchHref}?q=${encodeURIComponent(trimmed)}`);
    setSearchQuery("");
    setMobileSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border-light bg-white shadow-xs">
      <div className="mx-auto flex h-[60px] max-w-content items-center justify-between gap-3 px-4 sm:px-6">
        {/* Logo */}
        <Link href={homeHref} className="flex items-center gap-[11px] shrink-0">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-primary to-primary-light text-[15px] font-extrabold text-white">
            N
          </div>
          <div className="hidden sm:block">
            <div className="text-[17px] font-bold tracking-tight text-primary">
              {shortTownName} Navigator
            </div>
            <div className="text-[10.5px] font-medium text-text-muted">
              {t("header.tagline")}
            </div>
          </div>
        </Link>

        {/* Desktop search bar — centered, always visible except on search results page */}
        {!isOnSearchResults && (
          <div className="hidden md:flex flex-1 max-w-[480px] mx-4">
            <div className="flex w-full items-center rounded-lg border border-border-default bg-surface px-3 py-1.5 transition-all focus-within:border-primary focus-within:bg-white focus-within:shadow-sm">
              <Search size={16} className="text-text-muted shrink-0 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={`Search ${shortTownName}...`}
                className="flex-1 border-none bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-muted"
                data-pendo="header-search-input"
              />
            </div>
          </div>
        )}

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5">
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-all hover:bg-surface md:hidden"
            aria-label="Search"
          >
            <Search size={18} />
          </button>

          {/* Articles icon (desktop) */}
          {town.feature_flags.enableNews && (
            <Link
              href={articlesHref}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-all hover:bg-surface hover:text-text-primary"
              aria-label="Articles"
            >
              <Newspaper size={18} />
            </Link>
          )}

          {/* Ask Question CTA */}
          <button
            onClick={() => openChat()}
            className="hidden sm:flex items-center gap-[5px] rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-primary-light hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageSquare size={14} />
            {t("header.ask_question")}
          </button>

          {/* Mobile Ask button (icon only) */}
          <button
            onClick={() => openChat()}
            aria-label={t("header.ask_question")}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="absolute inset-x-0 top-0 z-50 flex h-[60px] items-center gap-2 bg-white px-4 shadow-md md:hidden">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={mobileSearchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
              if (e.key === "Escape") setMobileSearchOpen(false);
            }}
            placeholder={`Search ${shortTownName}...`}
            className="flex-1 border-none bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
            data-pendo="header-search-input-mobile"
          />
          <button
            onClick={() => setMobileSearchOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface"
            aria-label="Close search"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </header>
  );
}
