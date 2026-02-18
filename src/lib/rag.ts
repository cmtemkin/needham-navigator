import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID as DEFAULT_TOWN_ID_FROM_CONFIG } from "@/lib/towns";
import { expandQuery } from "@/lib/synonyms";
import { rewriteQuery } from "@/lib/query-rewriter";
import { trackEvent } from "@/lib/pendo";
import { CohereClient } from "cohere-ai";
import type { RetrievalConfig } from "@/lib/query-router";

export const DEFAULT_TOWN_ID = DEFAULT_TOWN_ID_FROM_CONFIG;

const DEFAULT_MATCH_THRESHOLD = 0.7;
const DEFAULT_MATCH_COUNT = 30; // Retrieve more for reranking
const DEFAULT_FINAL_COUNT = 10; // Final chunks to pass to LLM
const MIN_SIMILARITY_FLOOR = 0.3; // Drop chunks below this — they're noise (tuned for better recall)

// Cohere client for cross-encoder reranking (optional upgrade over formula-based reranking)
const cohereClient =
  process.env.COHERE_API_KEY && process.env.USE_CROSS_ENCODER_RERANK === "true"
    ? new CohereClient({ token: process.env.COHERE_API_KEY })
    : null;

type ChunkMetadata = Record<string, unknown>;

type MatchDocumentRow = {
  id: string;
  chunk_text: string;
  metadata: ChunkMetadata | null;
  similarity: number;
};

type TextSearchRow = {
  id: string;
  chunk_text: string;
  metadata: ChunkMetadata | null;
};

export type SourceReference = {
  sourceId: string;
  citation: string;
  documentTitle: string;
  documentUrl?: string;
  section?: string;
  date?: string;
  pageNumber?: number;
};

export type RetrievedChunk = {
  id: string;
  chunkText: string;
  similarity: number;
  metadata: ChunkMetadata;
  source: SourceReference;
  cohereScore?: number;  // Added by Cohere reranker if used
  relevanceScore?: number;  // Added by formula reranking
};

export type HybridSearchResult = {
  id: string;
  chunk_text: string;
  metadata: ChunkMetadata;
  source: SourceReference;
  similarity: number;
  text_rank: number;
  score: number;
  highlight: string;
};

function asMetadata(value: unknown): ChunkMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as ChunkMetadata;
}

function readString(meta: ChunkMetadata, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(meta: ChunkMetadata, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

/**
 * Strip CivicPlus CMS metadata from document titles.
 * "Frequently Asked Questions - CivicPlus.CMS.FAQ" → "Frequently Asked Questions"
 */
const GENERIC_TITLES = new Set(["untitled", "default", "n/a", "none", "document", "scanned document"]);

export function cleanDocumentTitle(title: string): string {
  let cleaned = title;
  // Remove CivicPlus module suffixes like "- CivicPlus.CMS.FAQ", "- CivicPlus.CMS.Document"
  cleaned = cleaned.replace(/\s*[-–]\s*CivicPlus\.[A-Za-z.]+$/i, "");
  // Remove CivicEngage suffixes like "• Needham • CivicEngage"
  cleaned = cleaned.replace(/\s*[•·]\s*(?:Needham\s*[•·]\s*)?CivicEngage$/i, "");
  // Remove trailing " • Needham" standalone
  cleaned = cleaned.replace(/\s*[•·]\s*Needham$/i, "");
  // Remove trailing " - Needham, MA" or " | Town of Needham"
  cleaned = cleaned.replace(/\s*[-–|]\s*(?:Town of\s+)?Needham(?:,?\s*MA)?$/i, "");
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  // If the title is now empty or too generic, fall back
  if (!cleaned || cleaned.length < 3) return title.trim();
  return cleaned;
}

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.toLowerCase().trim());
}

function cleanLine(text: string, maxLength = 400): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function coerceSimilarity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function getSection(metadata: ChunkMetadata): string | undefined {
  const sectionNumber = readString(metadata, ["section_number"]);
  const sectionTitle = readString(metadata, ["section_title"]);

  if (sectionNumber && sectionTitle) {
    return `${sectionNumber} ${sectionTitle}`;
  }
  if (sectionNumber) {
    return sectionNumber;
  }
  return sectionTitle;
}

