import { Index } from "@upstash/vector";

// Namespaces for separating vector types (same as Pinecone)
export const PINECONE_NS_CHUNKS = "chunks";
export const PINECONE_NS_CONTENT = "content";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let indexInstance: Index | null = null;

function getIndex(): Index {
  if (!indexInstance) {
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Missing environment variables: UPSTASH_VECTOR_REST_URL and/or UPSTASH_VECTOR_REST_TOKEN",
      );
    }
    indexInstance = new Index({ url, token });
  }
  return indexInstance;
}

// ---------------------------------------------------------------------------
// Types (backward-compatible with Pinecone types)
// ---------------------------------------------------------------------------

export interface PineconeQueryResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Filter builder — converts Pinecone filter syntax to Upstash SQL-like syntax
// ---------------------------------------------------------------------------

function buildClause(key: string, value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const op = value as Record<string, unknown>;

    if ("$eq" in op) {
      const v = op.$eq;
      return typeof v === "string" ? `${key} = '${v}'` : `${key} = ${v}`;
    }
    if ("$in" in op && Array.isArray(op.$in)) {
      const items = (op.$in as unknown[])
        .map((v) => (typeof v === "string" ? `'${v}'` : String(v)))
        .join(", ");
      return `${key} IN (${items})`;
    }
    if ("$ne" in op) {
      const v = op.$ne;
      return typeof v === "string" ? `${key} != '${v}'` : `${key} != ${v}`;
    }
    return null;
  }

  if (typeof value === "string") {
    return `${key} = '${value}'`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${key} = ${value}`;
  }
  return null;
}

function buildFilter(filter?: Record<string, unknown>): string | undefined {
  if (!filter || Object.keys(filter).length === 0) return undefined;

  const clauses = Object.entries(filter)
    .map(([key, value]) => buildClause(key, value))
    .filter((clause): clause is string => clause !== null);

  return clauses.length > 0 ? clauses.join(" AND ") : undefined;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Query Upstash Vector for similar vectors within a namespace.
 * Returns IDs and similarity scores.
 */
export async function queryPinecone(
  namespace: string,
  embedding: number[],
  topK: number,
  filter?: Record<string, unknown>,
): Promise<PineconeQueryResult[]> {
  const index = getIndex();
  const filterStr = buildFilter(filter);

  const results = await index.query(
    {
      vector: embedding,
      topK,
      filter: filterStr,
      includeMetadata: true,
    },
    { namespace },
  );

  return results.map((match) => ({
    id: String(match.id),
    score: match.score,
    metadata: (match.metadata ?? undefined) as Record<string, unknown> | undefined,
  }));
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Upsert vectors to an Upstash Vector namespace in batches.
 */
export async function upsertToPinecone(
  namespace: string,
  vectors: PineconeVector[],
  batchSize = 100,
): Promise<void> {
  if (vectors.length === 0) return;

  const index = getIndex();
  const ns = index.namespace(namespace);

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await ns.upsert(
      batch.map((v) => ({
        id: v.id,
        vector: v.values,
        metadata: v.metadata ?? {},
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete vectors by ID from an Upstash Vector namespace.
 */
export async function deleteFromPinecone(
  namespace: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  const index = getIndex();
  await index.delete(ids, { namespace });
}
