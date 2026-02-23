/**
 * scripts/classify-documents.ts — Backfill relevance_tier for all documents
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/classify-documents.ts --dry-run     # Preview
 *   npx tsx --env-file=.env.local scripts/classify-documents.ts --execute      # Apply to Supabase
 *
 * Steps:
 * 1. Classify all documents by domain rules
 * 2. Update documents.relevance_tier in Supabase
 *
 * Note: To update vector metadata in Upstash after classifying, re-run re-embed.ts.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { classifyDocument } from "../src/lib/relevance-classifier";
import type { RelevanceTier } from "../src/lib/relevance-classifier";

const PAGE_SIZE = 500;

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>;

// ---------------------------------------------------------------------------
// Classify all documents and update Supabase
// ---------------------------------------------------------------------------

interface ClassifyResult {
  tierCounts: Record<string, number>;
  classified: number;
}

async function classifyAllDocuments(
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<ClassifyResult> {
  const tierCounts: Record<string, number> = {};
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

  return { tierCounts, classified };
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

  console.log("[classify] Classifying documents by domain rules...");
  const { tierCounts, classified } = await classifyAllDocuments(supabase, dryRun);

  console.log(`\n[classify] Classification results (${classified} documents):`);
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count} (${((count / classified) * 100).toFixed(1)}%)`);
  }

  if (dryRun) {
    console.log("\n[classify] Dry run complete. Pass --execute to apply changes.");
    return;
  }

  console.log("\n[classify] Supabase update complete.");
  console.log("[classify] To update vector metadata, run: npx tsx --env-file=.env.local scripts/re-embed.ts");
}

main().catch((err) => {
  console.error("[classify] Failed:", err);
  process.exit(1);
});
