import { NextResponse } from 'next/server';
import { hybridSearch, type HybridSearchResult, cleanDocumentTitle } from '@/lib/rag';
import { getCachedAnswer } from '@/lib/answer-cache';
import { DEFAULT_TOWN_ID } from '@/lib/towns';
import { stripMarkdown } from '@/lib/utils';
import { logSearchTelemetry } from '@/lib/telemetry';

// Search-specific threshold (higher than chat since results are user-facing)
// Chat uses 0.3, but search results need stricter filtering to avoid irrelevant matches
const MIN_SIMILARITY_THRESHOLD = 0.35;

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  source_url: string;
  department: string;
  date: string;
  similarity: number;
  highlights: string[];
  // AI enrichment fields (added at ingestion time)
  ai_summary?: string;
  ai_title?: string;
  ai_tags?: string[];
  content_type?: string;
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

  // Extract AI enrichment fields from chunk metadata
  const aiSummary = typeof metadata.ai_summary === 'string' ? metadata.ai_summary : undefined;
  const aiTitle = typeof metadata.ai_title === 'string' ? metadata.ai_title : undefined;
  const aiTags = Array.isArray(metadata.ai_tags) ? metadata.ai_tags : undefined;
  const contentType = typeof metadata.content_type === 'string' ? metadata.content_type : undefined;

  return {
    id: result.id,
    // Prefer AI-cleaned title over raw title if available
    title: aiTitle || title,
    // Prefer AI summary over raw chunk text if available
    snippet: aiSummary || truncateSnippet(cleanedSnippet, 300),
    source_url: sourceUrl,
    department: extractDepartment(metadata),
    date: extractDate(metadata),
    similarity: result.similarity,
    highlights: result.highlight ? [result.highlight] : [],
    // Include enrichment fields for frontend to use
    ai_summary: aiSummary,
    ai_title: aiTitle,
    ai_tags: aiTags,
    content_type: contentType,
  };
}

/**
 * Normalize a URL for deduplication by removing variations that represent the same page.
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Remove protocol (http:// or https://)
  normalized = normalized.replace(/^https?:\/\//i, '');

  // For FAQ pages with query parameters (e.g., Faq.aspx?QID=123, FAQ.asp?TID=45),
  // strip the query params to group all FAQ entries from the same page together.
  // This prevents showing "Frequently Asked Questions" 3+ times with different QIDs.
  if (/\/faq\.(aspx?|php)/i.test(normalized)) {
    normalized = normalized.split('?')[0];
  }

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Convert to lowercase for case-insensitive comparison
  normalized = normalized.toLowerCase();

  return normalized;
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

    // Normalize URL to handle variations (trailing slashes, case, protocol)
    const normalizedUrl = normalizeUrl(result.source_url);

    const existing = bestByUrl.get(normalizedUrl);
    if (!existing || result.similarity > existing.similarity) {
      bestByUrl.set(normalizedUrl, result);
    }
  }

  // Return deduplicated results sorted by similarity (highest first)
  const deduplicated = Array.from(bestByUrl.values()).sort((a, b) => b.similarity - a.similarity);

  // Log deduplication in development to help debug
  if (process.env.NODE_ENV === 'development' && results.length !== deduplicated.length) {
    console.log(`[search] Deduplicated ${results.length} results → ${deduplicated.length} unique URLs`);
  }

  return deduplicated;
}

export const maxDuration = 60;

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
      hybridSearch(query, { townId, limit: limit * 2 }), // Retrieve more for deduplication
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

    // Log telemetry asynchronously (non-blocking, fire-and-forget)
    const topSimilarity = results.length > 0 ? results[0].similarity : undefined;
    const avgSimilarity =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
        : undefined;

    logSearchTelemetry({
      query,
      resultCount: results.length,
      topSimilarity,
      avgSimilarity,
      totalLatencyMs: timingMs,
      hadAiAnswer: !!cachedAnswer,
      town: townId,
    }).catch((error) => {
      // Non-critical — log but don't fail the request
      console.warn('[api/search] Telemetry logging failed:', error);
    });

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