function getDocumentDate(metadata: ChunkMetadata): string | undefined {
  return readString(metadata, [
    "document_date",
    "effective_date",
    "last_amended",
    "last_verified_at",
    "last_updated",
  ]);
}

export function formatSourceCitation(metadata: ChunkMetadata): string {
  const rawTitle =
    readString(metadata, ["document_title", "title"]) ?? "Unknown Document";
  const documentTitle = cleanDocumentTitle(rawTitle);
  const section = getSection(metadata);
  const date = getDocumentDate(metadata);

  // Only include section/date if they're meaningful (not "Default", "Introduction", "Unknown date")
  const boilerplateSections = new Set(["default", "introduction", "section n/a", "n/a"]);
  const cleanSection = section && !boilerplateSections.has(section.toLowerCase()) ? section : undefined;
  const cleanDate = date && date !== "Unknown date" ? date : undefined;

  if (cleanSection && cleanDate) return `[${documentTitle}, ${cleanSection} (${cleanDate})]`;
  if (cleanSection) return `[${documentTitle}, ${cleanSection}]`;
  if (cleanDate) return `[${documentTitle} (${cleanDate})]`;
  return `[${documentTitle}]`;
}

export function toSourceReference(
  metadataValue: unknown,
  sourceId = "S1"
): SourceReference {
  const metadata = asMetadata(metadataValue);
  const rawTitle =
    readString(metadata, ["document_title", "title"]) ?? "Unknown Document";
  const documentTitle = cleanDocumentTitle(rawTitle);
  const section = getSection(metadata);
  const date = getDocumentDate(metadata);
  const documentUrl = readString(metadata, ["document_url", "url"]);
  const pageNumber = readNumber(metadata, ["page_number"]);

  return {
    sourceId,
    citation: formatSourceCitation(metadata),
    documentTitle,
    documentUrl,
    section,
    date,
    pageNumber,
  };
}

function toRetrievedChunk(row: MatchDocumentRow, index: number): RetrievedChunk {
  const metadata = asMetadata(row.metadata);
  const source = toSourceReference(metadata, `S${index + 1}`);

  return {
    id: row.id,
    chunkText: cleanLine(row.chunk_text, 1800),
    similarity: coerceSimilarity(row.similarity),
    metadata,
    source,
  };
}

export function buildContextDocuments(chunks: RetrievedChunk[]): Array<{
  sourceId: string;
  citation: string;
  excerpt: string;
  url?: string;
}> {
  return chunks.map((chunk, index) => ({
    sourceId: chunk.source.sourceId || `S${index + 1}`,
    citation: chunk.source.citation,
    excerpt: cleanLine(chunk.chunkText, 900),
    url: chunk.source.documentUrl,
  }));
}

const MAX_SOURCE_PILLS = 4;

export function dedupeSources(chunks: RetrievedChunk[]): SourceReference[] {
  const seen = new Map<string, SourceReference>();

  for (const chunk of chunks) {
    // Skip sources with generic/meaningless titles
    if (isGenericTitle(chunk.source.documentTitle)) continue;

    // Primary dedup key: cleaned document title (not URL)
    // This prevents "Frequently Asked Questions" from appearing 3x
    // when it comes from different CivicPlus URLs
    const key = chunk.source.documentTitle.toLowerCase().trim();

    if (!seen.has(key)) {
      seen.set(key, chunk.source);
    }
  }

  return Array.from(seen.values()).slice(0, MAX_SOURCE_PILLS);
}

// ---------------------------------------------------------------------------
// Fuzzy intent matching — detect common question patterns and add keywords
// ---------------------------------------------------------------------------

type IntentPattern = {
  /** Regex patterns that indicate this intent */
  patterns: RegExp[];
  /** Keywords to inject into the search query */
  keywords: string[];
};

