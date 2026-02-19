"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NewsFeed } from "@/components/NewsFeed";
import { Newspaper } from "lucide-react";
import { useTown } from "@/lib/town-context";

export default function NewsPage() {
  const town = useTown();

  if (!town.feature_flags.enableNews) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-content px-4 py-16 text-center sm:px-6">
          <p className="text-text-secondary">News is not enabled for this community.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Newspaper size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Local News
            </h1>
            <p className="text-[13px] text-text-muted">
              Latest local news and updates
            </p>
          </div>
        </div>

        <NewsFeed />
      </main>
      <Footer />
    </>
  );
}
