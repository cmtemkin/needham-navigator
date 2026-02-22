/**
 * scripts/cleanup-url-duplicates.ts — Deduplicate documents by canonical URL
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/cleanup-url-duplicates.ts --dry-run    # Preview changes
 *   npx tsx --env-file=.env.local scripts/cleanup-url-duplicates.ts --execute     # Actually delete dupes
 *
 * Steps:
 * 1. Backfills canonical_url for all documents
 * 2. Finds duplicate groups (same town_id + canonical_url)
 * 3. Keeps the document with the most chunks (tiebreak: most recent last_ingested_at)
 * 4. Deletes loser documents' chunks from Supabase and Pinecone
 * 5. Deletes the loser document rows
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { canonicalizeUrl } from "../src/lib/url-canonicalize";
import { deleteFromPinecone, PINECONE_NS_CHUNKS } from "../src/lib/pinecone";

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
// Step 2: Find duplicate groups via Supabase Management API
// ---------------------------------------------------------------------------

async function findDuplicateGroups(token: string, projectRef: string): Promise<DupGroup[]> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          SELECT canonical_url, town_id,
                 array_agg(id ORDER BY chunk_count DESC, last_ingested_at DESC NULLS LAST) as doc_ids,
                 array_agg(chunk_count ORDER BY chunk_count DESC, last_ingested_at DESC NULLS LAST) as chunk_counts,
                 COUNT(*) as variant_count
          FROM documents
          WHERE canonical_url IS NOT NULL
          GROUP BY canonical_url, town_id
          HAVING COUNT(*) > 1
          ORDER BY SUM(chunk_count) DESC
          LIMIT 500;
        `,
      }),
    }
  );

  const groups = (await response.json()) as DupGroup[];
  return Array.isArray(groups) ? groups : [];
}

// ---------------------------------------------------------------------------
// Step 3: Delete a single loser document's chunks + vectors
// ---------------------------------------------------------------------------

async function deleteLoserDoc(
  supabase: SupabaseClient,
  loserId: string,
): Promise<{ chunksDeleted: number; vectorsDeleted: number; docDeleted: boolean }> {
  // Fetch chunk IDs in batches
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
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? "myivfxpbgmzkncshwnup";
  if (!token) {
    console.error("[cleanup] SUPABASE_ACCESS_TOKEN env var is required for duplicate detection");
    process.exit(1);
  }

  if (!dryRun) await new Promise((r) => setTimeout(r, 2000));

  const dupGroups = await findDuplicateGroups(token, projectRef);
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
