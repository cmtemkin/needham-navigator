import { embedAndStoreChunks } from "../../scripts/embed";
import type { Chunk } from "../../scripts/chunk";

// Mock dependencies
const mockDelete = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
const mockFrom = jest.fn().mockImplementation((table: string) => {
  if (table === "document_chunks") {
    return { delete: mockDelete, insert: mockInsert };
  }
  if (table === "documents") {
    return { update: mockUpdate };
  }
  return {};
});

jest.mock("@/lib/supabase", () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}));

const mockGenerateEmbeddings = jest.fn();
jest.mock("@/lib/embeddings", () => ({
  generateEmbeddings: (...args: unknown[]) => mockGenerateEmbeddings(...args),
}));

describe("embed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockFrom's implementation to handle chained calls properly
    mockDelete.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  });

  const createTestChunks = (count: number): Chunk[] =>
    Array.from({ length: count }, (_, i) => ({
      text: `Chunk ${i} text content`,
      metadata: {
        chunk_id: `TEST-${i}`,
        document_title: "Test Doc",
        document_type: "general",
        document_url: "https://example.com/doc",
        chunk_type: "informational" as const,
        contains_table: false,
        cross_references: [],
        keywords: [],
        applies_to: [],
      },
    }));

  it("generates embeddings for all chunks", async () => {
    const chunks = createTestChunks(3);
    const fakeEmbeddings = chunks.map(() => new Array(1536).fill(0.1));
    mockGenerateEmbeddings.mockResolvedValueOnce(fakeEmbeddings);

    await embedAndStoreChunks(chunks, "test-doc-id");

    // Expect chunks with contextual headers prepended (Phase 2 enhancement)
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(
      chunks.map((c) => `[Test Doc | /doc]\n${c.text}`)
    );
  });

  it("returns correct result structure", async () => {
    const chunks = createTestChunks(2);
    mockGenerateEmbeddings.mockResolvedValueOnce(
      chunks.map(() => new Array(1536).fill(0.1))
    );

    const result = await embedAndStoreChunks(chunks, "test-doc-id");

    expect(result).toEqual({
      documentId: "test-doc-id",
      chunksEmbedded: 2,
      errors: 0,
      durationMs: expect.any(Number),
    });
  });

  it("deletes existing chunks before inserting", async () => {
    const chunks = createTestChunks(1);
    mockGenerateEmbeddings.mockResolvedValueOnce([new Array(1536).fill(0.1)]);

    await embedAndStoreChunks(chunks, "test-doc-id");

    expect(mockFrom).toHaveBeenCalledWith("document_chunks");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("handles embedding errors gracefully", async () => {
    const chunks = createTestChunks(2);
    mockGenerateEmbeddings.mockRejectedValueOnce(new Error("API error"));

    const result = await embedAndStoreChunks(chunks, "test-doc-id");

    expect(result.errors).toBe(2);
    expect(result.chunksEmbedded).toBe(0);
  });

  it("handles empty chunk array", async () => {
    const result = await embedAndStoreChunks([], "test-doc-id");

    expect(result.chunksEmbedded).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("uses provided townId", async () => {
    const chunks = createTestChunks(1);
    mockGenerateEmbeddings.mockResolvedValueOnce([new Array(1536).fill(0.1)]);

    await embedAndStoreChunks(chunks, "test-doc-id", {
      townId: "custom-town",
    });

    // Verify the townId is passed in the insert call
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ town_id: "custom-town" }),
      ])
    );
  });
});
