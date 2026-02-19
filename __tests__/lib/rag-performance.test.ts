/**
 * Tests for RAG performance optimizations:
 * - Pre-computed embeddings (no duplicate API calls)
 * - Reduced match count (DEFAULT_MATCH_COUNT = 20)
 */

// Track calls to generateEmbedding to verify dedup
const mockGenerateEmbedding = jest.fn();

jest.mock("@/lib/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  EMBEDDING_MODEL: "text-embedding-3-large",
  EMBEDDING_DIMENSIONS: 1536,
}));

// Mock Supabase client
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mockRpc,
    from: (...args: unknown[]) => {
      const result = mockFrom(...args);
      return result;
    },
  }),
}));

// Mock towns
jest.mock("@/lib/towns", () => ({
  DEFAULT_TOWN_ID: "needham",
}));

// Mock synonyms
jest.mock("@/lib/synonyms", () => ({
  expandQuery: (query: string) => ({
    expanded: [],
    expandedQuery: query,
  }),
}));

// Mock query rewriter
jest.mock("@/lib/query-rewriter", () => ({
  rewriteQuery: jest.fn().mockResolvedValue(null),
}));

// Mock pendo
jest.mock("@/lib/pendo", () => ({
  trackEvent: jest.fn(),
}));

// Mock cohere
jest.mock("cohere-ai", () => ({
  CohereClient: jest.fn(),
}));

import { retrieveRelevantChunks } from "@/lib/rag";

describe("RAG performance optimizations", () => {
  const fakeEmbedding = new Array(1536).fill(0.5);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(fakeEmbedding);

    // Default: match_documents returns some results, match_content_items returns empty
    mockRpc.mockImplementation((name: string) => {
      if (name === "match_documents") {
        return {
          data: [
            {
              id: "chunk-1",
              chunk_text: "Transfer station hours are Monday to Saturday 7am-3pm.",
              metadata: { document_title: "DPW Info", document_url: "https://example.com/dpw" },
              similarity: 0.85,
            },
            {
              id: "chunk-2",
              chunk_text: "The transfer station accepts yard waste in spring and fall.",
              metadata: { document_title: "DPW Info", document_url: "https://example.com/dpw" },
              similarity: 0.78,
            },
          ],
          error: null,
        };
      }
      if (name === "match_content_items") {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    });
  });

  describe("pre-computed embeddings", () => {
    it("generates embedding only once for original query (shared across vectorSearch + vectorSearchContentItems)", async () => {
      await retrieveRelevantChunks("transfer station hours", { townId: "needham" });

      // Should only generate ONE embedding for the original query
      // (previously generated 2: one for vectorSearch, one for vectorSearchContentItems)
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("transfer station hours");
    });

    it("passes the same pre-computed embedding to both search RPCs", async () => {
      await retrieveRelevantChunks("building permit", { townId: "needham" });

      // Both match_documents and match_content_items should receive the same embedding
      const matchDocumentsCall = mockRpc.mock.calls.find(
        (call: unknown[]) => call[0] === "match_documents"
      );
      const matchContentItemsCall = mockRpc.mock.calls.find(
        (call: unknown[]) => call[0] === "match_content_items"
      );

      expect(matchDocumentsCall).toBeDefined();
      expect(matchContentItemsCall).toBeDefined();
      expect(matchDocumentsCall![1].query_embedding).toEqual(fakeEmbedding);
      expect(matchContentItemsCall![1].query_embedding).toEqual(fakeEmbedding);
    });

    it("generates separate embedding for expanded query when synonyms exist", async () => {
      // Override synonym mock for this test
      const synonymsMod = require("@/lib/synonyms");
      const origExpandQuery = synonymsMod.expandQuery;
      synonymsMod.expandQuery = () => ({
        expanded: ["trash", "garbage"],
        expandedQuery: "transfer station hours trash garbage",
      });

      const expandedEmbedding = new Array(1536).fill(0.6);
      mockGenerateEmbedding
        .mockResolvedValueOnce(fakeEmbedding)       // original query
        .mockResolvedValueOnce(expandedEmbedding);   // expanded query

      await retrieveRelevantChunks("transfer station hours", { townId: "needham" });

      // Should generate exactly 2 embeddings: original + expanded
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("transfer station hours");
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("transfer station hours trash garbage");

      // Restore
      synonymsMod.expandQuery = origExpandQuery;
    });
  });

  describe("reduced match count", () => {
    it("requests 20 documents by default (not 30)", async () => {
      await retrieveRelevantChunks("zoning regulations", { townId: "needham" });

      const matchDocumentsCall = mockRpc.mock.calls.find(
        (call: unknown[]) => call[0] === "match_documents"
      );
      expect(matchDocumentsCall).toBeDefined();
      expect(matchDocumentsCall![1].match_count).toBe(20);
    });

    it("requests ceil(matchCount/2) = 10 content items by default", async () => {
      await retrieveRelevantChunks("zoning regulations", { townId: "needham" });

      const contentItemsCall = mockRpc.mock.calls.find(
        (call: unknown[]) => call[0] === "match_content_items"
      );
      expect(contentItemsCall).toBeDefined();
      expect(contentItemsCall![1].match_count).toBe(10);
    });

    it("allows overriding match count via options", async () => {
      await retrieveRelevantChunks("test query", {
        townId: "needham",
        matchCount: 50,
      });

      const matchDocumentsCall = mockRpc.mock.calls.find(
        (call: unknown[]) => call[0] === "match_documents"
      );
      expect(matchDocumentsCall![1].match_count).toBe(50);
    });
  });

  describe("empty/edge cases", () => {
    it("returns empty array for empty query", async () => {
      const result = await retrieveRelevantChunks("", { townId: "needham" });
      expect(result).toEqual([]);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only query", async () => {
      const result = await retrieveRelevantChunks("   ", { townId: "needham" });
      expect(result).toEqual([]);
      expect(mockGenerateEmbedding).not.toHaveBeenCalled();
    });

    it("handles Supabase content_items failure gracefully", async () => {
      mockRpc.mockImplementation((name: string) => {
        if (name === "match_documents") {
          return {
            data: [{
              id: "chunk-1",
              chunk_text: "Some content.",
              metadata: { document_title: "Test" },
              similarity: 0.8,
            }],
            error: null,
          };
        }
        if (name === "match_content_items") {
          return { data: null, error: { message: "connection timeout" } };
        }
        return { data: [], error: null };
      });

      // Should not throw — content_items failure is non-fatal
      const result = await retrieveRelevantChunks("test query", { townId: "needham" });
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
