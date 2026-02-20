/**
 * scripts/smoke-test.ts — Smoke test 5 queries against the RAG pipeline
 *
 * Tests similarity scores, answer quality, and checks for boilerplate contamination.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { generateEmbeddings } from "../src/lib/embeddings";
import { queryPinecone, PINECONE_NS_CHUNKS } from "../src/lib/pinecone";

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
  console.log("SMOKE TEST — 5 Queries Against Clean Data (Pinecone)");
  console.log("=".repeat(60));

  for (const query of QUERIES) {
    console.log(`\n--- Query: "${query}" ---`);

    // Generate embedding for the query
    const [queryEmbedding] = await generateEmbeddings([query]);

    // Semantic search via Pinecone
    let pineconeResults;
    try {
      pineconeResults = await queryPinecone(
        PINECONE_NS_CHUNKS,
        queryEmbedding,
        5,
        { town_id: { $eq: "needham" } },
      );
    } catch (err) {
      console.error(`  ERROR: ${err}`);
      continue;
    }

    // Filter by threshold
    const filtered = pineconeResults.filter((r) => r.score >= 0.3);
    if (filtered.length === 0) {
      console.log("  No matches found");
      continue;
    }

    // Fetch chunk text + metadata from Supabase by IDs
    const ids = filtered.map((r) => r.id);
    const { data: chunkData, error } = await supabase
      .from("document_chunks")
      .select("id, chunk_text, metadata")
      .in("id", ids);

    if (error) {
      console.error(`  ERROR fetching metadata: ${error.message}`);
      continue;
    }

    // Merge scores with metadata
    const chunkMap = new Map((chunkData ?? []).map((d: { id: string; chunk_text: string; metadata: Record<string, unknown> }) => [d.id, d]));
    const matches = filtered
      .map((r) => {
        const chunk = chunkMap.get(r.id);
        if (!chunk) return null;
        return { ...chunk, similarity: r.score };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    if (matches.length === 0) {
      console.log("  No matches found (metadata fetch returned empty)");
      continue;
    }

    // Display results
    const topScore = matches[0].similarity;
    const avgScore = matches.reduce((s, m) => s + m.similarity, 0) / matches.length;

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
          console.log(`  ⚠️  BOILERPLATE FOUND: "${marker}" in match from ${(match.metadata as Record<string, unknown>)?.document_url || "unknown"}`);
        }
      }
    }
    if (!hasBoilerplate) {
      console.log(`  ✓ No boilerplate in results`);
    }

    // Show top match preview
    const topChunk = matches[0].chunk_text || "";
    console.log(`  Top match (${(matches[0].metadata as Record<string, unknown>)?.document_title || "unknown"}):`);
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