const INTENT_PATTERNS: IntentPattern[] = [
  {
    patterns: [/when is .+ open/i, /hours for/i, /what time does/i, /what are .+ hours/i, /is .+ open/i],
    keywords: ["hours", "schedule", "open", "closed"],
  },
  {
    patterns: [/where is/i, /where do i/i, /how do i get to/i, /address for/i, /location of/i],
    keywords: ["address", "location", "directions"],
  },
  {
    patterns: [/who do i call/i, /who handles/i, /contact for/i, /phone number/i, /email for/i],
    keywords: ["department", "contact", "phone", "email"],
  },
  {
    patterns: [/how much does .+ cost/i, /what'?s the fee/i, /price of/i, /fee for/i],
    keywords: ["fee", "cost", "rate", "schedule"],
  },
  {
    patterns: [/do i need a permit/i, /can i build/i, /permit for/i, /permit to/i],
    keywords: ["permit", "application", "requirements", "zoning"],
  },
  {
    patterns: [/how do i/i, /what'?s the process/i, /steps to/i, /how to/i],
    keywords: ["application", "process", "steps", "requirements"],
  },
];

/**
 * Detect intent from a query and return additional keywords to inject.
 */
function detectIntent(query: string): string[] {
  const keywords = new Set<string>();
  const lowerQuery = query.toLowerCase();

  for (const intent of INTENT_PATTERNS) {
    if (intent.patterns.some((p) => p.test(lowerQuery))) {
      for (const kw of intent.keywords) {
        if (!lowerQuery.includes(kw)) {
          keywords.add(kw);
        }
      }
    }
  }

  return Array.from(keywords);
}

// Department keywords for routing
const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  "Building Department": ["permit", "building", "construction", "inspection", "renovation"],
  "Planning & Community Development": ["zoning", "variance", "planning", "development", "subdivision"],
  "DPW": ["transfer station", "trash", "recycling", "water", "sewer", "road"],
  "Schools": ["school", "enrollment", "education", "student", "bus", "kindergarten"],
  "Town Clerk": ["vote", "election", "dog license", "vital records", "marriage"],
  "Assessor": ["tax", "assessment", "property value", "exemption", "abatement"],
  "Police": ["police", "safety", "emergency", "report", "parking ban"],
  "Fire": ["fire", "emergency", "ambulance", "inspection"],
};

function detectDepartment(query: string): string | null {
  const lowerQuery = query.toLowerCase();

  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      return dept;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Cohere cross-encoder reranking (optional upgrade)
// ---------------------------------------------------------------------------

interface RerankResult {
  chunks: RetrievedChunk[];
  usedReranker: boolean;
  rerankerLatencyMs: number | null;
}

async function cohereRerank(
  query: string,
  chunks: RetrievedChunk[]
): Promise<RerankResult> {
  // If Cohere client not configured or no chunks, skip reranking
  if (!cohereClient || chunks.length === 0) {
    return { chunks, usedReranker: false, rerankerLatencyMs: null };
  }

  const startTime = performance.now();

  try {
    // Cohere rerank API expects documents as strings
    const documents = chunks.map((chunk) => chunk.chunkText);

    // Call Cohere Rerank v3.5 with 3-second timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 3000);

    const response = await cohereClient.v2.rerank({
      model: "rerank-v3.5",
      query,
      documents,
      topN: chunks.length, // Return all documents with scores
    });

    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);

    // Map Cohere results back to chunks with updated scores
    const rankedChunks = response.results.map((result) => {
      const chunk = chunks[result.index];
      return {
        ...chunk,
        cohereScore: result.relevanceScore,
      };
    });

    return {
      chunks: rankedChunks,
      usedReranker: true,
      rerankerLatencyMs: latencyMs,
    };
  } catch (error) {
    // Graceful fallback: if Cohere fails or times out, use original chunks
    console.warn("[rag] Cohere reranking failed, using formula reranking:", error);
    return {
      chunks,
      usedReranker: false,
      rerankerLatencyMs: null,
    };
  }
}

// Reranking: score chunks by multiple factors
// If config is provided, uses adjusted weights. Otherwise uses defaults.
// If chunks have cohereScore, blends it with the formula score.
function rerankChunks(
  chunks: RetrievedChunk[],
  query: string,
  detectedDepartment: string | null,
  config?: RetrievalConfig
): RetrievedChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 3);

  // Use config weights if provided, otherwise use defaults
  const recencyWeight = config?.recencyWeight ?? 0.1;
  const authorityWeight = config?.authorityWeight ?? 0.1;
  const sourceBoost = config?.sourceBoost ?? {};

  const scored = chunks.map(chunk => {
    const chunkLower = chunk.chunkText.toLowerCase();
    const metadata = chunk.metadata;

    // Check if this chunk has a Cohere score (from reranking)
    const hasCohereScore = chunk.cohereScore !== undefined;
    const cohereScore = chunk.cohereScore ?? 0;

    // Semantic similarity (0.6 weight)
    const semanticScore = chunk.similarity * 0.6;

    // Keyword overlap (0.2 weight)
    const matchedTerms = queryTerms.filter(term => chunkLower.includes(term)).length;
    const keywordScore = (matchedTerms / Math.max(queryTerms.length, 1)) * 0.2;

    // Document recency (configurable weight)
    let recencyScore = 0;
    const docDate = readString(metadata, ["document_date", "effective_date", "last_amended"]);
    if (docDate) {
      const year = parseInt(docDate.match(/\d{4}/)?.[0] ?? "0");
      if (year >= 2024) recencyScore = recencyWeight;
      else if (year >= 2020) recencyScore = recencyWeight * 0.7;
      else if (year >= 2015) recencyScore = recencyWeight * 0.4;
    }

    // Document authority (configurable weight)
    let authorityScore = 0;
    const docType = readString(metadata, ["document_type", "chunk_type"]);
    if (docType === "regulation" || docType === "bylaw") authorityScore = authorityWeight;
    else if (docType === "procedure" || docType === "meeting") authorityScore = authorityWeight * 0.7;
    else authorityScore = authorityWeight * 0.5;

    // Source boost (from config, replaces department boost)
    let sourceBoostScore = 0;
    const contentType = readString(metadata, ["content_type"]);
    if (contentType && sourceBoost[contentType as keyof typeof sourceBoost]) {
      sourceBoostScore = sourceBoost[contentType as keyof typeof sourceBoost] ?? 0;
    }
    // Fallback to department boost if no source boost
    if (sourceBoostScore === 0 && detectedDepartment) {
      const chunkDept = readString(metadata, ["department"]);
      if (chunkDept && chunkDept.toLowerCase().includes(detectedDepartment.toLowerCase())) {
        sourceBoostScore = 0.05;
      }
    }

    // Formula score (existing 5-factor formula with adjusted weights)
    const formulaScore = semanticScore + keywordScore + recencyScore + authorityScore + sourceBoostScore;

    // Blend Cohere score if available: 60% Cohere, 30% formula, 10% source boost
    const relevanceScore = hasCohereScore
      ? cohereScore * 0.6 + formulaScore * 0.3 + sourceBoostScore * 0.1
      : formulaScore;

    return {
      ...chunk,
      relevanceScore,
    };
  });

  // Sort by relevance score descending
  scored.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

  return scored;
}

