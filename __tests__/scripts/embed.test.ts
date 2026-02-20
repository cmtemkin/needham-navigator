import { embedAndStoreChunks } from "../../scripts/embed";
import type { Chunk } from "../../scripts/chunk";

// Mock Pinecone
const mockUpsertToPinecone = jest.fn().mockResolvedValue(undefined);
const mockDeleteFromPinecone = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/pinecone", () => ({
  upsertToPinecone: (...args: unknown[]) => mockUpsertToPinecone(...args),
  deleteFromPinecone: (...args: unknown[]) => mockDeleteFromPinecone(...args),
  PINECONE_NS_CHUNKS: "chunks",
}));

// Mock Supabase dependencies
const mockSelectId = jest.fn();
const mockDeleteEq = jest.fn();
const mockDelete = jest.fn().mockReturnValue({ eq: (...args: unknown[]) => mockDeleteEq(...args) });
const mockInsertSelect = jest.fn();
const mockInsert = jest.fn().mockReturnValue({ select: (...args: unknown[]) => mockInsertSelect(...args) });
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn().mockReturnValue({ eq: (...args: unknown[]) => mockUpdateEq(...args) });
const mockFrom = jest.fn().mockImplementation((table: string) => {
  if (table === "document_chunks") {
    return {
      delete: mockDelete,
      insert: mockInsert,
      select: (...args: unknown[]) => mockSelectId(...args),
    };
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
    // Default: no existing chunks to delete from Pinecone
    mockSelectId.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockDeleteEq.mockResolvedValue({ error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
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
    // Insert returns IDs
    mockInsertSelect.mockResolvedValueOnce({
      data: chunks.map((_, i) => ({ id: `id-${i}` })),
      error: null,
    });

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
    mockInsertSelect.mockResolvedValueOnce({
      data: chunks.map((_, i) => ({ id: `id-${i}` })),
      error: null,
    });

    const result = await embedAndStoreChunks(chunks, "test-doc-id");

    expect(result).toEqual({
      documentId: "test-doc-id",
      chunksEmbedded: 2,
      errors: 0,
      durationMs: expect.any(Number),
    });
  });

  it("upserts vectors to Pinecone after inserting to Supabase", async () => {
    const chunks = createTestChunks(2);
    const fakeEmbeddings = chunks.map(() => new Array(1536).fill(0.1));
    mockGenerateEmbeddings.mockResolvedValueOnce(fakeEmbeddings);
    mockInsertSelect.mockResolvedValueOnce({
      data: [{ id: "uuid-1" }, { id: "uuid-2" }],
      error: null,
    });

    await embedAndStoreChunks(chunks, "test-doc-id");

    expect(mockUpsertToPinecone).toHaveBeenCalledWith(
      "chunks",
      expect.arrayContaining([
        expect.objectContaining({
          id: "uuid-1",
          values: expect.any(Array),
          metadata: { town_id: "needham", document_id: "test-doc-id" },
        }),
      ])
    );
  });

  it("stores null embedding in Supabase", async () => {
    const chunks = createTestChunks(1);
    mockGenerateEmbeddings.mockResolvedValueOnce([new Array(1536).fill(0.1)]);
    mockInsertSelect.mockResolvedValueOnce({
      data: [{ id: "uuid-1" }],
      error: null,
    });

    await embedAndStoreChunks(chunks, "test-doc-id");

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ embedding: null }),
      ])
    );
  });

  it("deletes existing chunks before inserting", async () => {
    const chunks = createTestChunks(1);
    mockGenerateEmbeddings.mockResolvedValueOnce([new Array(1536).fill(0.1)]);
    mockInsertSelect.mockResolvedValueOnce({
      data: [{ id: "uuid-1" }],
      error: null,
    });

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
    mockInsertSelect.mockResolvedValueOnce({
      data: [{ id: "uuid-1" }],
      error: null,
    });

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
