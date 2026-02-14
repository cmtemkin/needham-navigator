import { NextResponse } from 'next/server';
import { hybridSearch, type HybridSearchResult } from '@/lib/rag';
import { getCachedAnswer } from '@/lib/answer-cache';
import { DEFAULT_TOWN_ID } from '@/lib/towns';

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
  const title = typeof metadata.document_title === 'string'
    ? metadata.document_title
    : 'Untitled Document';
  const sourceUrl = typeof metadata.document_url === 'string'
    ? metadata.document_url
    : '';

  return {
    id: result.id,
    title,
    snippet: truncateSnippet(result.chunk_text, 300),
    source_url: sourceUrl,
    department: extractDepartment(metadata),
    date: extractDate(metadata),
    similarity: result.similarity,
    highlights: result.highlight ? [result.highlight] : [],
  };
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
      hybridSearch(query, { townId, limit }),
      getCachedAnswer(query, townId),
    ]);

    const results = hybridResults.map(toSearchResult);
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