// Select top chunks with a two-pass strategy:
//   Pass 1 — fill ~80% of slots with a per-doc cap to maintain diversity.
//   Pass 2 — fill remaining slots preferring *sibling* chunks (same
//            document_url, adjacent chunk_index) of already-selected chunks.
//            This ensures multi-section answers (e.g. "In Person" + "By Mail")
//            stay together. Falls back to next-best-ranked if no siblings.
const MAX_CHUNKS_PER_DOC = 3;

function selectTopChunks(
  chunks: RetrievedChunk[],
  maxCount: number,
  config?: RetrievalConfig
): RetrievedChunk[] {
  // Check if sibling expansion is enabled (default: true for backward compatibility)
  const expandSiblings = config?.expandSiblings ?? true;

  if (!expandSiblings) {
    // Simple selection: just take top N chunks by score
    return chunks.slice(0, maxCount);
  }

  // Otherwise, use the two-pass sibling expansion strategy
  const primaryCount = Math.ceil(maxCount * 0.8); // e.g. 8 of 10

  // --- Pass 1: primary selection with per-doc cap ---
  const selected: RetrievedChunk[] = [];
  const docCounts = new Map<string, number>();

  for (const chunk of chunks) {
    if (selected.length >= primaryCount) break;
    const docTitle = readString(chunk.metadata, ["document_title", "title"]) ?? "";
    const count = docCounts.get(docTitle) ?? 0;
    if (count < MAX_CHUNKS_PER_DOC) {
      selected.push(chunk);
      docCounts.set(docTitle, count + 1);
    }
  }

  if (selected.length >= maxCount) return selected.slice(0, maxCount);

  // --- Pass 2: sibling expansion ---
  // Build an index of document_url → Set<chunk_index> for selected chunks
  const selectedIds = new Set(selected.map((c) => c.id));
  const docChunkIndices = new Map<string, Set<number>>();

  for (const chunk of selected) {
    const url = readString(chunk.metadata, ["document_url", "url"]) ?? "";
    const idx = readNumber(chunk.metadata, ["chunk_index"]);
    if (url && idx !== undefined) {
      if (!docChunkIndices.has(url)) docChunkIndices.set(url, new Set());
      docChunkIndices.get(url)!.add(idx);
    }
  }

  // Partition remaining candidates into siblings vs others
  const siblings: RetrievedChunk[] = [];
  const others: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    if (selectedIds.has(chunk.id)) continue;
    const url = readString(chunk.metadata, ["document_url", "url"]) ?? "";
    const idx = readNumber(chunk.metadata, ["chunk_index"]);
    const docIndices = url ? docChunkIndices.get(url) : undefined;

    if (docIndices && idx !== undefined) {
      const isAdjacent = Array.from(docIndices).some((si) => Math.abs(idx - si) <= 1);
      if (isAdjacent) {
        siblings.push(chunk);
        continue;
      }
    }
    others.push(chunk);
  }

  // Fill remaining slots: siblings first, then next-best-ranked
  for (const chunk of [...siblings, ...others]) {
    if (selected.length >= maxCount) break;
    selected.push(chunk);
  }

  return selected;
}

