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
// Contextual Chunk Headers
// ---------------------------------------------------------------------------

/**
 * Build a contextual header to prepend to chunk text before embedding.
 * This is the standard RAG technique called "contextual chunk headers."
 * The header helps the embedding model understand WHAT document the chunk
 * belongs to, improving retrieval for queries that reference the topic
 * but where the chunk text itself doesn't contain those keywords.
 *
 * Example: A chunk from the Library page that says "Hours: Mon-Fri 9am-5pm"
 * will now embed as "[Needham Free Public Library | Library | /library]\nHours: Mon-Fri 9am-5pm"
 * so searching "library hours" will match much better.
 */
function buildChunkHeader(metadata: Record<string, unknown>): string {
  const parts: string[] = [];

  const title = metadata.document_title;
  if (typeof title === "string" && title.trim()) {
    parts.push(title.trim());
  }

  const department = metadata.department;
  if (typeof department === "string" && department.trim()) {
    parts.push(department.trim());
  }

  const sectionTitle = metadata.section_title;
  if (typeof sectionTitle === "string" && sectionTitle.trim()
      && sectionTitle.toLowerCase() !== "introduction") {
    parts.push(sectionTitle.trim());
  }

  const url = metadata.document_url;
  if (typeof url === "string" && url.trim()) {
    // Just the path, not the full URL
    try {
      const path = new URL(url).pathname;
      if (path && path !== "/") {
        parts.push(path);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  if (parts.length === 0) return "";
  return `[${parts.join(" | ")}]`;
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

    // Prepend contextual chunk headers for embedding (improves retrieval)
    // Store original text in DB, embed with header for better semantic matching
    const textsForEmbedding = batch.map((c) => {
      const header = buildChunkHeader(c.metadata as unknown as Record<string, unknown>);
      return header ? `${header}\n${c.text}` : c.text;
    });

    try {
      console.log(
        `[embed] Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`
      );

      const embeddings = await generateEmbeddings(textsForEmbedding);

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
