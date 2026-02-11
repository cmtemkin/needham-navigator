/**
 * Tests for the crawl module.
 *
 * Since crawl.ts relies heavily on external APIs (Firecrawl, Supabase),
 * we test the exported helper functions and mock the API calls.
 */

// We need to test the helper functions that are used internally.
// Since they're not exported, we test through the public interface
// with mocked dependencies.

// Mock Firecrawl — v2 API: crawl(), map(), scrape()
jest.mock("@mendable/firecrawl-js", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      crawl: jest.fn().mockResolvedValue({
        id: "test-job",
        status: "completed",
        total: 2,
        completed: 2,
        data: [
          {
            markdown: "# Town Hall\n\nVisit us at 1471 Highland Ave.\n\n[Budget PDF](/documents/budget.pdf)",
            metadata: {
              sourceURL: "https://www.needhamma.gov/town-hall",
              title: "Town Hall",
            },
          },
          {
            markdown: "# Transfer Station\n\nOpen Wed and Sat.\n\n[Fee Schedule](/docs/fees.pdf)",
            metadata: {
              sourceURL: "https://www.needhamma.gov/transfer-station",
              title: "Transfer Station",
            },
          },
        ],
      }),
      map: jest.fn().mockResolvedValue({
        links: [
          { url: "https://www.needhamma.gov/", title: "Home" },
          { url: "https://www.needhamma.gov/town-hall", title: "Town Hall" },
          { url: "https://www.needhamma.gov/transfer-station", title: "Transfer Station" },
        ],
      }),
    })),
  };
});

// Mock Supabase
const mockUpsert = jest.fn().mockResolvedValue({ error: null });
const mockSelect = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockResolvedValue({ data: [], error: null });

jest.mock("@/lib/supabase", () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      upsert: mockUpsert,
      select: mockSelect,
      eq: mockEq,
    }),
  }),
}));

describe("crawl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      FIRECRAWL_API_KEY: "test-fc-key",
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("crawls website and returns results", async () => {
    const { crawlWebsite } = await import("../../scripts/crawl");
    const results = await crawlWebsite({ limit: 10, townId: "needham" });

    expect(results).toHaveLength(2);
    expect(results[0].url).toBe("https://www.needhamma.gov/town-hall");
    expect(results[0].title).toBe("Town Hall");
    expect(results[0].sourceType).toBe("html");
    expect(results[0].contentHash).toBeDefined();
  });

  it("discovers PDF URLs from page content", async () => {
    const { crawlWebsite } = await import("../../scripts/crawl");
    const results = await crawlWebsite({ limit: 10, townId: "needham" });

    // Both pages have PDF links
    const allPdfs = results.flatMap((r) => r.pdfUrls);
    expect(allPdfs.length).toBeGreaterThan(0);
    expect(allPdfs.some((u) => u.includes(".pdf"))).toBe(true);
  });

  it("stores crawl results in Supabase", async () => {
    const { crawlWebsite } = await import("../../scripts/crawl");
    await crawlWebsite({ limit: 10, townId: "needham" });

    expect(mockUpsert).toHaveBeenCalled();
  });

  it("throws if FIRECRAWL_API_KEY is missing", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    jest.resetModules();

    const { crawlWebsite } = await import("../../scripts/crawl");
    await expect(crawlWebsite()).rejects.toThrow("Missing environment variable: FIRECRAWL_API_KEY");
  });

  it("discovers URLs via map endpoint", async () => {
    const { discoverUrls } = await import("../../scripts/crawl");
    const urls = await discoverUrls();

    expect(urls).toHaveLength(3);
    expect(urls).toContain("https://www.needhamma.gov/");
  });
});