/**
 * Run a vector search against content_items (external news, RSS, etc.)
 * and transform results to MatchDocumentRow shape for merging.
 */
async function vectorSearchContentItems(
  queryText: string,
  townId: string,
  matchThreshold: number,
  matchCount: number,
): Promise<MatchDocumentRow[]> {
  const embedding = await generateEmbedding(queryText);
  const supabase = getSupabaseClient({ townId });

  const { data, error } = await supabase.rpc("match_content_items", {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_town_id: townId,
  });

  if (error) {
    // Non-fatal — content_items search is supplementary
    console.warn(`[rag] content_items search failed: ${error.message}`);
    return [];
  }

  // Transform content_items results to MatchDocumentRow shape
  return ((data ?? []) as Array<{
    id: string;
    title: string;
    content: string;
    summary: string | null;
    url: string | null;
    source_id: string;
    category: string;
    published_at: string;
    metadata: ChunkMetadata | null;
    similarity: number;
  }>).map((row) => ({
    id: row.id,
    chunk_text: row.summary || row.content?.slice(0, 1500) || row.title,
    metadata: {
      ...(row.metadata ?? {}),
      document_title: row.title,
      document_url: row.url,
      content_type: "external_news",
      source_id: row.source_id,
      category: row.category,
      published_at: row.published_at,
    },
    // Apply 0.95x penalty so official municipal content ranks above news at similar scores
    similarity: row.similarity * 0.95,
  }));
}

/**
 * Run a single vector search against Supabase match_documents RPC.
 */
