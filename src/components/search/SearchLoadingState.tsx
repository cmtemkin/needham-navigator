"use client";

import { useState, useEffect, useMemo } from "react";
import { Lightbulb } from "lucide-react";

const STATUS_MESSAGES = [
  "Searching town records...",
  "Finding relevant information...",
  "Analyzing results...",
  "Preparing your answer...",
];

interface SearchLoadingStateProps {
  townFacts?: string[];
}

export function SearchLoadingState({ townFacts }: Readonly<SearchLoadingStateProps>) {
  const [statusIndex, setStatusIndex] = useState(0);

  // Pick a random fun fact on mount
  const funFact = useMemo(() => {
    if (!townFacts || townFacts.length === 0) return null;
    // NOSONAR S2245 -- non-cryptographic random is safe for UI fact selection
    return townFacts[Math.floor(Math.random() * townFacts.length)];
  }, [townFacts]);

  // Rotate status message every 1.2s
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-content">
      {/* Status message with animated spinner */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-5 h-5">
          <div
            className="w-4 h-4 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin"
            aria-label="Loading"
          />
        </div>
        <p className="text-[15px] font-medium text-text-primary">
          {STATUS_MESSAGES[statusIndex]}
        </p>
      </div>

      {/* Fun fact */}
      {funFact && (
        <div className="mb-8 p-4 bg-gradient-to-r from-[var(--primary)]/5 to-[var(--accent)]/5 border border-[var(--primary)]/10 rounded-lg">
          <div className="flex items-start gap-3">
            <Lightbulb
              size={18}
              className="flex-shrink-0 mt-0.5 text-[var(--primary)]"
            />
            <div>
              <p className="text-[12px] font-semibold text-[var(--primary)] mb-1">
                Did you know?
              </p>
              <p className="text-[13px] text-text-primary leading-relaxed">
                {funFact}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton loading cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-border-default rounded-lg p-4 animate-pulse"
          >
            <div className="space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 bg-gray-100 rounded-full w-24" />
                <div className="h-6 bg-gray-100 rounded-full w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
