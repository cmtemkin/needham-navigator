/**
 * scripts/classify-documents.ts — Backfill relevance_tier for all documents
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/classify-documents.ts --dry-run     # Preview
 *   npx tsx --env-file=.env.local scripts/classify-documents.ts --execute      # Apply + update Pinecone
 *
 * Steps:
 * 1. Classify all documents by domain rules
 * 2. Update documents.relevance_tier in Supabase
 * 3. Update Pinecone vector metadata with relevance_tier (no re-embedding)
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { classifyDocument } from "../src/lib/relevance-classifier";
import type { RelevanceTier } from "../src/lib/relevance-classifier";
import { getPineconeIndex, PINECONE_NS_CHUNKS } from "../src/lib/pinecone";

const PAGE_SIZE = 500;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--execute");

  if (dryRun) {
    console.log("[classify] DRY RUN — pass --execute to apply changes\n");
  }

  const supabase = getSupabaseServiceClient();

  // Step 1: Classify all documents
  console.log("[classify] Step 1: Classifying documents by domain rules...");

  const tierCounts: Record<string, number> = {};
  let classified = 0;
  let cursor: string | null = null;

  // Track document_id → tier for Pinecone update
  const docTierMap = new Map<string, RelevanceTier>();

  while (true) {
    let query = supabase
      .from("documents")
      .select("id, url, title")
      .order("id")
      .limit(PAGE_SIZE);

    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;
    if (error) {
      console.error(`[classify] Error (cursor=${cursor}):`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    // Batch classify
    const updates: Array<{ id: string; tier: RelevanceTier }> = [];
    for (const doc of data) {
      const tier = classifyDocument(doc.url, doc.title ?? undefined);
      updates.push({ id: doc.id, tier });
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
      docTierMap.set(doc.id, tier);
    }

    // Apply to Supabase
    if (!dryRun) {
      // Group by tier for efficient batch updates
      const byTier = new Map<RelevanceTier, string[]>();
      for (const u of updates) {
        const ids = byTier.get(u.tier) ?? [];
        ids.push(u.id);
        byTier.set(u.tier, ids);
      }

      for (const [tier, ids] of byTier) {
        const { error: updateError } = await supabase
          .from("documents")
          .update({ relevance_tier: tier })
          .in("id", ids);

        if (updateError) {
          console.error(`[classify] Error updating tier '${tier}':`, updateError.message);
        }
      }
    }

    classified += data.length;
    cursor = data[data.length - 1].id;
    if (classified % 5000 === 0) {
      console.log(`[classify] Classified ${classified} documents...`);
    }
  }

  console.log(`\n[classify] Classification results (${classified} documents):`);
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count} (${((count / classified) * 100).toFixed(1)}%)`);
  }

  if (dryRun) {
    console.log("\n[classify] Dry run complete. Pass --execute to apply changes.");
    return;
  }

  // Step 2: Update Pinecone metadata with relevance_tier
  console.log("\n[classify] Step 2: Updating Pinecone metadata...");

  const index = getPineconeIndex();
  const ns = index.namespace(PINECONE_NS_CHUNKS);

  let pineconeUpdated = 0;
  let pineconeErrors = 0;

  // Process documents in batches — fetch their chunk IDs, then update Pinecone metadata
  const docEntries = Array.from(docTierMap.entries());

  for (let i = 0; i < docEntries.length; i += 100) {
    const batch = docEntries.slice(i, i + 100);

    for (const [docId, tier] of batch) {
      // Get chunk IDs for this document
      const { data: chunks } = await supabase
        .from("document_chunks")
        .select("id")
        .eq("document_id", docId);

      if (!chunks || chunks.length === 0) continue;

      // Update Pinecone metadata for each chunk
      const updatePromises = chunks.map((chunk) =>
        ns
          .update({ id: chunk.id, metadata: { relevance_tier: tier } })
          .catch(() => { pineconeErrors++; })
      );

      await Promise.all(updatePromises);
      pineconeUpdated += chunks.length;
    }

    if ((i + 100) % 1000 === 0) {
      console.log(
        `[classify] Pinecone: ${pineconeUpdated} vectors updated, ${pineconeErrors} errors, ` +
        `${i + 100}/${docEntries.length} documents processed`
      );
    }
  }

  console.log(
    `\n[classify] Pinecone update complete: ${pineconeUpdated} vectors updated, ${pineconeErrors} errors`
  );
}

main().catch((err) => {
  console.error("[classify] Failed:", err);
  process.exit(1);
});
