import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function main() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error: findError } = await supabase
    .from('articles')
    .select('id, title, published_at, source_urls')
    .eq('is_daily_brief', true)
    .gte('published_at', todayStart.toISOString());

  if (findError) {
    console.error('Error finding briefs:', findError);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No daily brief found for today.');
    return;
  }

  console.log(`Found ${data.length} brief(s):`, data.map(d => ({ id: d.id, title: d.title })));

  const ids = data.map(d => d.id);
  const { error: deleteError } = await supabase
    .from('articles')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('Error deleting:', deleteError);
    process.exit(1);
  }

  console.log(`Deleted ${ids.length} daily brief(s). Ready to regenerate.`);
}

void main();
