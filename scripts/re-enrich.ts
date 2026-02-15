/**
 * scripts/re-enrich.ts — Re-enrich existing documents with AI metadata
 *
 * Queries documents that haven't been enriched yet (ai_summary IS NULL)
 * and generates AI metadata for them. Can also force re-enrichment of all documents.
 *
 * Usage:
 *   npx tsx scripts/re-enrich.ts              # Enrich unenriched documents
 *   npx tsx scripts/re-enrich.ts --force      # Re-enrich all documents
 *   npx tsx scripts/re-enrich.ts --limit=50   # Enrich up to 50 documents
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { enrichDocument, EnrichmentResult } from "./enrich";

interface ReEnrichOptions {
  force?: boolean;
  limit?: number;
  townId?: string;
}

interface DocumentToEnrich {
  id: string;
  url: string;
  title: string;
  content: string;
}

async function fetchDocumentsToEnrich(options: ReEnrichOptions): Promise<DocumentToEnrich[]> {
  const { force = false, limit, townId = "needham" } = options;
  const supabase = getSupabaseServiceClient();

  // Query documents that need enrichment
  let query = supabase
    .from("documents")
    .select("id, url, title, source_type")
    .eq("town_id", townId);

  if (!force) {
    query = query.is("ai_summary", null);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: documents, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  if (!documents || documents.length === 0) {
    return [];
  }

  console.log(`[re-enrich] Found ${documents.length} documents to enrich`);

  // For each document, reconstruct content from chunks
  const documentsToEnrich: DocumentToEnrich[] = [];

  for (const doc of documents) {
    try {
      // Fetch all chunks for this document
      const { data: chunks, error: chunksError } = await supabase
        .from("document_chunks")
        .select("chunk_text, chunk_index")
        .eq("document_id", doc.id)
        .order("chunk_index", { ascending: true });

      if (chunksError) {
        console.error(`[re-enrich] Error fetching chunks for ${doc.url}: ${chunksError.message}`);
        continue;
      }

      if (!chunks || chunks.length === 0) {
        console.warn(`[re-enrich] No chunks found for ${doc.url}, skipping`);
        continue;
      }

      // Reconstruct content from chunks (use first 3000 chars for enrichment)
      const fullContent = chunks.map((c) => c.chunk_text).join("\n\n");

      documentsToEnrich.push({
        id: doc.id,
        url: doc.url,
        title: doc.title || "Untitled",
        content: fullContent,
      });
    } catch (err) {
      console.error(`[re-enrich] Error processing document ${doc.url}:`, err);
    }
  }

  return documentsToEnrich;
}

async function updateDocumentEnrichment(
  documentId: string,
  enrichment: EnrichmentResult
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase
    .from("documents")
    .update({
      ai_summary: enrichment.ai_summary,
      ai_title: enrichment.ai_title,
      ai_tags: enrichment.ai_tags,
      content_type: enrichment.content_type,
      last_enriched: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Failed to update document ${documentId}: ${error.message}`);
  }
}

export async function runReEnrichment(options: ReEnrichOptions = {}): Promise<void> {
  const { force = false, limit, townId = "needham" } = options;

  console.log("\n🤖 AI Document Enrichment");
  console.log("==========================");
  console.log(`Mode: ${force ? "FORCE (re-enrich all)" : "Incremental (unenriched only)"}`);
  console.log(`Town: ${townId}`);
  if (limit) console.log(`Limit: ${limit} documents`);
  console.log();

  // Fetch documents to enrich
  const documents = await fetchDocumentsToEnrich(options);

  if (documents.length === 0) {
    console.log("✓ No documents need enrichment. All done!");
    return;
  }

  console.log(`📝 Enriching ${documents.length} documents...\n`);

  let successCount = 0;
  let errorCount = 0;

  // Process each document
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = `[${i + 1}/${documents.length}]`;

    try {
      process.stdout.write(`${progress} Enriching: ${doc.title.slice(0, 60)}...`);

      // Enrich the document
      const enrichment = await enrichDocument(doc.title, doc.content, doc.url);

      // Update the database
      await updateDocumentEnrichment(doc.id, enrichment);

      console.log(" ✓");

      // Show a sample enrichment for the first 3 documents
      if (i < 3) {
        console.log(`    Summary: ${enrichment.ai_summary.slice(0, 120)}...`);
        console.log(`    Tags: ${enrichment.ai_tags.slice(0, 5).join(", ")}`);
        console.log(`    Type: ${enrichment.content_type}`);
        console.log();
      }

      successCount++;

      // Add a small delay to avoid rate limits (100ms between documents)
      if (i < documents.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.log(" ✗");
      console.error(`    Error: ${err instanceof Error ? err.message : String(err)}`);
      errorCount++;
    }
  }

  console.log("\n==========================");
  console.log("✓ Enrichment complete!");
  console.log(`  Success: ${successCount} documents`);
  if (errorCount > 0) {
    console.log(`  Errors: ${errorCount} documents`);
  }
  console.log();
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;
  const townIdArg = args.find((a) => a.startsWith("--town="));
  const townId = townIdArg ? townIdArg.split("=")[1] : undefined;

  runReEnrichment({ force, limit, townId }).catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
}
