import { getSupabaseServiceClient } from '../src/lib/supabase';

async function main() {
  const supabase = getSupabaseServiceClient();
  
  // Check if columns exist
  const { data, error } = await supabase
    .from('documents')
    .select('id, ai_summary, ai_title, ai_tags, content_type, last_enriched')
    .limit(1);
  
  if (error) {
    console.log('❌ Enrichment columns do NOT exist');
    console.log(`Error: ${error.message}`);
    console.log('\nColumns need to be added via Supabase SQL Editor.');
    console.log('Copy the SQL from: supabase/migrations/20260215000000_add_ai_enrichment_columns.sql');
    return false;
  }
  
  console.log('✓ Enrichment columns exist!');
  console.log('Sample row:', data?.[0] || 'No documents found');
  return true;
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
