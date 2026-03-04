/**
 * Tests for timezone.ts — Eastern timezone utilities
 */

import {
  EASTERN_TZ,
  getEasternTimeHHMM,
  formatEasternTime,
} from "@/lib/timezone";

describe("EASTERN_TZ constant", () => {
  it("is America/New_York", () => {
    expect(EASTERN_TZ).toBe("America/New_York");
  });
});

describe("getEasternTimeHHMM", () => {
  it("returns a valid HH:MM pattern", () => {
    const result = getEasternTimeHHMM();
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns hours between 00 and 23", () => {
    const result = getEasternTimeHHMM();
    const hour = parseInt(result.split(":")[0], 10);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThanOrEqual(23);
  });

  it("returns minutes between 00 and 59", () => {
    const result = getEasternTimeHHMM();
    const minute = parseInt(result.split(":")[1], 10);
    expect(minute).toBeGreaterThanOrEqual(0);
    expect(minute).toBeLessThanOrEqual(59);
  });
});

describe("formatEasternTime", () => {
  it("returns empty string for null", () => {
    expect(formatEasternTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatEasternTime(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatEasternTime("")).toBe("");
  });

  it("formats EST time correctly (winter)", () => {
    // Jan 15 2025 at 18:30 UTC = 1:30 PM EST (UTC-5)
    const result = formatEasternTime("2025-01-15T18:30:00Z");
    expect(result).toBe("1:30 PM");
  });

  it("formats EDT time correctly (summer)", () => {
    // Jun 15 2025 at 18:30 UTC = 2:30 PM EDT (UTC-4)
    const result = formatEasternTime("2025-06-15T18:30:00Z");
    expect(result).toBe("2:30 PM");
  });

  it("formats time with ET offset correctly", () => {
    // Explicit Eastern offset — 6:30 PM ET
    const result = formatEasternTime("2025-06-15T18:30:00-04:00");
    expect(result).toBe("6:30 PM");
  });

  it("formats midnight correctly", () => {
    const result = formatEasternTime("2025-01-15T05:00:00Z"); // midnight EST
    expect(result).toBe("12:00 AM");
  });

  it("formats noon correctly", () => {
    const result = formatEasternTime("2025-01-15T17:00:00Z"); // noon EST
    expect(result).toBe("12:00 PM");
  });
});
