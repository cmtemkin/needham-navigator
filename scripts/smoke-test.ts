/**
 * scripts/smoke-test.ts — Smoke test 5 queries against the RAG pipeline
 *
 * Tests similarity scores, answer quality, and checks for boilerplate contamination.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { generateEmbeddings } from "../src/lib/embeddings";

const QUERIES = [
  "when is the dump open?",
  "who do I call about a rat in my yard?",
  "can I build a deck?",
  "where do I vote?",
  "what's the snow parking ban?",
];

const BOILERPLATE_MARKERS = [
  "CivicPlus",
  "BESbswy",
  "Select Language",
  "Government Websites by",
  "Arrow LeftArrow Right",
  "Do Not Show Again",
  "[Loading]",
  "Sign Up for the Town's Weekly",
];

async function main() {
  const supabase = getSupabaseServiceClient();

  console.log("=".repeat(60));
  console.log("SMOKE TEST — 5 Queries Against Clean Data");
  console.log("=".repeat(60));

  for (const query of QUERIES) {
    console.log(`\n--- Query: "${query}" ---`);

    // Generate embedding for the query
    const [queryEmbedding] = await generateEmbeddings([query]);

    // Semantic search
    const { data: matches, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 5,
      match_town_id: "needham",
    });

    if (error) {
      console.error(`  ERROR: ${error.message}`);
      continue;
    }

    if (!matches || matches.length === 0) {
      console.log("  No matches found");
      continue;
    }

    // Display results
    const topScore = matches[0].similarity;
    const avgScore = matches.reduce((s: number, m: { similarity: number }) => s + m.similarity, 0) / matches.length;

    let confidence: string;
    if (topScore >= 0.85) confidence = "HIGH";
    else if (topScore >= 0.70) confidence = "MEDIUM";
    else if (topScore >= 0.55) confidence = "LOW-MEDIUM";
    else confidence = "LOW";

    console.log(`  Top similarity: ${topScore.toFixed(4)}`);
    console.log(`  Avg similarity: ${avgScore.toFixed(4)}`);
    console.log(`  Confidence: ${confidence}`);
    console.log(`  Matches: ${matches.length}`);

    // Check for boilerplate in results
    let hasBoilerplate = false;
    for (const match of matches) {
      for (const marker of BOILERPLATE_MARKERS) {
        if (match.chunk_text?.includes(marker)) {
          hasBoilerplate = true;
          console.log(`  ⚠️  BOILERPLATE FOUND: "${marker}" in match from ${match.metadata?.document_url || "unknown"}`);
        }
      }
    }
    if (!hasBoilerplate) {
      console.log(`  ✓ No boilerplate in results`);
    }

    // Show top match preview
    const topChunk = matches[0].chunk_text || "";
    console.log(`  Top match (${(matches[0].metadata as any)?.document_title || "unknown"}):`);
    console.log(`    "${topChunk.substring(0, 200).replace(/\n/g, " ")}..."`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("SMOKE TEST COMPLETE");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
