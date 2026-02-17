import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function main() {
  // Check all recent briefs (last 2 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);

  const { data, error } = await supabase
    .from('articles')
    .select('id, title, content_type, is_daily_brief, published_at, source_urls, summary')
    .eq('is_daily_brief', true)
    .gte('published_at', cutoff.toISOString())
    .order('published_at', { ascending: false });

  console.log('Recent daily briefs:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);

  // Also check what today's UTC date looks like vs server
  const now = new Date();
  console.log('\nCurrent UTC time:', now.toISOString());
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  console.log('Today start (local):', todayStart.toISOString());
}

void main();
