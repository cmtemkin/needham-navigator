/**
 * scripts/reingest-clean.ts — Clear old data and re-ingest from scraped JSON
 *
 * Reads the scraped-data.json (produced by scraper.ts) and runs the
 * chunk → embed pipeline, replacing all existing data.
 *
 * Usage:
 *   npx tsx scripts/reingest-clean.ts
 *   npx tsx scripts/reingest-clean.ts --clear-first    # Delete all existing chunks first
 *   npx tsx scripts/reingest-clean.ts --input=scripts/scraped-data-remaining.json
 *   npx tsx scripts/reingest-clean.ts --hosts=needhamma.gov,needham.k12.ma.us
 *   npx tsx scripts/reingest-clean.ts --limit=5                # Smoke-test the pipeline
 *
 * --hosts restricts ingestion to documents whose source_url host ends with one
 * of the given suffixes. The 2026 Neon migration used it to drop mass.gov and
 * Wellesley, which were 84% of the corpus (15,070 of 19,550 pages) but are not
 * Needham-specific.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getSupabaseServiceClient } from "../src/lib/db";
import { chunkDocument } from "./chunk";
import { embedAndStoreChunks } from "./embed";
import type { ScrapedDocument } from "./scraper";

async function main() {
  const args = process.argv.slice(2);
  const clearFirst = args.includes("--clear-first");
  const townId = "needham";
  const supabase = getSupabaseServiceClient();

  const inputArg = args.find((a) => a.startsWith("--input="));
  const inputPath = inputArg ? inputArg.slice("--input=".length) : "scripts/scraped-data.json";

  const hostsArg = args.find((a) => a.startsWith("--hosts="));
  // Validate host suffixes rather than trusting the raw flag: they are used in
  // matching and echoed to logs, and a hostname has a narrow legal shape.
  const hostSuffixes = hostsArg
    ? hostsArg
        .slice("--hosts=".length)
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter((h) => /^[a-z0-9.-]+$/.test(h))
    : [];

  // Load scraped data
  const rawData = fs.readFileSync(inputPath, "utf-8");
  const allDocuments: ScrapedDocument[] = JSON.parse(rawData);
  // Log the basename only — the full path can carry local directory names.
  console.log(
    `Loaded ${allDocuments.length} scraped documents from ${path.basename(inputPath)}`
  );

  const documents = hostSuffixes.length
    ? allDocuments.filter((d) => {
        const match = /^https?:\/\/([^/]+)/.exec(d.source_url ?? "");
        if (!match) return false;
        const host = match[1].toLowerCase();
        return hostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
      })
    : allDocuments;

  if (hostSuffixes.length) {
    console.log(
      `Filtered to ${documents.length} documents matching hosts: ${hostSuffixes.join(", ")}`
    );
  }

  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 0;
  if (limit > 0) {
    documents.length = Math.min(documents.length, limit);
    console.log(`Limited to ${documents.length} documents`);
  }

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