async function vectorSearch(
  queryText: string,
  townId: string,
  matchThreshold: number,
  matchCount: number,
): Promise<MatchDocumentRow[]> {
  const embedding = await generateEmbedding(queryText);
  const supabase = getSupabaseClient({ townId });

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_town_id: townId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Failed to retrieve semantic matches: ${error.message}`);
  }

  return (data ?? []) as MatchDocumentRow[];
}

export async function retrieveRelevantChunks(
  query: string,
  options?: {
    townId?: string;
    matchThreshold?: number;
    matchCount?: number;
    finalCount?: number;
    config?: RetrievalConfig; // Optional retrieval config from query router
  }
): Promise<RetrievedChunk[]> {
  const townId = options?.townId ?? DEFAULT_TOWN_ID;
  const config = options?.config;

  // Use config values if provided, otherwise fall back to options or defaults
  const matchThreshold = config?.similarityThreshold ?? options?.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
  const matchCount = options?.matchCount ?? DEFAULT_MATCH_COUNT;
  const finalCount = config?.resultCount ?? options?.finalCount ?? DEFAULT_FINAL_COUNT;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  // Step 1: Synonym expansion
  const { expanded, expandedQuery } = expandQuery(trimmedQuery, townId);

  // Step 2: Intent detection — add intent keywords to the expanded query
  const intentKeywords = detectIntent(trimmedQuery);
  const fullExpandedQuery =
    intentKeywords.length > 0
      ? `${expandedQuery} ${intentKeywords.join(" ")}`
      : expandedQuery;

  // Step 3: Detect department for reranking (use expanded terms for better detection)
  const detectedDepartment = detectDepartment(fullExpandedQuery);

  // Step 4: LLM query rewriting (runs in parallel with vector searches)
  // This catches queries the synonym dictionary can't handle
  const rewrittenQueryPromise = rewriteQuery(trimmedQuery, townId);

  // Step 5: Run vector searches in parallel — original + expanded + LLM-rewritten
  const hasExpansions = expanded.length > 0 || intentKeywords.length > 0;

  const searchPromises: Promise<MatchDocumentRow[]>[] = [
    vectorSearch(trimmedQuery, townId, matchThreshold, matchCount),
    // Search external content (RSS, news) in parallel
    vectorSearchContentItems(trimmedQuery, townId, matchThreshold, Math.ceil(matchCount / 2)),
  ];

  if (hasExpansions) {
    searchPromises.push(
      vectorSearch(fullExpandedQuery, townId, matchThreshold, matchCount),
    );
  }

  // Wait for the LLM rewrite, then add a third search if it produced something
  const rewrittenQuery = await rewrittenQueryPromise;
  if (rewrittenQuery) {
    searchPromises.push(
      vectorSearch(rewrittenQuery, townId, matchThreshold, matchCount),
    );

    // Track query rewrites for analytics (non-blocking, fire-and-forget)
    try {
      trackEvent("query_rewritten", {
        original_length: trimmedQuery.length,
        rewritten_length: rewrittenQuery.length,
        had_synonyms: expanded.length > 0,
        had_intents: intentKeywords.length > 0,
      });
    } catch {
      // Non-critical — don't let tracking failures affect search
    }
  }

  const searchResults = await Promise.all(searchPromises);

  // Step 6: Merge and deduplicate, keeping the highest similarity per chunk
  const bestByChunkId = new Map<string, MatchDocumentRow>();

  for (const rows of searchResults) {
    for (const row of rows) {
      const existing = bestByChunkId.get(row.id);
      const sim = coerceSimilarity(row.similarity);
      if (!existing || coerceSimilarity(existing.similarity) < sim) {
        bestByChunkId.set(row.id, row);
      }
    }
  }

  const mergedRows = Array.from(bestByChunkId.values());
  const allChunks = mergedRows.map((row, index) => toRetrievedChunk(row, index));

  // Filter out noise — chunks below the similarity floor are irrelevant
  const chunks = allChunks.filter((c) => c.similarity >= MIN_SIMILARITY_FLOOR);

  // Log filtered-out chunks in development for debugging
  if (process.env.NODE_ENV === "development") {
    const filteredOut = allChunks.filter((c) => c.similarity < MIN_SIMILARITY_FLOOR);
    if (filteredOut.length > 0) {
      console.log(
        `[rag] Filtered ${filteredOut.length} low-relevance chunks (similarity < ${MIN_SIMILARITY_FLOOR}):`,
        filteredOut.map((c) => ({
          id: c.id,
          similarity: c.similarity.toFixed(3),
          title: c.source.documentTitle,
        }))
      );
    }
  }

  // Step 7: Cohere cross-encoder reranking (optional upgrade)
  const { chunks: cohereRanked, usedReranker, rerankerLatencyMs } = await cohereRerank(
    fullExpandedQuery,
    chunks
  );

  // Log reranker usage for telemetry
  if (usedReranker) {
    try {
      trackEvent("reranker_used", {
        latency_ms: rerankerLatencyMs,
        chunk_count: chunks.length,
      });
    } catch {
      // Non-critical — don't let tracking failures affect search
    }
  }

  // Step 8: Formula-based reranking (blends with Cohere if available)
  const reranked = rerankChunks(cohereRanked, fullExpandedQuery, detectedDepartment, config);

  // Step 9: Select top chunks by reranked score (with optional sibling expansion)
  const diverse = selectTopChunks(reranked, finalCount, config);

  return diverse;
}

export async function textSearchChunks(
  query: string,
  options?: {
    townId?: string;
    limit?: number;
  }
): Promise<TextSearchRow[]> {
  const townId = options?.townId ?? DEFAULT_TOWN_ID;
  const limit = options?.limit ?? 10;
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const supabase = getSupabaseClient({ townId });
  const { data, error } = await supabase
    .from("document_chunks")
    .select("id, chunk_text, metadata")
    .eq("town_id", townId)
    .textSearch("chunk_text", trimmedQuery, {
      type: "websearch",
      config: "english",
    })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to retrieve full-text matches: ${error.message}`);
  }

  return (data ?? []) as TextSearchRow[];
}

