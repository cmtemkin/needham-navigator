/**
 * Tests for RAG performance optimizations:
 * - Pre-computed embeddings (no duplicate API calls)
 * - Reduced match count (DEFAULT_MATCH_COUNT = 20)
 * - Pinecone vector search + Supabase metadata fetch
 */

// Track calls to generateEmbedding to verify dedup
const mockGenerateEmbedding = jest.fn();

jest.mock("@/lib/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => mockGenerateEmbedding(...args),
  EMBEDDING_MODEL: "text-embedding-3-large",
  EMBEDDING_DIMENSIONS: 1536,
}));

// Mock Pinecone
const mockQueryPinecone = jest.fn();
jest.mock("@/lib/pinecone", () => ({
  queryPinecone: (...args: unknown[]) => mockQueryPinecone(...args),
  PINECONE_NS_CHUNKS: "chunks",
  PINECONE_NS_CONTENT: "content",
}));

// Mock Supabase client (used for metadata fetch after Pinecone query)
const mockSelect = jest.fn();
const mockIn = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
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

    // Default: Pinecone chunks query returns results, content query returns empty
    mockQueryPinecone.mockImplementation((namespace: string) => {
      if (namespace === "chunks") {
        return [
          { id: "chunk-1", score: 0.85 },
          { id: "chunk-2", score: 0.78 },
        ];
      }
      if (namespace === "content") {
        return [];
      }
      return [];
    });

    // Default: Supabase metadata fetch returns matching data
    mockIn.mockResolvedValue({
      data: [
        {
          id: "chunk-1",
          chunk_text: "Transfer station hours are Monday to Saturday 7am-3pm.",
          metadata: { document_title: "DPW Info", document_url: "https://example.com/dpw" },
        },
        {
          id: "chunk-2",
          chunk_text: "The transfer station accepts yard waste in spring and fall.",
          metadata: { document_title: "DPW Info", document_url: "https://example.com/dpw" },
        },
      ],
      error: null,
    });

    mockSelect.mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  describe("pre-computed embeddings", () => {
    it("generates embedding only once for original query (shared across vectorSearch + vectorSearchContentItems)", async () => {
      await retrieveRelevantChunks("transfer station hours", { townId: "needham" });

      // Should only generate ONE embedding for the original query
      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("transfer station hours");
    });

    it("passes the same pre-computed embedding to both Pinecone queries", async () => {
      await retrieveRelevantChunks("building permit", { townId: "needham" });

      // Both chunks and content namespace queries should receive the same embedding
      const chunksCall = mockQueryPinecone.mock.calls.find(
        (call: unknown[]) => call[0] === "chunks"
      );
      const contentCall = mockQueryPinecone.mock.calls.find(
        (call: unknown[]) => call[0] === "content"
      );

      expect(chunksCall).toBeDefined();
      expect(contentCall).toBeDefined();
      expect(chunksCall![1]).toEqual(fakeEmbedding);
      expect(contentCall![1]).toEqual(fakeEmbedding);
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

      const chunksCall = mockQueryPinecone.mock.calls.find(
        (call: unknown[]) => call[0] === "chunks"
      );
      expect(chunksCall).toBeDefined();
      // topK is the 3rd argument (index 2)
      expect(chunksCall![2]).toBe(20);
    });

    it("requests ceil(matchCount/2) = 10 content items by default", async () => {
      await retrieveRelevantChunks("zoning regulations", { townId: "needham" });

      const contentCall = mockQueryPinecone.mock.calls.find(
        (call: unknown[]) => call[0] === "content"
      );
      expect(contentCall).toBeDefined();
      expect(contentCall![2]).toBe(10);
    });

    it("allows overriding match count via options", async () => {
      await retrieveRelevantChunks("test query", {
        townId: "needham",
        matchCount: 50,
      });

      const chunksCall = mockQueryPinecone.mock.calls.find(
        (call: unknown[]) => call[0] === "chunks"
      );
      expect(chunksCall![2]).toBe(50);
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

    it("handles Pinecone content_items failure gracefully", async () => {
      mockQueryPinecone.mockImplementation((namespace: string) => {
        if (namespace === "chunks") {
          return [{ id: "chunk-1", score: 0.8 }];
        }
        if (namespace === "content") {
          throw new Error("connection timeout");
        }
        return [];
      });

      // Supabase metadata fetch for the one chunk
      mockIn.mockResolvedValue({
        data: [{
          id: "chunk-1",
          chunk_text: "Some content.",
          metadata: { document_title: "Test" },
        }],
        error: null,
      });

      // Should not throw — content_items failure is non-fatal
      const result = await retrieveRelevantChunks("test query", { townId: "needham" });
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
