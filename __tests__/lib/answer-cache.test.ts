/**
 * Tests for answer-cache.ts — normalizeQuery and cache behavior
 */

import { normalizeQuery } from "@/lib/answer-cache";

describe("answer-cache", () => {
  describe("normalizeQuery", () => {
    it("lowercases input", () => {
      expect(normalizeQuery("Transfer Station Hours")).toBe("transfer station hours");
    });

    it("strips punctuation", () => {
      expect(normalizeQuery("What are the transfer station hours?")).toBe(
        "what are the transfer station hours"
      );
    });

    it("collapses whitespace", () => {
      expect(normalizeQuery("transfer   station   hours")).toBe("transfer station hours");
    });

    it("trims leading/trailing whitespace", () => {
      expect(normalizeQuery("  building permit  ")).toBe("building permit");
    });

    it("normalizes equivalent queries to the same key", () => {
      const variants = [
        "Transfer Station Hours?",
        "transfer station hours",
        "TRANSFER STATION HOURS!",
        "  transfer   station   hours  ",
        "Transfer Station Hours...",
      ];
      const normalized = variants.map(normalizeQuery);
      expect(new Set(normalized).size).toBe(1);
    });

    it("keeps different queries distinct", () => {
      const a = normalizeQuery("building permit");
      const b = normalizeQuery("zoning regulations");
      expect(a).not.toBe(b);
    });

    it("handles empty string", () => {
      expect(normalizeQuery("")).toBe("");
    });

    it("handles string with only punctuation", () => {
      expect(normalizeQuery("???!!!")).toBe("");
    });
  });
});
