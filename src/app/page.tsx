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
  departments,
} from "@/lib/mock-data";

export default function Home() {
  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <HeroSection />

        {/* Quick Prompt Pills */}
        <section className="max-w-content mx-auto -mt-7 px-6 relative z-10 max-sm:px-4">
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
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

        {/* Life Situation Tiles */}
        <section className="max-w-content mx-auto mt-8 px-6 max-sm:px-4">
          <div className="flex items-baseline gap-2.5 mb-4">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              What can we help you with?
            </h2>
            <span className="text-[13.5px] text-text-muted max-sm:hidden">
              Click a topic or question to start chatting
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {lifeSituationTiles.map((tile) => (
              <LifeSituationTile key={tile.title} tile={tile} />
            ))}
          </div>
        </section>

        {/* Most Asked Questions */}
        <section className="max-w-content mx-auto mt-9 px-6 max-sm:px-4">
          <div className="flex items-baseline gap-2.5 mb-4">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Most asked questions
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
            {popularQuestions.map((item) => (
              <PopularQuestionCard key={item.rank} item={item} />
            ))}
          </div>
        </section>

        {/* Department Quick Access */}
        <section className="max-w-content mx-auto mt-9 px-6 max-sm:px-4">
          <div className="flex items-baseline gap-2.5 mb-4">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Departments
            </h2>
            <span className="text-[13.5px] text-text-muted max-sm:hidden">
              Click to ask about a department
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
            {departments.map((dept) => (
              <DepartmentChip key={dept.name} dept={dept} />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
