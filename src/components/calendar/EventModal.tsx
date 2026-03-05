"use client";

import { useEffect, useRef } from "react";
import { X, Calendar } from "lucide-react";
import { EventRow } from "./EventRow";
import type { EventItem } from "./CalendarView";

interface EventModalProps {
  date: Date;
  events: EventItem[];
  getSourceColor: (sourceId: string) => { bg: string; text: string; dot: string; label: string };
  onClose: () => void;
}

export function EventModal({ date, events, getSourceColor, onClose }: Readonly<EventModalProps>) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Focus modal on open
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal positioning wrapper */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
        {/* Modal content */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Events for ${dateLabel}`}
          tabIndex={-1}
          className="w-full bg-white shadow-xl flex flex-col max-h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl sm:max-w-xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300 outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-default px-5 py-4 shrink-0">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Calendar size={18} className="text-[var(--primary)]" />
                {dateLabel}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {events.length} event{events.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable event list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {events.map((event) => (
              <EventRow key={event.id} event={event} getSourceColor={getSourceColor} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
