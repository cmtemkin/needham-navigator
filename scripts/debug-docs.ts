import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function main() {
  // Check what columns exist by fetching 1 row
  const { data: sample, error: sampleErr } = await supabase
    .from('documents')
    .select('*')
    .limit(1)
    .single();

  if (sampleErr) {
    console.error('Error fetching sample:', sampleErr);
  } else {
    console.log('Document columns:', Object.keys(sample));
    console.log('Sample document:', JSON.stringify(sample, null, 2));
  }

  // Try querying with town_id filter
  const { data: withTown, error: townErr, count: townCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact' })
    .eq('town_id', 'needham')
    .limit(1);

  console.log(`\nDocuments with town_id='needham': ${townCount ?? withTown?.length ?? 0}`);
  if (townErr) console.log('Town query error:', townErr);

  // Try without town_id filter
  const { count: totalCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact' })
    .limit(1);

  console.log(`Total documents (no filter): ${totalCount}`);

  // Check last_ingested_at range
  const { data: dateRange } = await supabase
    .from('documents')
    .select('last_ingested_at')
    .order('last_ingested_at', { ascending: true })
    .limit(1);

  const { data: dateRangeMax } = await supabase
    .from('documents')
    .select('last_ingested_at')
    .order('last_ingested_at', { ascending: false })
    .limit(1);

  console.log(`\nOldest last_ingested_at: ${dateRange?.[0]?.last_ingested_at}`);
  console.log(`Newest last_ingested_at: ${dateRangeMax?.[0]?.last_ingested_at}`);

  // Check 365-day cutoff
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  console.log(`\n365-day cutoff: ${since}`);

  const { count: matchCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact' })
    .gte('last_ingested_at', since)
    .limit(1);

  console.log(`Documents within 365 days: ${matchCount}`);
}

void main();
