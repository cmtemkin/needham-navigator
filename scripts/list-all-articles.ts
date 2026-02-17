import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, content_type, category, status, is_daily_brief, published_at, source_urls')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total articles: ${data?.length ?? 0}\n`);
  for (const a of data ?? []) {
    const urls = a.source_urls?.length ?? 0;
    console.log(`[${a.status}] ${a.is_daily_brief ? '📅 ' : '📰 '}${a.title}`);
    console.log(`  id: ${a.id}`);
    console.log(`  type: ${a.content_type} | category: ${a.category} | sources: ${urls}`);
    console.log(`  published: ${a.published_at}`);
    console.log();
  }
}

void main();
