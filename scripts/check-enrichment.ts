/**
 * Quick script to check enrichment results in the database
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";

async function checkEnrichment() {
  const supabase = getSupabaseServiceClient();

  const { data: chunks, error } = await supabase
    .from("document_chunks")
    .select("metadata")
    .limit(10)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log("Recent Chunks (last 10):");
  console.log("========================\n");

  const typeCount: Record<string, number> = {};
  chunks?.forEach((chunk, i) => {
    const meta = chunk.metadata as any;
    const contentType = meta.content_type || "unknown";
    typeCount[contentType] = (typeCount[contentType] || 0) + 1;

    console.log(`${i + 1}. Type: ${contentType}`);
    console.log(`   Title: ${meta.ai_title || meta.document_title || "N/A"}`);
    console.log(`   URL: ${meta.document_url?.substring(0, 60)}...`);
    if (meta.ai_summary) {
      console.log(`   Summary: ${meta.ai_summary.substring(0, 80)}...`);
    }
    if (meta.ai_tags && meta.ai_tags.length > 0) {
      console.log(`   Tags: ${meta.ai_tags.slice(0, 5).join(", ")}`);
    }
    console.log();
  });

  console.log("Content Type Distribution:");
  Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
}

checkEnrichment();
