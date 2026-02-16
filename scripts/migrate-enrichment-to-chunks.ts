/**
 * Migrate enrichment data from documents table to document_chunks metadata
 * 
 * The enrichment (ai_summary, ai_title, ai_tags, content_type) is stored on the
 * documents table, but search reads from document_chunks. This script denormalizes
 * the enrichment to each chunk's metadata JSON field.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";

async function main() {
  const supabase = getSupabaseServiceClient();

  console.log('🔄 Migrating enrichment from documents to chunks...\n');

  // Get all documents with enrichment
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, ai_summary, ai_title, ai_tags, content_type')
    .not('ai_summary', 'is', null);

  if (docsError) {
    console.error('Error fetching documents:', docsError);
    process.exit(1);
  }

  if (!docs || docs.length === 0) {
    console.log('✓ No enriched documents found. Nothing to migrate.');
    return;
  }

  console.log(`Found ${docs.length} enriched documents to migrate\n`);

  let totalChunks = 0;
  let updated = 0;
  let errors = 0;

  for (const doc of docs) {
    try {
      // Get all chunks for this document
      const { data: chunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select('id, metadata')
        .eq('document_id', doc.id);

      if (chunksError) {
        console.error(`Error fetching chunks for doc ${doc.id}:`, chunksError);
        errors++;
        continue;
      }

      if (!chunks || chunks.length === 0) {
        continue;
      }

      totalChunks += chunks.length;

      // Update each chunk's metadata with enrichment
      for (const chunk of chunks) {
        const updatedMetadata = {
          ...(chunk.metadata as any),
          ai_summary: doc.ai_summary,
          ai_title: doc.ai_title,
          ai_tags: doc.ai_tags,
          content_type: doc.content_type,
        };

        const { error: updateError } = await supabase
          .from('document_chunks')
          .update({ metadata: updatedMetadata })
          .eq('id', chunk.id);

        if (updateError) {
          console.error(`Error updating chunk ${chunk.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }

      process.stdout.write(`\rProgress: ${updated}/${totalChunks} chunks updated`);
    } catch (err) {
      console.error(`Error processing doc ${doc.id}:`, err);
      errors++;
    }
  }

  console.log(`\n\n✅ Migration complete!`);
  console.log(`   Documents: ${docs.length}`);
  console.log(`   Chunks updated: ${updated}/${totalChunks}`);
  console.log(`   Errors: ${errors}`);
}

main();
