/**
 * scripts/reingest-clean.ts — Clear old data and re-ingest from scraped JSON
 *
 * Reads the scraped-data.json (produced by scraper.ts) and runs the
 * chunk → embed pipeline, replacing all existing data.
 *
 * Usage:
 *   npx tsx scripts/reingest-clean.ts
 *   npx tsx scripts/reingest-clean.ts --clear-first    # Delete all existing chunks first
 */

import * as fs from "fs";
import { getSupabaseServiceClient } from "../src/lib/supabase";
import { chunkDocument } from "./chunk";
import { embedAndStoreChunks } from "./embed";
import type { ScrapedDocument } from "./scraper";

async function main() {
  const args = process.argv.slice(2);
  const clearFirst = args.includes("--clear-first");
  const townId = "needham";
  const supabase = getSupabaseServiceClient();

  // Load scraped data
  const rawData = fs.readFileSync("scripts/scraped-data.json", "utf-8");
  const documents: ScrapedDocument[] = JSON.parse(rawData);
  console.log(`Loaded ${documents.length} scraped documents`);

  if (clearFirst) {
    console.log("\n--- Clearing existing data ---");

    // Delete all chunks for this town
    const { error: chunkErr, count: chunkCount } = await supabase
      .from("document_chunks")
      .delete()
      .eq("town_id", townId);

    if (chunkErr) {
      console.error("Error clearing chunks:", chunkErr.message);
    } else {
      console.log(`Deleted chunks for town ${townId}`);
    }

    // Delete all documents for this town
    const { error: docErr } = await supabase
      .from("documents")
      .delete()
      .eq("town_id", townId);

    if (docErr) {
      console.error("Error clearing documents:", docErr.message);
    } else {
      console.log(`Deleted documents for town ${townId}`);
    }
  }

  console.log("\n--- Re-ingesting from scraped data ---");

  let totalChunks = 0;
  let totalErrors = 0;
  let processed = 0;

  for (const doc of documents) {
    try {
      // Skip very small documents
      if (doc.content.length < 50) {
        continue;
      }

      // Upsert document record
      const { data: dbDoc, error: upsertErr } = await supabase
        .from("documents")
        .upsert(
          {
            town_id: townId,
            url: doc.source_url,
            title: doc.document_title,
            source_type: doc.document_type,
            content_hash: doc.content_hash,
            file_size_bytes: doc.size_bytes,
            downloaded_at: new Date().toISOString(),
            metadata: { department: doc.department, last_updated: doc.last_updated },
          },
          { onConflict: "town_id,url" }
        )
        .select("id")
        .single();

      if (upsertErr || !dbDoc) {
        console.error(`  Error upserting ${doc.source_url}: ${upsertErr?.message}`);
        totalErrors++;
        continue;
      }

      // Chunk the content
      const chunks = chunkDocument(doc.content, {
        documentId: dbDoc.id,
        documentUrl: doc.source_url,
        documentTitle: doc.document_title,
        department: doc.department,
      });

      // Embed and store
      const result = await embedAndStoreChunks(chunks, dbDoc.id, { townId });
      totalChunks += result.chunksEmbedded;
      totalErrors += result.errors;
      processed++;

      if (processed % 25 === 0) {
        console.log(`  Progress: ${processed}/${documents.length} docs, ${totalChunks} chunks`);
      }
    } catch (err) {
      console.error(`  Error processing ${doc.source_url}:`, err);
      totalErrors++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("RE-INGESTION COMPLETE");
  console.log(`  Documents processed: ${processed}`);
  console.log(`  Total chunks:        ${totalChunks}`);
  console.log(`  Total errors:        ${totalErrors}`);
  console.log("=".repeat(50));

  // Validation summary
  const { count: finalChunks } = await supabase
    .from("document_chunks")
    .select("*", { count: "exact", head: true })
    .eq("town_id", townId);

  const { count: finalDocs } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("town_id", townId);

  console.log(`\nValidation:`);
  console.log(`  Documents in DB: ${finalDocs}`);
  console.log(`  Chunks in DB: ${finalChunks}`);
}

main().catch((err) => {
  console.error("Re-ingestion failed:", err);
  process.exit(1);
});
