import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing environment variable: OPENAI_API_KEY");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100; // OpenAI allows up to 2048, but 100 is safer for rate limits

// ---------------------------------------------------------------------------
// In-memory LRU embedding cache — avoids redundant OpenAI API calls for
// repeated queries. Resets on Vercel cold starts; acceptable trade-off since
// the cache is a speed optimization, not a correctness requirement.
// ---------------------------------------------------------------------------

const EMBEDDING_CACHE_MAX_SIZE = 500;
const EMBEDDING_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type EmbeddingCacheEntry = { embedding: number[]; timestamp: number };

const embeddingCache = new Map<string, EmbeddingCacheEntry>();

/** Expose cache stats for testing and monitoring. */
export function getEmbeddingCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: embeddingCache.size, maxSize: EMBEDDING_CACHE_MAX_SIZE, ttlMs: EMBEDDING_CACHE_TTL_MS };
}

/** Clear the embedding cache (used in tests). */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Generate an embedding for a single text string.
 * Results are cached in-memory with LRU eviction to avoid redundant API calls.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const key = text.trim();

  // Check cache
  const cached = embeddingCache.get(key);
  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL_MS) {
    // Move to end of Map iteration order (LRU refresh)
    embeddingCache.delete(key);
    embeddingCache.set(key, cached);
    return cached.embedding;
  }

  // Cache miss or expired — call OpenAI
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: key,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const embedding = response.data[0].embedding;

  // Store in cache, evict oldest if full
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX_SIZE) {
    // Map iterates in insertion order — first key is the oldest (LRU)
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey !== undefined) {
      embeddingCache.delete(oldestKey);
    }
  }
  embeddingCache.set(key, { embedding, timestamp: Date.now() });

  return embedding;
}

/**
 * Generate embeddings for multiple texts in batches.
 * Returns embeddings in the same order as the input texts.
 * Note: Batch embeddings bypass the cache (used for ingestion, not queries).
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAI();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // Sort by index to guarantee order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
