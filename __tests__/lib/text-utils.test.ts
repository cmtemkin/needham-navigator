/**
 * Tests for text-utils.ts — stripInternalMetadata, stripMarkdown, formatRelativeTime
 */

import { stripInternalMetadata, stripMarkdown, formatRelativeTime } from "@/lib/text-utils";

describe("stripInternalMetadata", () => {
  it("removes USED_SOURCES line from end of text", () => {
    const input = "Here is the answer.\nUSED_SOURCES: S1, S3, S5";
    expect(stripInternalMetadata(input)).toBe("Here is the answer.");
  });

  it("removes USED_SOURCES line from middle of text", () => {
    const input = "Answer part 1.\nUSED_SOURCES: S2\nMore text.";
    expect(stripInternalMetadata(input)).toBe("Answer part 1.\nMore text.");
  });

  it("handles case-insensitive match", () => {
    const input = "Answer.\nused_sources: S1, S2";
    expect(stripInternalMetadata(input)).toBe("Answer.");
  });

  it("handles USED_SOURCES: none", () => {
    const input = "No relevant info.\nUSED_SOURCES: none";
    expect(stripInternalMetadata(input)).toBe("No relevant info.");
  });

  it("returns text unchanged when no USED_SOURCES present", () => {
    const input = "Just a normal answer with no metadata.";
    expect(stripInternalMetadata(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(stripInternalMetadata("")).toBe("");
  });

  it("handles multiple USED_SOURCES lines", () => {
    const input = "Part 1.\nUSED_SOURCES: S1\nPart 2.\nUSED_SOURCES: S2, S3";
    expect(stripInternalMetadata(input)).toBe("Part 1.\nPart 2.");
  });
});

describe("stripMarkdown", () => {
  it("removes image syntax", () => {
    expect(stripMarkdown("![alt text](https://example.com/img.jpg)")).toBe("");
  });

  it("removes image with empty alt text", () => {
    expect(stripMarkdown("![](https://example.com/img.jpg)")).toBe("");
  });

  it("converts links to text", () => {
    expect(stripMarkdown("[Click here](https://example.com)")).toBe("Click here");
  });

  it("removes bold syntax", () => {
    expect(stripMarkdown("This is **bold** text")).toBe("This is bold text");
  });

  it("removes italic syntax", () => {
    expect(stripMarkdown("This is *italic* text")).toBe("This is italic text");
  });

  it("removes heading syntax", () => {
    expect(stripMarkdown("## Heading Title")).toBe("Heading Title");
    expect(stripMarkdown("### Subheading")).toBe("Subheading");
  });

  it("removes bullet characters", () => {
    expect(stripMarkdown("• Item one")).toBe("Item one");
    expect(stripMarkdown("· Item two")).toBe("Item two");
  });

  it("collapses whitespace", () => {
    expect(stripMarkdown("word   another")).toBe("word another");
  });

  it("handles combined markdown", () => {
    const input = "![](https://img.jpg) **February 11, 2026**• · The Select Board held...";
    const output = stripMarkdown(input);
    expect(output).not.toContain("![");
    expect(output).not.toContain("**");
    expect(output).toContain("February 11, 2026");
    expect(output).toContain("The Select Board held...");
  });

  it("returns clean text unchanged", () => {
    const input = "No markdown here, just plain text.";
    expect(stripMarkdown(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(stripMarkdown("")).toBe("");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.now();

  it("returns empty string for empty input", () => {
    expect(formatRelativeTime("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
  });

  it("returns 'Just now' for future dates", () => {
    const futureDate = new Date(now + 3600000).toISOString();
    expect(formatRelativeTime(futureDate)).toBe("Just now");
  });

  it("returns minutes ago for recent timestamps", () => {
    const fiveMinAgo = new Date(now - 5 * 60000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 minutes ago");
  });

  it("returns hours ago for timestamps within 24 hours", () => {
    const threeHrAgo = new Date(now - 3 * 3600000).toISOString();
    expect(formatRelativeTime(threeHrAgo)).toBe("3 hours ago");
  });

  it("returns 'Yesterday' for 1 day ago", () => {
    const yesterday = new Date(now - 86400000).toISOString();
    expect(formatRelativeTime(yesterday)).toBe("Yesterday");
  });

  it("returns days ago for 2-6 days", () => {
    const threeDays = new Date(now - 3 * 86400000).toISOString();
    expect(formatRelativeTime(threeDays)).toBe("3 days ago");
  });

  it("returns absolute date for 7+ days", () => {
    const twoWeeks = new Date(now - 14 * 86400000).toISOString();
    const result = formatRelativeTime(twoWeeks);
    // Should be a formatted date like "Feb 9, 2026"
    expect(result).toMatch(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  });

  it("compact mode returns short format", () => {
    const fiveMinAgo = new Date(now - 5 * 60000).toISOString();
    expect(formatRelativeTime(fiveMinAgo, true)).toBe("5m ago");
  });

  it("compact mode returns hours in short format", () => {
    const threeHrAgo = new Date(now - 3 * 3600000).toISOString();
    expect(formatRelativeTime(threeHrAgo, true)).toBe("3h ago");
  });

  it("compact mode returns days in short format", () => {
    const threeDays = new Date(now - 3 * 86400000).toISOString();
    expect(formatRelativeTime(threeDays, true)).toBe("3d ago");
  });

  it("handles singular minute", () => {
    const oneMinAgo = new Date(now - 60000).toISOString();
    expect(formatRelativeTime(oneMinAgo)).toBe("1 minute ago");
  });

  it("handles singular hour", () => {
    const oneHrAgo = new Date(now - 3600000).toISOString();
    expect(formatRelativeTime(oneHrAgo)).toBe("1 hour ago");
  });

  it("handles singular day", () => {
    const twoDays = new Date(now - 2 * 86400000).toISOString();
    expect(formatRelativeTime(twoDays)).toBe("2 days ago");
  });
});
