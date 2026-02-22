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

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>;

// ---------------------------------------------------------------------------
// Step 1: Classify all documents and update Supabase
// ---------------------------------------------------------------------------

interface ClassifyResult {
  tierCounts: Record<string, number>;
  classified: number;
  docTierMap: Map<string, RelevanceTier>;
}

async function classifyAllDocuments(
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<ClassifyResult> {
  const tierCounts: Record<string, number> = {};
  const docTierMap = new Map<string, RelevanceTier>();
  let classified = 0;
  let cursor: string | null = null;

  while (true) {
    let query = supabase.from("documents").select("id, url, title").order("id").limit(PAGE_SIZE);
    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;
    if (error) {
      console.error(`[classify] Error (cursor=${cursor}):`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    // Classify and group by tier
    const byTier = new Map<RelevanceTier, string[]>();
    for (const doc of data) {
      const tier = classifyDocument(doc.url, doc.title ?? undefined);
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
      docTierMap.set(doc.id, tier);
      const ids = byTier.get(tier) ?? [];
      ids.push(doc.id);
      byTier.set(tier, ids);
    }

    // Batch update Supabase
    if (!dryRun) {
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

  return { tierCounts, classified, docTierMap };
}

// ---------------------------------------------------------------------------
// Step 2: Update Pinecone metadata
// ---------------------------------------------------------------------------

async function updatePineconeMetadata(
  supabase: SupabaseClient,
  docTierMap: Map<string, RelevanceTier>,
): Promise<{ updated: number; errors: number }> {
  const index = getPineconeIndex();
  const ns = index.namespace(PINECONE_NS_CHUNKS);
  let updated = 0;
  let errors = 0;

  const docEntries = Array.from(docTierMap.entries());

  for (let i = 0; i < docEntries.length; i += 100) {
    const batch = docEntries.slice(i, i + 100);

    for (const [docId, tier] of batch) {
      const { data: chunks } = await supabase
        .from("document_chunks")
        .select("id")
        .eq("document_id", docId);

      if (!chunks || chunks.length === 0) continue;

      const updatePromises = chunks.map((chunk) =>
        ns.update({ id: chunk.id, metadata: { relevance_tier: tier } })
          .catch(() => { errors++; })
      );

      await Promise.all(updatePromises);
      updated += chunks.length;
    }

    if ((i + 100) % 1000 === 0) {
      console.log(
        `[classify] Pinecone: ${updated} vectors updated, ${errors} errors, ` +
        `${i + 100}/${docEntries.length} documents processed`
      );
    }
  }

  return { updated, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--execute");

  if (dryRun) {
    console.log("[classify] DRY RUN — pass --execute to apply changes\n");
  }

  const supabase = getSupabaseServiceClient();

  // Step 1
  console.log("[classify] Step 1: Classifying documents by domain rules...");
  const { tierCounts, classified, docTierMap } = await classifyAllDocuments(supabase, dryRun);

  console.log(`\n[classify] Classification results (${classified} documents):`);
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count} (${((count / classified) * 100).toFixed(1)}%)`);
  }

  if (dryRun) {
    console.log("\n[classify] Dry run complete. Pass --execute to apply changes.");
    return;
  }

  // Step 2
  console.log("\n[classify] Step 2: Updating Pinecone metadata...");
  const { updated, errors } = await updatePineconeMetadata(supabase, docTierMap);
  console.log(`\n[classify] Pinecone update complete: ${updated} vectors updated, ${errors} errors`);
}

main().catch((err) => {
  console.error("[classify] Failed:", err);
  process.exit(1);
});