export function buildHighlight(chunkText: string, query: string): string {
  const normalized = chunkText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\w]/g, ""))
    .filter((term) => term.length >= 3);

  const firstTerm = terms[0];
  if (!firstTerm) {
    return cleanLine(normalized, 220);
  }

  const lowerText = normalized.toLowerCase();
  const position = lowerText.indexOf(firstTerm);

  if (position === -1) {
    return cleanLine(normalized, 220);
  }

  const start = Math.max(0, position - 70);
  const end = Math.min(normalized.length, position + 150);
  const snippet = normalized.slice(start, end).trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";

  return cleanLine(`${prefix}${snippet}${suffix}`, 240);
}

function normalizeSimilarity(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * Truncate text to a max length, breaking at word boundary.
 */
export function truncateSnippet(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

export async function hybridSearch(
  query: string,
  options?: {
    townId?: string;
    limit?: number;
  }
): Promise<HybridSearchResult[]> {
  const townId = options?.townId ?? DEFAULT_TOWN_ID;
  const limit = options?.limit ?? 15;

  const [semanticMatches, textMatches] = await Promise.all([
    retrieveRelevantChunks(query, {
      townId,
      matchThreshold: 0.45,
      matchCount: Math.max(limit * 2, 12),
    }),
    textSearchChunks(query, { townId, limit: Math.max(limit * 2, 12) }),
  ]);

  const merged = new Map<
    string,
    {
      chunkText: string;
      metadata: ChunkMetadata;
      source: SourceReference;
      similarity: number;
      textRank: number;
    }
  >();

  semanticMatches.forEach((chunk) => {
    merged.set(chunk.id, {
      chunkText: chunk.chunkText,
      metadata: chunk.metadata,
      source: chunk.source,
      similarity: normalizeSimilarity(chunk.similarity),
      textRank: 0,
    });
  });

  const maxTextRankDivisor = Math.max(textMatches.length, 1);
  textMatches.forEach((chunk, index) => {
    const metadata = asMetadata(chunk.metadata);
    const existing = merged.get(chunk.id);
    const textRank = (maxTextRankDivisor - index) / maxTextRankDivisor;

    if (existing) {
      existing.textRank = Math.max(existing.textRank, textRank);
      return;
    }

    merged.set(chunk.id, {
      chunkText: cleanLine(chunk.chunk_text, 1800),
      metadata,
      source: toSourceReference(metadata),
      similarity: 0,
      textRank,
    });
  });

  const semanticWeight = 0.7;
  const textWeight = 0.3;

  const ranked = Array.from(merged.entries()).map(([id, value]) => {
    const score = value.similarity * semanticWeight + value.textRank * textWeight;
    return {
      id,
      chunk_text: value.chunkText,
      metadata: value.metadata,
      source: value.source,
      similarity: value.similarity,
      text_rank: value.textRank,
      score: Number(score.toFixed(4)),
      highlight: buildHighlight(value.chunkText, query),
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
