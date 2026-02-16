import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 Executing bulk SQL migration...\n');

  const sql = `
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

  const { data, error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error('❌ Error executing SQL:', error.message);
    console.log('\n📋 Copy this SQL and run it in Supabase SQL Editor instead:');
    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
    process.exit(1);
  }

  console.log('✅ Migration complete!', data);
}

main();
