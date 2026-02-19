import { getSupabaseServiceClient } from './supabase';

export interface CachedAnswer {
  answer_html: string;
  sources: { title: string; url: string }[];
  created_at: string;
  is_cached: true;
}

const STOPWORDS = new Set([
  'what', 'where', 'when', 'how', 'who', 'which',
  'is', 'are', 'was', 'were', 'be', 'been',
  'the', 'a', 'an',
  'do', 'does', 'did',
  'i', 'my', 'me',
  'can', 'could', 'would', 'should',
  'to', 'for', 'of', 'in', 'on', 'at', 'about', 'with',
]);

/**
 * Normalize a query for cache matching.
 * Lowercase, trim, strip punctuation, collapse whitespace, remove stopwords.
 * This means "what are the transfer station hours?" and
 * "transfer station hours" now hit the same cache entry.
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => !STOPWORDS.has(w))
    .join(' ');
}

/**
 * Look up a cached answer. Returns null on miss.
 * Checks expiry — stale entries return null.
 */
export async function getCachedAnswer(
  query: string,
  townId: string
): Promise<CachedAnswer | null> {
  const normalized = normalizeQuery(query);
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('cached_answers')
    .select('answer_html, sources, created_at')
    .eq('town_id', townId)
    .eq('normalized_query', normalized)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    answer_html: data.answer_html,
    sources: data.sources as { title: string; url: string }[],
    created_at: data.created_at,
    is_cached: true,
  };
}

/**
 * Store an answer in the cache.
 * Default TTL: 30 days.
 */
export async function setCachedAnswer(
  query: string,
  townId: string,
  answerHtml: string,
  sources: { title: string; url: string }[],
  ttlDays: number = 30
): Promise<void> {
  const normalized = normalizeQuery(query);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  const supabase = getSupabaseServiceClient();

  await supabase.from('cached_answers').upsert(
    {
      town_id: townId,
      normalized_query: normalized,
      original_query: query.trim(),
      answer_html: answerHtml,
      sources,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'town_id,normalized_query' }
  );
}

/**
 * Delete expired cache entries to reclaim disk space.
 * Called daily from the monitor cron.
 */
export async function cleanupExpiredCache(): Promise<number> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('cached_answers')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.warn('[answer-cache] Cleanup failed:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}
