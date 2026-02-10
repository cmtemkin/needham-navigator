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

    // Default: return 2 tracked documents
    mockSelect.mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [
          {
            id: "doc-1",
            url: "https://www.needhamma.gov/page1",
            content_hash: "abc123",
            metadata: { etag: '"old-etag"' },
          },
          {
            id: "doc-2",
            url: "https://www.needhamma.gov/page2",
            content_hash: "def456",
            metadata: { etag: '"same-etag"' },
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

    // Mock fetch for HEAD requests
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "HEAD") {
        if (url.includes("page1")) {
          return Promise.resolve({
            ok: true,
            headers: new Map([
              ["etag", '"new-etag"'],
              ["last-modified", "Wed, 10 Jan 2024 00:00:00 GMT"],
              ["content-length", "5000"],
            ]),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Map([
            ["etag", '"same-etag"'],
            ["last-modified", "Mon, 01 Jan 2024 00:00:00 GMT"],
            ["content-length", "3000"],
          ]),
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

  it("detects changed URLs via ETag mismatch", async () => {
    const result = await runChangeDetection("needham");

    // page1 has a new etag, page2 has the same etag
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
