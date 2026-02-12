"use client";

import Link from "next/link";
import { Home, MessageSquare, FileCheck, Newspaper } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import { useTown, useTownHref } from "@/lib/town-context";

export function Header() {
  const town = useTown();
  const { t } = useI18n();
  const homeHref = useTownHref();
  const chatHref = useTownHref("/chat");
  const permitsHref = useTownHref("/permits");
  const newsHref = useTownHref("/news");
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

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
          <LanguageToggle />
          <Link
            href={homeHref}
            className="flex items-center gap-[5px] rounded-lg px-3.5 py-[7px] text-[13.5px] font-medium text-text-secondary transition-all hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Home size={15} />
            {t("header.home")}
          </Link>
          {town.feature_flags.enableNews && (
            <Link
              href={newsHref}
              className="flex items-center gap-[5px] rounded-lg px-3.5 py-[7px] text-[13.5px] font-medium text-text-secondary transition-all hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Newspaper size={15} />
              News
            </Link>
          )}
          <Link
            href={permitsHref}
            className="flex items-center gap-[5px] rounded-lg px-3.5 py-[7px] text-[13.5px] font-medium text-text-secondary transition-all hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <FileCheck size={15} />
            {t("header.permits")}
          </Link>
          <Link
            href={chatHref}
            className="flex items-center gap-[5px] rounded-lg bg-primary px-3.5 py-[7px] text-[13.5px] font-semibold text-white transition-all hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageSquare size={14} />
            {t("header.ask_question")}
          </Link>
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
          <LanguageToggle />
          <Link
            href={chatHref}
            aria-label={t("header.ask_question")}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageSquare size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
