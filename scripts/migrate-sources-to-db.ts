/**
 * scripts/migrate-sources-to-db.ts
 *
 * One-time migration: reads all sources from config/crawl-sources.ts
 * and upserts them into the Supabase `sources` table.
 *
 * Usage: npx ts-node scripts/migrate-sources-to-db.ts
 */

import { getSupabaseServiceClient } from "../src/lib/db";
import { CRAWL_SOURCES } from "../config/crawl-sources";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const supabase = getSupabaseServiceClient();

async function migrate() {
  console.log(`Migrating ${CRAWL_SOURCES.length} sources to database...`);

  const rows = CRAWL_SOURCES.map((src) => ({
    town_id: "needham",
    url: src.url,
    name: src.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    category: src.category,
    priority: src.priority,
    update_frequency: src.updateFrequency,
    document_type: src.documentType ?? "html",
    max_depth: src.maxDepth ?? 2,
    max_pages: src.maxPages ?? 10,
    is_active: src.status !== "blocked" && src.status !== "requires_api",
    metadata: {
      crawl_mode: src.crawlMode ?? "single",
      original_id: src.id,
      content_type: src.contentType,
    },
  }));

  const { data, error } = await supabase
    .from("sources")
    .upsert(rows, { onConflict: "town_id,url" })
    .select("id");

  if (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }

  console.log(`Successfully upserted ${data?.length ?? 0} sources.`);
}

migrate().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
