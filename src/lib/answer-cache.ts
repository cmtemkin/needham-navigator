import { getSupabaseServiceClient } from './supabase';

export interface CachedAnswer {
  answer_html: string;
  sources: { title: string; url: string }[];
  created_at: string;
  is_cached: true;
}

/**
 * Normalize a query for cache matching.
 * Lowercase, trim, strip punctuation, collapse whitespace.
 * This means "What are transfer station hours?" matches
 * "transfer station hours" matches "Transfer Station Hours".
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
 * Default TTL: 7 days.
 */
export async function setCachedAnswer(
  query: string,
  townId: string,
  answerHtml: string,
  sources: { title: string; url: string }[],
  ttlDays: number = 7
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
