"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";
import { Calendar } from "lucide-react";
import { CalendarView } from "@/components/calendar/CalendarView";

export default function EventsPage() {
  const town = useTown();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-10 px-4">
          <div className="max-w-content mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={28} className="text-[var(--accent)]" />
              <h1 className="text-3xl font-bold">
                {shortTownName} <span className="text-[var(--accent)]">Events</span>
              </h1>
            </div>
            <p className="text-base text-white/90">
              Town meetings, library programs, school events, and community happenings
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-6">
          <CalendarView townId={town.town_id} townName={shortTownName} />
        </div>
      </main>

      <Footer />
    </>
  );
}
