/**
 * Tests for the scraper module.
 *
 * Tests the scraper configuration helpers and content extraction.
 * The actual crawling is tested via integration tests against real URLs.
 */

import {
  shouldSkipUrl,
  isAllowedDomain,
  isPdfUrl,
  getDepartmentFromUrl,
  NEEDHAM_CONFIG,
} from "../../scripts/scraper-config";

describe("scraper-config", () => {
  describe("shouldSkipUrl", () => {
    it("skips calendar URLs", () => {
      expect(shouldSkipUrl("https://www.needhamma.gov/Calendar.aspx")).toBe(true);
    });

    it("skips image URLs", () => {
      expect(shouldSkipUrl("https://www.needhamma.gov/photo.jpg")).toBe(true);
      expect(shouldSkipUrl("https://www.needhamma.gov/logo.png")).toBe(true);
    });

    it("skips login URLs", () => {
      expect(shouldSkipUrl("https://www.needhamma.gov/Login.aspx")).toBe(true);
    });

    it("skips mailto links", () => {
      expect(shouldSkipUrl("mailto:admin@needhamma.gov")).toBe(true);
    });

    it("allows regular content URLs", () => {
      expect(shouldSkipUrl("https://www.needhamma.gov/87/Public-Works")).toBe(false);
      expect(shouldSkipUrl("https://www.needhamma.gov/1614/Zoning-By-Laws")).toBe(false);
    });
  });

  describe("isAllowedDomain", () => {
    it("allows needhamma.gov", () => {
      expect(isAllowedDomain("https://www.needhamma.gov/page")).toBe(true);
      expect(isAllowedDomain("https://needhamma.gov/page")).toBe(true);
    });

    it("rejects other domains", () => {
      expect(isAllowedDomain("https://www.example.com")).toBe(false);
      expect(isAllowedDomain("https://www.someotherrandomsite.org")).toBe(false);
    });

    it("handles invalid URLs gracefully", () => {
      expect(isAllowedDomain("not-a-url")).toBe(false);
    });
  });

  describe("isPdfUrl", () => {
    it("detects PDF URLs", () => {
      expect(isPdfUrl("https://www.needhamma.gov/docs/budget.pdf")).toBe(true);
      expect(isPdfUrl("https://www.needhamma.gov/docs/budget.PDF")).toBe(true);
    });

    it("detects PDFs with query params", () => {
      expect(isPdfUrl("https://www.needhamma.gov/docs/budget.pdf?v=2")).toBe(true);
    });

    it("rejects non-PDF URLs", () => {
      expect(isPdfUrl("https://www.needhamma.gov/page")).toBe(false);
      expect(isPdfUrl("https://www.needhamma.gov/page.html")).toBe(false);
    });
  });

  describe("getDepartmentFromUrl", () => {
    it("detects Planning department", () => {
      expect(getDepartmentFromUrl("https://www.needhamma.gov/planning/board")).toBe(
        "Planning & Community Development"
      );
    });

    it("detects Public Works", () => {
      expect(getDepartmentFromUrl("https://www.needhamma.gov/87/Public-Works")).toBe(
        "Public Works"
      );
    });

    it("detects Board of Health", () => {
      expect(getDepartmentFromUrl("https://www.needhamma.gov/health/regulations")).toBe(
        "Board of Health"
      );
    });

    it("returns undefined for unknown paths", () => {
      expect(getDepartmentFromUrl("https://www.needhamma.gov/")).toBeUndefined();
    });
  });

  describe("NEEDHAM_CONFIG", () => {
    it("has required fields", () => {
      expect(NEEDHAM_CONFIG.townId).toBe("needham");
      expect(NEEDHAM_CONFIG.seedUrls).toContain("https://www.needhamma.gov");
      expect(NEEDHAM_CONFIG.maxDepth).toBeGreaterThan(0);
      expect(NEEDHAM_CONFIG.crawlDelayMs).toBeGreaterThanOrEqual(1000);
    });

    it("has polite crawl delay", () => {
      // Ensure we don't accidentally set an aggressive crawl rate
      expect(NEEDHAM_CONFIG.crawlDelayMs).toBeGreaterThanOrEqual(500);
    });
  });
});
