/**
 * scripts/re-embed.ts — Re-embed existing chunks with contextual chunk headers
 *
 * Usage:
 *   npx tsx scripts/re-embed.ts                    # Re-embed all chunks
 *   npx tsx scripts/re-embed.ts --town=needham     # Re-embed specific town
 *   npx tsx scripts/re-embed.ts --dry-run          # Show what would be re-embedded
 *
 * This script reads all chunks from the document_chunks table,
 * prepends contextual chunk headers to each chunk's text,
 * generates new embeddings, and updates the embedding column.
 * The chunk_text column is NOT modified — only the embedding changes.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { generateEmbeddings } from "../src/lib/embeddings";
import { upsertToPinecone, PINECONE_NS_CHUNKS } from "../src/lib/pinecone";
import type { PineconeVector } from "../src/lib/pinecone";
import { classifyDocument } from "../src/lib/relevance-classifier";

// ---------------------------------------------------------------------------
// Contextual Chunk Header Builder (same as in embed.ts)
// ---------------------------------------------------------------------------

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
// Main re-embed logic
// ---------------------------------------------------------------------------

interface ReEmbedOptions {
  townId?: string;
  dryRun?: boolean;
  batchSize?: number;
}

async function reEmbed(options: ReEmbedOptions = {}): Promise<void> {
  const { townId = "needham", dryRun = false, batchSize = 50 } = options;
  const supabase = getSupabaseServiceClient();

  console.log(`[re-embed] Starting re-embedding for town: ${townId}`);
  if (dryRun) {
    console.log("[re-embed] DRY RUN MODE - no database changes will be made");
  }

  // Fetch all chunks for the town
  const { data: chunks, error: fetchError } = await supabase
    .from("document_chunks")
    .select("id, document_id, chunk_text, metadata")
    .eq("town_id", townId)
    .order("id");

  if (fetchError) {
    console.error(`[re-embed] Error fetching chunks: ${fetchError.message}`);
    process.exit(1);
  }

  if (!chunks || chunks.length === 0) {
    console.log(`[re-embed] No chunks found for town: ${townId}`);
    return;
  }

  console.log(`[re-embed] Found ${chunks.length} chunks to re-embed`);

  // Process in batches
  const totalBatches = Math.ceil(chunks.length / batchSize);
  let reEmbedded = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`[re-embed] Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);

    if (dryRun) {
      // Show what headers would be generated
      console.log(`[re-embed] DRY RUN - sample headers for this batch:`);
      batch.slice(0, 3).forEach((chunk) => {
        const header = buildChunkHeader((chunk.metadata || {}) as Record<string, unknown>);
        const preview = chunk.chunk_text.substring(0, 60).replace(/\n/g, " ");
        console.log(`  ${header || "(no header)"}`);
        console.log(`    "${preview}..."`);
      });
      reEmbedded += batch.length;
      continue;
    }

    // Build contextualized texts
    const textsForEmbedding = batch.map((chunk) => {
      const header = buildChunkHeader((chunk.metadata || {}) as Record<string, unknown>);
      return header ? `${header}\n${chunk.chunk_text}` : chunk.chunk_text;
    });

    try {
      // Generate new embeddings
      const embeddings = await generateEmbeddings(textsForEmbedding);

      // Upsert vectors to Pinecone (include relevance_tier from document URL)
      const pineconeVectors: PineconeVector[] = batch.map((chunk, j) => {
        const meta = (chunk.metadata ?? {}) as Record<string, unknown>;
        const url = typeof meta.document_url === "string" ? meta.document_url : "";
        const title = typeof meta.document_title === "string" ? meta.document_title : undefined;
        const tier = url ? classifyDocument(url, title) : "primary";
        return {
          id: chunk.id,
          values: embeddings[j],
          metadata: { town_id: townId, document_id: chunk.document_id ?? "", relevance_tier: tier },
        };
      });

      await upsertToPinecone(PINECONE_NS_CHUNKS, pineconeVectors);
      reEmbedded += batch.length;

      console.log(`[re-embed] ✓ Batch ${batchNum}/${totalBatches} complete (${reEmbedded}/${chunks.length} total)`);
    } catch (err) {
      console.error(`[re-embed] Batch ${batchNum} failed:`, err);
    }
  }

  console.log(`\n[re-embed] Complete! Re-embedded ${reEmbedded}/${chunks.length} chunks`);
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const townId = args.find((a) => a.startsWith("--town="))?.split("=")[1] || "needham";
  const dryRun = args.includes("--dry-run");

  (async () => {
    try {
      await reEmbed({ townId, dryRun });
    } catch (err) {
      console.error("[re-embed] Failed:", err);
      process.exit(1);
    }
  })();
}
