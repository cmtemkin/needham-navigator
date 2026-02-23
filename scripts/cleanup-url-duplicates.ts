/**
 * scripts/cleanup-url-duplicates.ts — Deduplicate documents by canonical URL
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-url-duplicates.ts --dry-run    # Preview changes
 *   npx tsx --env-file=.env.local scripts/cleanup-url-duplicates.ts --execute     # Actually delete dupes
 *
 * Steps:
 * 1. Backfills canonical_url for all documents
 * 2. Finds duplicate groups (same town_id + canonical_url) using service client
 * 3. Keeps the document with the most chunks (tiebreak: most recent last_ingested_at)
 * 4. Deletes loser documents' chunks from Supabase and Pinecone
 * 5. Deletes the loser document rows
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { canonicalizeUrl } from "../src/lib/url-canonicalize";
import { deleteFromPinecone, PINECONE_NS_CHUNKS } from "../src/lib/upstash-vector";

const PAGE_SIZE = 500;

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>;

interface DupGroup {
  canonical_url: string;
  town_id: string;
  doc_ids: string[];
  chunk_counts: number[];
  variant_count: number;
}

// ---------------------------------------------------------------------------
// Step 1: Backfill canonical_url
// ---------------------------------------------------------------------------

async function backfillCanonicalUrls(supabase: SupabaseClient, dryRun: boolean): Promise<number> {
  let backfilled = 0;
  let cursor: string | null = null;

  while (true) {
    let query = supabase
      .from("documents")
      .select("id, url")
      .is("canonical_url", null)
      .order("id")
      .limit(PAGE_SIZE);

    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;
    if (error) {
      console.error("[cleanup] Error fetching documents:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    if (!dryRun) {
      for (const doc of data) {
        const canonical = canonicalizeUrl(doc.url);
        await supabase.from("documents").update({ canonical_url: canonical }).eq("id", doc.id);
      }
    }

    backfilled += data.length;
    cursor = data[data.length - 1].id;
    if (backfilled % 5000 === 0) {
      console.log(`[cleanup] Backfilled ${backfilled} documents...`);
    }
  }
  return backfilled;
}

// ---------------------------------------------------------------------------
// Step 2: Find duplicate groups using service client (no Management API)
// ---------------------------------------------------------------------------

interface DocRow {
  id: string;
  town_id: string;
  canonical_url: string | null;
  chunk_count: number;
  last_ingested_at: string | null;
}

async function findDuplicateGroups(supabase: SupabaseClient): Promise<DupGroup[]> {
  // Load all documents with canonical_url set
  const allDocs: DocRow[] = [];
  let cursor: string | null = null;

  while (true) {
    let q = supabase
      .from("documents")
      .select("id, town_id, canonical_url, chunk_count, last_ingested_at")
      .not("canonical_url", "is", null)
      .order("id")
      .limit(1000);

    if (cursor) q = q.gt("id", cursor);

    const { data, error } = await q;
    if (error) {
      console.error("[cleanup] Error loading documents:", error.message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (!data || data.length === 0) break;

    allDocs.push(...(data as DocRow[]));
    cursor = data[data.length - 1].id;

    if (allDocs.length % 10000 === 0) {
      console.log(`[cleanup] Loaded ${allDocs.length} documents...`);
    }
  }

  console.log(`[cleanup] Loaded ${allDocs.length} documents total`);

  // Group by (town_id, canonical_url)
  const groups = new Map<string, DocRow[]>();
  for (const doc of allDocs) {
    if (!doc.canonical_url) continue;
    const key = `${doc.town_id}|${doc.canonical_url}`;
    const existing = groups.get(key) ?? [];
    existing.push(doc);
    groups.set(key, existing);
  }

  // Filter to groups with duplicates, sort docs within each group
  const dupGroups: DupGroup[] = [];
  for (const docs of groups.values()) {
    if (docs.length < 2) continue;

    // Sort: most chunks first, then most recently ingested
    docs.sort((a, b) => {
      if (b.chunk_count !== a.chunk_count) return b.chunk_count - a.chunk_count;
      const aTime = a.last_ingested_at ? new Date(a.last_ingested_at).getTime() : 0;
      const bTime = b.last_ingested_at ? new Date(b.last_ingested_at).getTime() : 0;
      return bTime - aTime;
    });

    dupGroups.push({
      canonical_url: docs[0].canonical_url!,
      town_id: docs[0].town_id,
      doc_ids: docs.map((d) => d.id),
      chunk_counts: docs.map((d) => d.chunk_count),
      variant_count: docs.length,
    });
  }

  // Sort by total chunk impact (most wasted chunks first)
  dupGroups.sort((a, b) => {
    const aTotal = a.chunk_counts.reduce((s, c) => s + c, 0);
    const bTotal = b.chunk_counts.reduce((s, c) => s + c, 0);
    return bTotal - aTotal;
  });

  return dupGroups.slice(0, 500);
}

// ---------------------------------------------------------------------------
// Step 3: Delete a single loser document's chunks + vectors
// ---------------------------------------------------------------------------

async function deleteLoserDoc(
  supabase: SupabaseClient,
  loserId: string,
): Promise<{ chunksDeleted: number; vectorsDeleted: number; docDeleted: boolean }> {
  let chunkCursor: string | null = null;
  const chunkIds: string[] = [];

  while (true) {
    let q = supabase
      .from("document_chunks")
      .select("id")
      .eq("document_id", loserId)
      .order("id")
      .limit(1000);

    if (chunkCursor) q = q.gt("id", chunkCursor);
    const { data: chunks } = await q;
    if (!chunks || chunks.length === 0) break;

    chunkIds.push(...chunks.map((c) => c.id));
    chunkCursor = chunks[chunks.length - 1].id;
  }

  // Delete from Pinecone
  let vectorsDeleted = 0;
  if (chunkIds.length > 0) {
    try {
      for (let i = 0; i < chunkIds.length; i += 1000) {
        await deleteFromPinecone(PINECONE_NS_CHUNKS, chunkIds.slice(i, i + 1000));
      }
      vectorsDeleted = chunkIds.length;
    } catch (err) {
      console.error(`[cleanup] Pinecone delete error for doc ${loserId}:`, err);
    }
  }

  // Delete chunks from Supabase
  const { error: chunkErr } = await supabase.from("document_chunks").delete().eq("document_id", loserId);
  if (chunkErr) {
    console.error(`[cleanup] Error deleting chunks for ${loserId}:`, chunkErr.message);
    return { chunksDeleted: 0, vectorsDeleted, docDeleted: false };
  }

  // Delete the document itself
  const { error: docErr } = await supabase.from("documents").delete().eq("id", loserId);
  if (docErr) {
    console.error(`[cleanup] Error deleting doc ${loserId}:`, docErr.message);
    return { chunksDeleted: chunkIds.length, vectorsDeleted, docDeleted: false };
  }

  return { chunksDeleted: chunkIds.length, vectorsDeleted, docDeleted: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--execute");

  if (dryRun) {
    console.log("[cleanup] DRY RUN — pass --execute to actually delete duplicates\n");
  }

  const supabase = getSupabaseServiceClient();

  // Step 1
  console.log("[cleanup] Step 1: Backfilling canonical_url...");
  const backfilled = await backfillCanonicalUrls(supabase, dryRun);
  console.log(`[cleanup] Backfilled canonical_url for ${backfilled} documents`);

  // Step 2
  console.log("\n[cleanup] Step 2: Finding duplicate groups...");
  const dupGroups = await findDuplicateGroups(supabase);

  if (dupGroups.length === 0) {
    console.log("[cleanup] No duplicate groups found.");
    return;
  }
  console.log(`[cleanup] Found ${dupGroups.length} duplicate groups`);

  // Step 3: Process each group
  let totalDocsDeleted = 0;
  let totalChunksDeleted = 0;
  let totalVectorsDeleted = 0;

  for (const group of dupGroups) {
    const loserIds = group.doc_ids.slice(1);

    if (dryRun) {
      const loserChunks = group.chunk_counts.slice(1).reduce((a, b) => a + b, 0);
      console.log(
        `  ${group.canonical_url}: ${group.variant_count} variants → ` +
        `keep ${group.doc_ids[0].slice(0, 8)}... (${group.chunk_counts[0]} chunks), ` +
        `delete ${loserIds.length} docs (${loserChunks} chunks)`
      );
      totalDocsDeleted += loserIds.length;
      totalChunksDeleted += loserChunks;
      continue;
    }

    for (const loserId of loserIds) {
      const result = await deleteLoserDoc(supabase, loserId);
      if (result.docDeleted) totalDocsDeleted++;
      totalChunksDeleted += result.chunksDeleted;
      totalVectorsDeleted += result.vectorsDeleted;
    }

    if (totalDocsDeleted % 50 === 0 && totalDocsDeleted > 0) {
      console.log(
        `[cleanup] Progress: ${totalDocsDeleted} docs, ${totalChunksDeleted} chunks, ${totalVectorsDeleted} vectors deleted`
      );
    }
  }

  console.log(`\n[cleanup] ${dryRun ? "Would delete" : "Deleted"}:`);
  console.log(`  ${totalDocsDeleted} duplicate documents`);
  console.log(`  ${totalChunksDeleted} orphaned chunks`);
  console.log(`  ${totalVectorsDeleted} Pinecone vectors`);
}

main().catch((err) => {
  console.error("[cleanup] Failed:", err);
  process.exit(1);
});
