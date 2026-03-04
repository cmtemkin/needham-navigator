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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--execute");

  if (dryRun) {
    console.log("[cleanup] DRY RUN — pass --execute to actually delete duplicates\n");
  }

  const supabase = getSupabaseServiceClient();

  // Step 1: Backfill canonical_url
  console.log("[cleanup] Step 1: Backfilling canonical_url...");
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

    // Batch update canonical_url
    for (const doc of data) {
      const canonical = canonicalizeUrl(doc.url);
      if (!dryRun) {
        await supabase
          .from("documents")
          .update({ canonical_url: canonical })
          .eq("id", doc.id);
      }
    }

    backfilled += data.length;
    cursor = data[data.length - 1].id;
    if (backfilled % 5000 === 0) {
      console.log(`[cleanup] Backfilled ${backfilled} documents...`);
    }
  }
  console.log(`[cleanup] Backfilled canonical_url for ${backfilled} documents`);

  // Step 2: Find duplicate groups
  console.log("\n[cleanup] Step 2: Finding duplicate groups...");

  // Use Supabase Management API for the GROUP BY query
  const token = "sbp_979709664b87b79d5ef39c571378c9d76c1faec3";
  const projectRef = "myivfxpbgmzkncshwnup";

  // First, let the backfill settle
  if (!dryRun) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Query for duplicate canonical_urls via management API
  const dupResponse = await fetch(
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

  const dupGroups = (await dupResponse.json()) as Array<{
    canonical_url: string;
    town_id: string;
    doc_ids: string[];
    chunk_counts: number[];
    variant_count: number;
  }>;

  if (!Array.isArray(dupGroups) || dupGroups.length === 0) {
    console.log("[cleanup] No duplicate groups found (backfill may not have completed).");
    return;
  }

  console.log(`[cleanup] Found ${dupGroups.length} duplicate groups`);

  // Step 3: Process each group — keep winner, delete losers
  let totalDocsDeleted = 0;
  let totalChunksDeleted = 0;
  let totalVectorsDeleted = 0;

  for (const group of dupGroups) {
    const winnerId = group.doc_ids[0]; // Highest chunk_count, most recent
    const loserIds = group.doc_ids.slice(1);

    if (dryRun) {
      const loserChunks = group.chunk_counts.slice(1).reduce((a, b) => a + b, 0);
      console.log(
        `  ${group.canonical_url}: ${group.variant_count} variants → ` +
        `keep ${winnerId.slice(0, 8)}... (${group.chunk_counts[0]} chunks), ` +
        `delete ${loserIds.length} docs (${loserChunks} chunks)`
      );
      totalDocsDeleted += loserIds.length;
      totalChunksDeleted += loserChunks;
      continue;
    }

    // Get chunk IDs for losers (for Pinecone deletion)
    for (const loserId of loserIds) {
      // Fetch chunk IDs in batches
      let chunkCursor: string | null = null;
      const chunkIdsToDelete: string[] = [];

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

        chunkIdsToDelete.push(...chunks.map((c) => c.id));
        chunkCursor = chunks[chunks.length - 1].id;
      }

      // Delete from Pinecone
      if (chunkIdsToDelete.length > 0) {
        try {
          // Pinecone deleteMany has a limit per call; batch in groups of 1000
          for (let i = 0; i < chunkIdsToDelete.length; i += 1000) {
            const batch = chunkIdsToDelete.slice(i, i + 1000);
            await deleteFromPinecone(PINECONE_NS_CHUNKS, batch);
          }
          totalVectorsDeleted += chunkIdsToDelete.length;
        } catch (err) {
          console.error(`[cleanup] Pinecone delete error for doc ${loserId}:`, err);
        }
      }

      // Delete chunks from Supabase
      const { error: chunkDeleteError } = await supabase
        .from("document_chunks")
        .delete()
        .eq("document_id", loserId);

      if (chunkDeleteError) {
        console.error(`[cleanup] Error deleting chunks for ${loserId}:`, chunkDeleteError.message);
        continue;
      }

      totalChunksDeleted += chunkIdsToDelete.length;

      // Delete the document itself
      const { error: docDeleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", loserId);

      if (docDeleteError) {
        console.error(`[cleanup] Error deleting doc ${loserId}:`, docDeleteError.message);
      } else {
        totalDocsDeleted++;
      }
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
