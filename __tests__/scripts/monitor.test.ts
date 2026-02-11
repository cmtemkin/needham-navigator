// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock Supabase
const mockSelect = jest.fn();
const mockUpdateCall = jest.fn();
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockLt = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase", () => ({
  getSupabaseServiceClient: () => ({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: mockSelect,
          update: mockUpdateCall,
        };
      }
      if (table === "ingestion_log") {
        return { insert: mockInsert };
      }
      return {};
    }),
  }),
}));

import { runChangeDetection } from "../../scripts/monitor";

describe("monitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Content hash of "original content" is a specific value
    const originalHash = require("crypto").createHash("sha256").update("original content").digest("hex");
    // Content hash of "new content" is different
    const newHash = require("crypto").createHash("sha256").update("new content").digest("hex");

    // Default: return 2 tracked documents with source_type and last_changed
    mockSelect.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: "doc-1",
            url: "https://www.needhamma.gov/page1",
            content_hash: originalHash,
            source_type: "html",
            last_changed: "2024-01-01T00:00:00Z",
            metadata: {},
          },
          {
            id: "doc-2",
            url: "https://www.needhamma.gov/page2",
            content_hash: originalHash,
            source_type: "html",
            last_changed: "2024-01-01T00:00:00Z",
            metadata: {},
          },
        ],
        error: null,
      }),
    });

    // update().eq() for individual doc metadata updates
    // update().eq().lt() for staleness flagging
    mockUpdateCall.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        then: (resolve: (val: unknown) => void) => resolve({ error: null }),
        lt: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Mock fetch for content-hash comparison
    mockFetch.mockImplementation((url: string) => {
      // page1 has NEW content (hash will differ)
      if (url.includes("page1")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("new content"),
        });
      }

      // page2 has SAME content (hash will match)
      if (url.includes("page2")) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve("original content"),
        });
      }

      // RSS feed
      if (url.includes("rss.aspx")) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              `<rss><channel>
                <link>https://www.needhamma.gov/page1</link>
                <link>https://www.needhamma.gov/new-page</link>
              </channel></rss>`
            ),
        });
      }

      return Promise.resolve({ ok: false });
    });
  });

  it("returns a valid result structure", async () => {
    const result = await runChangeDetection("needham");

    expect(result).toEqual({
      checkedUrls: expect.any(Number),
      changedUrls: expect.any(Array),
      newUrls: expect.any(Array),
      removedUrls: expect.any(Array),
      errors: expect.any(Number),
      durationMs: expect.any(Number),
    });
  });

  it("detects changed URLs via content-hash comparison", async () => {
    const result = await runChangeDetection("needham");

    // page1 has new content (different hash), page2 has same content (same hash)
    expect(result.changedUrls).toContain("https://www.needhamma.gov/page1");
    expect(result.changedUrls).not.toContain("https://www.needhamma.gov/page2");
  });

  it("detects new URLs from RSS feed", async () => {
    const result = await runChangeDetection("needham");

    expect(result.newUrls).toContain("https://www.needhamma.gov/new-page");
  });

  it("logs the monitoring run to ingestion_log", async () => {
    await runChangeDetection("needham");

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        town_id: "needham",
        action: "monitor",
      })
    );
  });
});
