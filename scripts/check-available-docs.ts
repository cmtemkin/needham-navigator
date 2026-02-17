import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(url, key);

async function main() {
  // Count all documents
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, url, title, created_at, last_ingested_at')
    .order('last_ingested_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total documents: ${docs?.length ?? 0}\n`);

  // Count documents with chunks (that have actual content)
  const { data: chunked } = await supabase
    .from('documents')
    .select('id, url, document_chunks(id)')
    .not('document_chunks', 'is', null);

  const withChunks = (chunked ?? []).filter(d => (d.document_chunks as unknown[])?.length > 0);
  console.log(`Documents with chunks: ${withChunks.length}\n`);

  // Check existing article source URLs to see what's already covered
  const { data: articles } = await supabase
    .from('articles')
    .select('source_urls');

  const coveredUrls = new Set<string>();
  for (const a of articles ?? []) {
    for (const u of a.source_urls ?? []) {
      coveredUrls.add(u);
    }
  }
  console.log(`URLs already covered by articles: ${coveredUrls.size}\n`);

  // Show sample of uncovered document URLs
  const uncovered = (docs ?? []).filter(d => !coveredUrls.has(d.url));
  console.log(`Uncovered documents: ${uncovered.length}\n`);
  console.log('Sample uncovered URLs:');
  for (const d of uncovered.slice(0, 30)) {
    console.log(`  ${d.url}`);
  }
}

void main();
