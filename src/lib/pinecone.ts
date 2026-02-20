import { Pinecone } from "@pinecone-database/pinecone";
import type { RecordMetadata } from "@pinecone-database/pinecone";

export const PINECONE_INDEX_NAME = "needham-navigator";

// Namespaces for separating vector types
export const PINECONE_NS_CHUNKS = "chunks";
export const PINECONE_NS_CONTENT = "content";

let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing environment variable: PINECONE_API_KEY");
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

export function getPineconeIndex() {
  return getPinecone().index(PINECONE_INDEX_NAME);
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface PineconeQueryResult {
  id: string;
  score: number;
  metadata?: RecordMetadata;
}

/**
 * Query Pinecone for similar vectors within a namespace.
 * Returns IDs and similarity scores.
 */
export async function queryPinecone(
  namespace: string,
  embedding: number[],
  topK: number,
  filter?: Record<string, unknown>,
): Promise<PineconeQueryResult[]> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);

  const results = await ns.query({
    vector: embedding,
    topK,
    filter,
    includeMetadata: true,
  });

  return (results.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    metadata: match.metadata,
  }));
}

// ---------------------------------------------------------------------------
// Upsert helpers
// ---------------------------------------------------------------------------

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: RecordMetadata;
}

/**
 * Upsert vectors to a Pinecone namespace in batches.
 * Pinecone recommends batches of 100 for serverless.
 */
export async function upsertToPinecone(
  namespace: string,
  vectors: PineconeVector[],
  batchSize = 100,
): Promise<void> {
  if (vectors.length === 0) return;

  const index = getPineconeIndex();
  const ns = index.namespace(namespace);

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await ns.upsert({ records: batch });
  }
}

/**
 * Delete vectors by ID from a Pinecone namespace.
 */
export async function deleteFromPinecone(
  namespace: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const index = getPineconeIndex();
  const ns = index.namespace(namespace);
  await ns.deleteMany({ ids });
}
