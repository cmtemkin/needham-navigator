/**
 * scripts/re-embed-content.ts — Re-embed content_items to Upstash Vector
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/re-embed-content.ts
 *
 * Reads all content_items, generates embeddings, upserts to Upstash Vector
 * in the "content" namespace.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { generateEmbeddings } from "../src/lib/embeddings";
import { upsertToPinecone, PINECONE_NS_CONTENT } from "../src/lib/upstash-vector";
import type { PineconeVector } from "../src/lib/upstash-vector";

async function main() {
  const supabase = getSupabaseServiceClient();

  const { data: items, error } = await supabase
    .from("content_items")
    .select("id, town_id, title, content, category, source_id, metadata")
    .order("id");

  if (error) {
    console.error("Error fetching content_items:", error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log("No content items found.");
    return;
  }

  console.log(`[re-embed-content] Found ${items.length} content items`);

  const MAX_CHARS = 6000;
  const BATCH_SIZE = 50;
  let upserted = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    // Build texts for embedding
    const texts = batch.map((item) => {
      const parts = [item.title || "", item.content || ""].filter(Boolean);
      let text = parts.join("\n\n");
      if (text.length > MAX_CHARS) text = text.substring(0, MAX_CHARS);
      return text;
    });

    const embeddings = await generateEmbeddings(texts);

    // Upsert to Upstash Vector
    const vectors: PineconeVector[] = batch.map((item, j) => ({
      id: item.id,
      values: embeddings[j],
      metadata: {
        town_id: item.town_id ?? "needham",
        category: item.category ?? "",
      },
    }));

    await upsertToPinecone(PINECONE_NS_CONTENT, vectors);
    upserted += batch.length;

    console.log(`[re-embed-content] Embedded ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`);
  }

  console.log(`[re-embed-content] Done! Upserted ${upserted} content item vectors to Upstash.`);
}

main().catch((err) => {
  console.error("[re-embed-content] Failed:", err);
  process.exit(1);
});
