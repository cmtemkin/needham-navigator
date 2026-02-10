/**
 * scripts/embed.ts — Embedding generation + Supabase pgvector upsert
 *
 * Takes chunked documents and:
 * 1. Generates embeddings via OpenAI text-embedding-3-small
 * 2. Upserts chunks + embeddings into Supabase document_chunks table
 * 3. Updates the parent document record with chunk count and timestamps
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { generateEmbeddings } from "../src/lib/embeddings";
import { Chunk } from "./chunk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedResult {
  documentId: string;
  chunksEmbedded: number;
  errors: number;
  durationMs: number;
}

export interface EmbedOptions {
  townId?: string;
  batchSize?: number;
}

// ---------------------------------------------------------------------------
// Main embedding + upsert function
// ---------------------------------------------------------------------------

export async function embedAndStoreChunks(
  chunks: Chunk[],
  documentId: string,
  options: EmbedOptions = {}
): Promise<EmbedResult> {
  const { townId = "needham", batchSize = 50 } = options;
  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();
  let errors = 0;

  // Delete existing chunks for this document (replace strategy)
  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    console.error(
      `[embed] Error deleting old chunks for ${documentId}: ${deleteError.message}`
    );
  }

  // Process in batches
  let totalEmbedded = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);

    try {
      console.log(
        `[embed] Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`
      );

      const embeddings = await generateEmbeddings(texts);

      // Prepare rows for upsert
      const rows = batch.map((chunk, idx) => ({
        document_id: documentId,
        town_id: townId,
        chunk_index: i + idx,
        chunk_text: chunk.text,
        embedding: JSON.stringify(embeddings[idx]),
        metadata: chunk.metadata,
      }));

      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(rows);

      if (insertError) {
        console.error(
          `[embed] Error inserting batch: ${insertError.message}`
        );
        errors += batch.length;
      } else {
        totalEmbedded += batch.length;
      }
    } catch (err) {
      console.error(`[embed] Batch embedding failed:`, err);
      errors += batch.length;
    }
  }

  // Update document record with chunk count and timestamps
  const { error: updateError } = await supabase
    .from("documents")
    .update({
      chunk_count: totalEmbedded,
      last_ingested_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      is_stale: false,
    })
    .eq("id", documentId);

  if (updateError) {
    console.error(
      `[embed] Error updating document ${documentId}: ${updateError.message}`
    );
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[embed] Embedded ${totalEmbedded}/${chunks.length} chunks for document ${documentId} in ${durationMs}ms`
  );

  return {
    documentId,
    chunksEmbedded: totalEmbedded,
    errors,
    durationMs,
  };
}

/**
 * Embed chunks for multiple documents in sequence.
 */
export async function embedDocuments(
  documentChunks: Array<{ documentId: string; chunks: Chunk[] }>,
  options: EmbedOptions = {}
): Promise<EmbedResult[]> {
  const results: EmbedResult[] = [];

  for (const { documentId, chunks } of documentChunks) {
    const result = await embedAndStoreChunks(chunks, documentId, options);
    results.push(result);
  }

  const totalChunks = results.reduce((s, r) => s + r.chunksEmbedded, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);
  console.log(
    `[embed] Total: ${totalChunks} chunks embedded across ${results.length} documents (${totalErrors} errors)`
  );

  return results;
}
