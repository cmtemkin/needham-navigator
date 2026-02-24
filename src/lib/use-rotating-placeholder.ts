"use client";

import { useState, useEffect } from "react";

/**
 * Returns a rotating placeholder string that cycles every `intervalMs`.
 * Pauses rotation if `paused` is true (e.g., when the user has typed something).
 */
export function useRotatingPlaceholder(
  placeholders: string[],
  intervalMs = 3500,
  paused = false
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || placeholders.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % placeholders.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [placeholders.length, intervalMs, paused]);

  return placeholders[index] ?? placeholders[0] ?? "";
}
