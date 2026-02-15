import { NextResponse } from 'next/server';
import { hybridSearch, type HybridSearchResult, cleanDocumentTitle } from '@/lib/rag';
import { getCachedAnswer } from '@/lib/answer-cache';
import { DEFAULT_TOWN_ID } from '@/lib/towns';
import { stripMarkdown } from '@/lib/utils';

// Import the same threshold used in the chat RAG pipeline
const MIN_SIMILARITY_THRESHOLD = 0.3;

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  source_url: string;
  department: string;
  date: string;
  similarity: number;
  highlights: string[];
}

type SearchRequestBody = {
  query?: unknown;
  town_id?: unknown;
  townId?: unknown;
  limit?: unknown;
};

function truncateSnippet(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

function extractDepartment(metadata: Record<string, unknown>): string {
  if (typeof metadata.department === 'string') return metadata.department;
  if (typeof metadata.chunk_type === 'string') return metadata.chunk_type;
  return 'General';
}

function extractDate(metadata: Record<string, unknown>): string {
  const dateFields = ['document_date', 'effective_date', 'last_amended', 'last_verified_at', 'last_updated'];
  for (const field of dateFields) {
    if (typeof metadata[field] === 'string' && metadata[field]) {
      return metadata[field] as string;
    }
  }
  return '';
}

function toSearchResult(result: HybridSearchResult): SearchResult {
  const metadata = result.metadata as Record<string, unknown>;
  const rawTitle = typeof metadata.document_title === 'string'
    ? metadata.document_title
    : 'Untitled Document';
  const title = cleanDocumentTitle(rawTitle);
  const sourceUrl = typeof metadata.document_url === 'string'
    ? metadata.document_url
    : '';

  // Strip markdown from snippet before truncating
  const cleanedSnippet = stripMarkdown(result.chunk_text);

  return {
    id: result.id,
    title,
    snippet: truncateSnippet(cleanedSnippet, 300),
    source_url: sourceUrl,
    department: extractDepartment(metadata),
    date: extractDate(metadata),
    similarity: result.similarity,
    highlights: result.highlight ? [result.highlight] : [],
  };
}

/**
 * Deduplicate search results by source URL.
 * For each unique URL, keeps only the result with the highest similarity score.
 */
function deduplicateByUrl(results: SearchResult[]): SearchResult[] {
  const bestByUrl = new Map<string, SearchResult>();

  for (const result of results) {
    // Skip results without a source URL
    if (!result.source_url) {
      continue;
    }

    const existing = bestByUrl.get(result.source_url);
    if (!existing || result.similarity > existing.similarity) {
      bestByUrl.set(result.source_url, result);
    }
  }

  // Return deduplicated results sorted by similarity (highest first)
  return Array.from(bestByUrl.values()).sort((a, b) => b.similarity - a.similarity);
}

export async function POST(request: Request): Promise<Response> {
  const start = performance.now();

  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  // Validate query
  if (typeof body.query !== 'string' || !body.query.trim()) {
    return NextResponse.json(
      { error: 'Query parameter is required and must be a non-empty string.' },
      { status: 400 }
    );
  }

  const query = body.query.trim();
  if (query.length > 500) {
    return NextResponse.json(
      { error: 'Query must be 500 characters or less.' },
      { status: 400 }
    );
  }

  // Parse town_id and limit
  const townId =
    (typeof body.town_id === 'string' && body.town_id.trim()) ||
    (typeof body.townId === 'string' && body.townId.trim()) ||
    DEFAULT_TOWN_ID;

  let limit = 10;
  if (typeof body.limit === 'number' && Number.isInteger(body.limit) && body.limit > 0) {
    limit = Math.min(body.limit, 20); // Cap at 20
  }

  try {
    // Run hybrid search and cache lookup in parallel
    const [hybridResults, cachedAnswer] = await Promise.all([
      hybridSearch(query, { townId, limit: limit * 3 }), // Retrieve more for deduplication
      getCachedAnswer(query, townId),
    ]);

    // Convert to search results
    let results = hybridResults.map(toSearchResult);

    // Apply similarity threshold filter (same as chat RAG pipeline)
    results = results.filter(r => r.similarity >= MIN_SIMILARITY_THRESHOLD);

    // Deduplicate by source URL (keep highest-scoring chunk per page)
    results = deduplicateByUrl(results);

    // Limit to requested count after deduplication
    results = results.slice(0, limit);

    const timingMs = Math.round(performance.now() - start);

    return NextResponse.json({
      results,
      cached_answer: cachedAnswer,
      timing_ms: timingMs,
    });
  } catch (error) {
    console.error('[api/search] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected search API error.';
    return NextResponse.json(
      {
        error: 'Unable to process search request. Please try again.',
        details: message,
      },
      { status: 500 }
    );
  }
}
