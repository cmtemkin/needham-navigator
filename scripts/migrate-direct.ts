/**
 * Direct SQL migration - much faster than updating chunks one by one
 */
import { getSupabaseServiceClient } from "../src/lib/supabase";

async function main() {
  const supabase = getSupabaseServiceClient();

  console.log('🚀 Running direct SQL migration (fast)...\n');

  // This SQL updates all chunks in one query by merging document enrichment into chunk metadata
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE document_chunks dc
      SET metadata = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              dc.metadata,
              '{ai_summary}',
              to_jsonb(d.ai_summary)
            ),
            '{ai_title}',
            to_jsonb(d.ai_title)
          ),
          '{ai_tags}',
          to_jsonb(d.ai_tags)
        ),
        '{content_type}',
        to_jsonb(d.content_type)
      )
      FROM documents d
      WHERE dc.document_id = d.id
        AND d.ai_summary IS NOT NULL;
    `
  });

  if (error) {
    console.error('Error:', error);
    
    // If rpc doesn't exist, run via supabase-js query builder
    console.log('\nTrying alternative method...\n');
    
    const query = `
      UPDATE document_chunks dc
      SET metadata = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              dc.metadata,
              '{ai_summary}',
              to_jsonb(d.ai_summary)
            ),
            '{ai_title}',
            to_jsonb(d.ai_title)
          ),
          '{ai_tags}',
          to_jsonb(d.ai_tags)
        ),
        '{content_type}',
        to_jsonb(d.content_type)
      )
      FROM documents d
      WHERE dc.document_id = d.id
        AND d.ai_summary IS NOT NULL;
    `;
    
    console.log('Run this SQL in your Supabase SQL editor:');
    console.log('='.repeat(60));
    console.log(query);
    console.log('='.repeat(60));
    process.exit(1);
  }

  console.log('✅ Migration complete! All chunks updated.');
}

main();
