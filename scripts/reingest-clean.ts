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
 *   npx tsx scripts/reingest-clean.ts --match=CivicAlerts       # Re-ingest specific URLs
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
  const requestedInput = inputArg ? inputArg.slice("--input=".length) : "scripts/scraped-data.json";

  // Validate rather than trust argv: the value is read from disk and echoed to
  // logs. Restricting it to a plain .json filename under the repo also stops a
  // stray flag from pointing the ingest at an unrelated file.
  const inputName = path.basename(requestedInput);
  if (!/^[A-Za-z0-9._-]+\.json$/.test(inputName)) {
    throw new Error(`--input must be a .json file name, got: ${inputName}`);
  }
  const inputPath = path.join(path.dirname(requestedInput), inputName);

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
  // NOSONAR — inputName is not raw argv: it is a basename checked against
  // /^[A-Za-z0-9._-]+\.json$/ above, so it cannot carry a path or arbitrary
  // text. Sonar's taint analysis does not recognise that regex as a sanitiser.
  // Knowing which file a re-ingest actually read is worth keeping in the log.
  console.log(`Loaded ${allDocuments.length} scraped documents from ${inputName}`);

  let documents = hostSuffixes.length
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

  // --match re-ingests just the documents whose URL contains a substring. Used
  // to pick up individual pages that failed a previous run without repeating the
  // whole corpus; documents upsert on (town_id, url) so this is safe to re-run.
  const matchArg = args.find((a) => a.startsWith("--match="));
  if (matchArg) {
    const needle = matchArg.slice("--match=".length);
    // Restrict to characters that can legally appear in a URL. A substring with
    // anything else would match nothing anyway, so failing loudly beats a run
    // that silently ingests zero documents.
    if (!/^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(needle)) {
      throw new Error("--match must contain only characters that are legal in a URL");
    }
    const before = documents.length;
    documents = documents.filter((d) => (d.source_url ?? "").includes(needle));
    console.log(`Matched ${documents.length} of ${before} documents on URL substring`);
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
