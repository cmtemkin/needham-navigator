export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  source_url: string;
  department: string;
  date: string;
  similarity: number;
  highlights: string[];
}

export interface CachedAnswer {
  answer_html: string;
  sources: { title: string; url: string }[];
  created_at: string;
  is_cached: true;
}

export interface SearchResponse {
  results: SearchResult[];
  cached_answer: CachedAnswer | null;
  timing_ms: number;
}
