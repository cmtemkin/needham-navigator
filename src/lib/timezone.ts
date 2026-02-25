/**
 * src/lib/timezone.ts — Eastern timezone utilities
 *
 * All municipal data in Needham Navigator (transit, events, meetings)
 * is in the America/New_York timezone. This module centralizes timezone
 * formatting so every component displays consistent Eastern times,
 * regardless of the user's browser timezone.
 *
 * America/New_York automatically handles EST ↔ EDT (daylight saving).
 */

export const EASTERN_TZ = "America/New_York";

/**
 * Get the current time in Eastern timezone as HH:MM (24-hour format).
 * Used for MBTA API `filter[min_time]` which expects Eastern time.
 */
export function getEasternTimeHHMM(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: EASTERN_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format an ISO timestamp as a localized time string in Eastern timezone.
 * Returns e.g. "2:30 PM". Returns "" for null/undefined input.
 */
export function formatEasternTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: EASTERN_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}
