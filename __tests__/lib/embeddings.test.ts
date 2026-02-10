import { generateEmbedding, generateEmbeddings, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/lib/embeddings";

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
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("exports correct model name", () => {
    expect(EMBEDDING_MODEL).toBe("text-embedding-3-small");
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
        model: "text-embedding-3-small",
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
});
