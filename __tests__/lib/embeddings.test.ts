import {
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingCacheStats,
  clearEmbeddingCache,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "@/lib/embeddings";

// Mock openai
const mockCreate = jest.fn();
jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate,
    },
  }));
});

describe("embeddings", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    clearEmbeddingCache();
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("exports correct model name", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-large");
  });

  it("exports correct dimensions", () => {
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });

  describe("generateEmbedding", () => {
    it("generates a single embedding", async () => {
      const fakeEmbedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValueOnce({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

      const result = await generateEmbedding("test text");
      expect(result).toEqual(fakeEmbedding);
      expect(result).toHaveLength(1536);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "text-embedding-3-large",
        input: "test text",
        dimensions: 1536,
      });
    });

    it("trims whitespace from input text", async () => {
      const fakeEmbedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValueOnce({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

      await generateEmbedding("  test text  ");
      expect(mockCreate).toHaveBeenCalledWith({
        model: "text-embedding-3-large",
        input: "test text",
        dimensions: 1536,
      });
    });
  });

  describe("generateEmbeddings", () => {
    it("generates embeddings for multiple texts", async () => {
      const embedding1 = new Array(1536).fill(0.1);
      const embedding2 = new Array(1536).fill(0.2);

      mockCreate.mockResolvedValueOnce({
        data: [
          { index: 0, embedding: embedding1 },
          { index: 1, embedding: embedding2 },
        ],
      });

      const result = await generateEmbeddings(["text 1", "text 2"]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(embedding1);
      expect(result[1]).toEqual(embedding2);
    });

    it("handles out-of-order response indices", async () => {
      const embedding1 = new Array(1536).fill(0.1);
      const embedding2 = new Array(1536).fill(0.2);

      mockCreate.mockResolvedValueOnce({
        data: [
          { index: 1, embedding: embedding2 },
          { index: 0, embedding: embedding1 },
        ],
      });

      const result = await generateEmbeddings(["text 1", "text 2"]);
      expect(result[0]).toEqual(embedding1);
      expect(result[1]).toEqual(embedding2);
    });

    it("batches large inputs (>100 texts)", async () => {
      const texts = new Array(150).fill("test");
      const fakeEmbedding = new Array(1536).fill(0.1);

      // First batch: 100 items
      mockCreate.mockResolvedValueOnce({
        data: new Array(100).fill(null).map((_, i) => ({
          index: i,
          embedding: fakeEmbedding,
        })),
      });
      // Second batch: 50 items
      mockCreate.mockResolvedValueOnce({
        data: new Array(50).fill(null).map((_, i) => ({
          index: i,
          embedding: fakeEmbedding,
        })),
      });

      const result = await generateEmbeddings(texts);
      expect(result).toHaveLength(150);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("handles empty input array", async () => {
      const result = await generateEmbeddings([]);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("embedding cache", () => {
    it("returns cached embedding on second call with same text", async () => {
      const fakeEmbedding = new Array(1536).fill(0.42);
      mockCreate.mockResolvedValueOnce({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

      // First call — cache miss
      const result1 = await generateEmbedding("transfer station hours");
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second call — cache hit, should NOT call OpenAI again
      const result2 = await generateEmbedding("transfer station hours");
      expect(mockCreate).toHaveBeenCalledTimes(1); // Still 1 — no new API call
      expect(result2).toEqual(result1);
    });

    it("treats trimmed variants as same cache key", async () => {
      const fakeEmbedding = new Array(1536).fill(0.42);
      mockCreate.mockResolvedValueOnce({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

      await generateEmbedding("  building permit  ");
      await generateEmbedding("building permit");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("generates different embeddings for different texts", async () => {
      const embedding1 = new Array(1536).fill(0.1);
      const embedding2 = new Array(1536).fill(0.2);
      mockCreate
        .mockResolvedValueOnce({ data: [{ index: 0, embedding: embedding1 }] })
        .mockResolvedValueOnce({ data: [{ index: 0, embedding: embedding2 }] });

      const result1 = await generateEmbedding("query one");
      const result2 = await generateEmbedding("query two");
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result1).toEqual(embedding1);
      expect(result2).toEqual(embedding2);
    });

    it("reports cache stats correctly", async () => {
      const fakeEmbedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValue({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

      expect(getEmbeddingCacheStats().size).toBe(0);

      await generateEmbedding("query 1");
      expect(getEmbeddingCacheStats().size).toBe(1);

      await generateEmbedding("query 2");
      expect(getEmbeddingCacheStats().size).toBe(2);

      // Repeat — should not increase size
      await generateEmbedding("query 1");
      expect(getEmbeddingCacheStats().size).toBe(2);
    });

    it("clears cache when clearEmbeddingCache is called", async () => {
      const fakeEmbedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValue({
        data: [{ index: 0, embedding: fakeEmbedding }],
      });

      await generateEmbedding("query");
      expect(getEmbeddingCacheStats().size).toBe(1);

      clearEmbeddingCache();
      expect(getEmbeddingCacheStats().size).toBe(0);

      // After clearing, should call API again
      await generateEmbedding("query");
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("evicts oldest entry when cache is full", async () => {
      const stats = getEmbeddingCacheStats();
      const maxSize = stats.maxSize;

      // Fill the cache to max
      for (let i = 0; i < maxSize; i++) {
        const embedding = new Array(1536).fill(i / maxSize);
        mockCreate.mockResolvedValueOnce({
          data: [{ index: 0, embedding }],
        });
        await generateEmbedding(`query-${i}`);
      }
      expect(getEmbeddingCacheStats().size).toBe(maxSize);

      // Add one more — should evict the oldest (query-0)
      const newEmbedding = new Array(1536).fill(0.99);
      mockCreate.mockResolvedValueOnce({
        data: [{ index: 0, embedding: newEmbedding }],
      });
      await generateEmbedding("query-new");
      expect(getEmbeddingCacheStats().size).toBe(maxSize); // Size unchanged

      // query-0 was evicted — should need a new API call
      const evictedEmbedding = new Array(1536).fill(0.0);
      mockCreate.mockResolvedValueOnce({
        data: [{ index: 0, embedding: evictedEmbedding }],
      });
      await generateEmbedding("query-0");
      // +2 because: filling cache was maxSize calls, then query-new, then query-0
      expect(mockCreate).toHaveBeenCalledTimes(maxSize + 2);
    });

    it("does not use expired cache entries", async () => {
      const embedding = new Array(1536).fill(0.1);
      mockCreate.mockResolvedValue({
        data: [{ index: 0, embedding }],
      });

      // Generate and cache
      await generateEmbedding("expiring query");
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Manually expire the entry by backdating the timestamp
      const cacheEntries = Array.from(
        // Access internal map via the stats size check (we can't access the map directly,
        // but we can test expiry behavior by mocking Date.now)
        { length: 1 }
      );

      // Fast-forward time past TTL using jest fake timers
      const realDateNow = Date.now;
      Date.now = () => realDateNow() + 31 * 60 * 1000; // 31 minutes later

      await generateEmbedding("expiring query");
      expect(mockCreate).toHaveBeenCalledTimes(2); // Had to call API again

      Date.now = realDateNow; // Restore
    });
  });
});
