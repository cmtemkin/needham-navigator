"use client";

import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { PromptPill } from "@/components/PromptPill";
import { LifeSituationTile } from "@/components/LifeSituationTile";
import { PopularQuestionCard } from "@/components/PopularQuestionCard";
import { DepartmentChip } from "@/components/DepartmentChip";
import { Footer } from "@/components/Footer";
import {
  quickPrompts,
  lifeSituationTiles,
  popularQuestions,
} from "@/lib/mock-data";
import { useTown } from "@/lib/town-context";
import { useI18n } from "@/lib/i18n";

const DEPARTMENT_ICONS: Record<string, string> = {
  "Town Hall": "\uD83C\uDFE2",
  "Building Dept.": "\uD83C\uDFD7\uFE0F",
  "Planning & Dev.": "\uD83D\uDCD0",
  "Public Works": "\uD83D\uDEE0\uFE0F",
  Police: "\uD83D\uDC6E",
  "Fire Dept.": "\uD83D\uDE92",
  "Parks & Rec": "\uD83C\uDFBE",
};

export function HomePage() {
  const town = useTown();
  const { t } = useI18n();

  return (
    <>
      <Header />

      <main>
        <HeroSection />

        <section className="relative z-10 mx-auto -mt-7 max-w-content px-4 sm:px-6">
          <div className="scrollbar-hide flex gap-2.5 overflow-x-auto pb-2">
            {quickPrompts.map((prompt) => (
              <PromptPill
                key={prompt.label}
                icon={prompt.icon}
                label={prompt.label}
                question={prompt.question}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto mt-8 max-w-content px-4 sm:px-6">
          <div className="mb-4 flex items-baseline gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              {t("home.help_title")}
            </h2>
            <span className="hidden text-[13.5px] text-text-muted sm:inline">
              {t("home.help_subtitle")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            {lifeSituationTiles.map((tile) => (
              <LifeSituationTile key={tile.title} tile={tile} />
            ))}
          </div>
        </section>

        <section className="mx-auto mt-9 max-w-content px-4 sm:px-6">
          <div className="mb-4 flex items-baseline gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              {t("home.most_asked")}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {popularQuestions.map((item) => (
              <PopularQuestionCard key={item.rank} item={item} />
            ))}
          </div>
        </section>

        <section className="mx-auto mt-9 max-w-content px-4 sm:px-6">
          <div className="mb-4 flex items-baseline gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              {t("home.departments")}
            </h2>
            <span className="hidden text-[13.5px] text-text-muted sm:inline">
              {t("home.departments_subtitle")}
            </span>
          </div>
          <div className="scrollbar-hide flex gap-2.5 overflow-x-auto pb-1">
            {town.departments.map((dept) => (
              <DepartmentChip
                key={dept.name}
                dept={{
                  icon: DEPARTMENT_ICONS[dept.name] ?? "\uD83C\uDFE2",
                  name: dept.name,
                  phone: dept.phone,
                  question: dept.question,
                }}
              />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
