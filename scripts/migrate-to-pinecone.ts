/**
 * scripts/migrate-to-pinecone.ts — Bulk export vectors from Supabase to Pinecone
 *
 * Reads all document_chunks and content_items with embeddings from Supabase
 * and upserts them to Pinecone serverless index.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-pinecone.ts                  # Full migration
 *   npx tsx scripts/migrate-to-pinecone.ts --dry-run        # Count only, no writes
 *   npx tsx scripts/migrate-to-pinecone.ts --chunks-only    # Only document_chunks
 *   npx tsx scripts/migrate-to-pinecone.ts --content-only   # Only content_items
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import {
  upsertToPinecone,
  PINECONE_NS_CHUNKS,
  PINECONE_NS_CONTENT,
} from "../src/lib/pinecone";
import type { PineconeVector } from "../src/lib/pinecone";

const BATCH_SIZE = 100;
const DELAY_MS = 200; // Between Pinecone upserts

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function migrateDocumentChunks(dryRun: boolean): Promise<number> {
  const supabase = getSupabaseServiceClient();
  console.log("\n[migrate] Starting document_chunks migration...");

  // Count total chunks with embeddings
  const { count, error: countError } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .not("embedding", "is", null);

  if (countError) {
    console.error(`[migrate] Count error: ${countError.message}`);
    return 0;
  }

  const total = count ?? 0;
  console.log(`[migrate] Found ${total} document_chunks with embeddings`);

  if (dryRun || total === 0) return total;

  let migrated = 0;
  let offset = 0;

  while (offset < total) {
    // Read batch from Supabase
    const { data, error } = await supabase
      .from("document_chunks")
      .select("id, document_id, town_id, embedding")
      .not("embedding", "is", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`[migrate] Fetch error at offset ${offset}: ${error.message}`);
      offset += BATCH_SIZE;
      continue;
    }

    if (!data || data.length === 0) break;

    // Parse embeddings and build Pinecone vectors
    const vectors: PineconeVector[] = [];
    for (const row of data) {
      try {
        // Embeddings are stored as JSON strings in Supabase
        let embedding: number[];
        if (typeof row.embedding === "string") {
          embedding = JSON.parse(row.embedding);
        } else if (Array.isArray(row.embedding)) {
          embedding = row.embedding;
        } else {
          console.warn(`[migrate] Unexpected embedding type for chunk ${row.id}: ${typeof row.embedding}`);
          continue;
        }

        vectors.push({
          id: row.id,
          values: embedding,
          metadata: {
            town_id: row.town_id ?? "needham",
            document_id: row.document_id ?? "",
          },
        });
      } catch (parseErr) {
        console.warn(`[migrate] Failed to parse embedding for chunk ${row.id}: ${parseErr}`);
      }
    }

    // Upsert to Pinecone
    if (vectors.length > 0) {
      try {
        await upsertToPinecone(PINECONE_NS_CHUNKS, vectors);
        migrated += vectors.length;
      } catch (pineconeErr) {
        console.error(`[migrate] Pinecone upsert failed at offset ${offset}: ${pineconeErr}`);
      }
    }

    offset += data.length;
    const pct = Math.round((offset / total) * 100);
    console.log(`[migrate] document_chunks: ${migrated}/${total} migrated (${pct}%)`);

    await sleep(DELAY_MS);
  }

  return migrated;
}

async function migrateContentItems(dryRun: boolean): Promise<number> {
  const supabase = getSupabaseServiceClient();
  console.log("\n[migrate] Starting content_items migration...");

  // Count content items with embeddings
  const { count, error: countError } = await supabase
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .not("embedding", "is", null);

  if (countError) {
    console.error(`[migrate] Count error: ${countError.message}`);
    return 0;
  }

  const total = count ?? 0;
  console.log(`[migrate] Found ${total} content_items with embeddings`);

  if (dryRun || total === 0) return total;

  let migrated = 0;
  let offset = 0;

  while (offset < total) {
    const { data, error } = await supabase
      .from("content_items")
      .select("id, town_id, source_id, embedding")
      .not("embedding", "is", null)
      .order("id")
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`[migrate] Fetch error at offset ${offset}: ${error.message}`);
      offset += BATCH_SIZE;
      continue;
    }

    if (!data || data.length === 0) break;

    const vectors: PineconeVector[] = [];
    for (const row of data) {
      try {
        let embedding: number[];
        if (typeof row.embedding === "string") {
          embedding = JSON.parse(row.embedding);
        } else if (Array.isArray(row.embedding)) {
          embedding = row.embedding;
        } else {
          continue;
        }

        vectors.push({
          id: row.id,
          values: embedding,
          metadata: {
            town_id: row.town_id ?? "needham",
            source_id: row.source_id ?? "",
          },
        });
      } catch {
        console.warn(`[migrate] Failed to parse embedding for content_item ${row.id}`);
      }
    }

    if (vectors.length > 0) {
      try {
        await upsertToPinecone(PINECONE_NS_CONTENT, vectors);
        migrated += vectors.length;
      } catch (pineconeErr) {
        console.error(`[migrate] Pinecone upsert failed at offset ${offset}: ${pineconeErr}`);
      }
    }

    offset += data.length;
    const pct = Math.round((offset / total) * 100);
    console.log(`[migrate] content_items: ${migrated}/${total} migrated (${pct}%)`);

    await sleep(DELAY_MS);
  }

  return migrated;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const chunksOnly = args.includes("--chunks-only");
  const contentOnly = args.includes("--content-only");

  console.log("=".repeat(60));
  console.log("MIGRATE VECTORS: Supabase → Pinecone");
  if (dryRun) console.log("DRY RUN MODE — no writes to Pinecone");
  console.log("=".repeat(60));

  const startTime = Date.now();
  let chunksMigrated = 0;
  let contentMigrated = 0;

  if (!contentOnly) {
    chunksMigrated = await migrateDocumentChunks(dryRun);
  }

  if (!chunksOnly) {
    contentMigrated = await migrateContentItems(dryRun);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log("\n" + "=".repeat(60));
  console.log(`MIGRATION COMPLETE in ${duration}s`);
  console.log(`  document_chunks: ${chunksMigrated}`);
  console.log(`  content_items: ${contentMigrated}`);
  console.log(`  total vectors: ${chunksMigrated + contentMigrated}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
