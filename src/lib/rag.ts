import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID as DEFAULT_TOWN_ID_FROM_CONFIG } from "@/lib/towns";
import { expandQuery } from "@/lib/synonyms";

export const DEFAULT_TOWN_ID = DEFAULT_TOWN_ID_FROM_CONFIG;

const DEFAULT_MATCH_THRESHOLD = 0.7;
const DEFAULT_MATCH_COUNT = 20; // Retrieve more for reranking
const DEFAULT_FINAL_COUNT = 8; // Final chunks to return after reranking

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
  const documentTitle =
    readString(metadata, ["document_title", "title"]) ?? "Unknown Document";
  const section = getSection(metadata) ?? "Section n/a";
  const date = getDocumentDate(metadata) ?? "Unknown date";

  return `[${documentTitle}, ${section} (${date})]`;
}

export function toSourceReference(
  metadataValue: unknown,
  sourceId = "S1"
): SourceReference {
  const metadata = asMetadata(metadataValue);
  const documentTitle =
    readString(metadata, ["document_title", "title"]) ?? "Unknown Document";
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

export function dedupeSources(chunks: RetrievedChunk[]): SourceReference[] {
  const seen = new Map<string, SourceReference>();

  for (const chunk of chunks) {
    const key = `${chunk.source.citation}|${chunk.source.documentUrl ?? ""}`;
    if (!seen.has(key)) {
      seen.set(key, chunk.source);
    }
  }

  return Array.from(seen.values());
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

// Reranking: score chunks by multiple factors
function rerankChunks(
  chunks: RetrievedChunk[],
  query: string,
  detectedDepartment: string | null
): RetrievedChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length >= 3);

  const scored = chunks.map(chunk => {
    const chunkLower = chunk.chunkText.toLowerCase();
    const metadata = chunk.metadata;

    // Semantic similarity (0.6 weight)
    const semanticScore = chunk.similarity * 0.6;

    // Keyword overlap (0.2 weight)
    const matchedTerms = queryTerms.filter(term => chunkLower.includes(term)).length;
    const keywordScore = (matchedTerms / Math.max(queryTerms.length, 1)) * 0.2;

    // Document recency (0.1 weight)
    let recencyScore = 0;
    const docDate = readString(metadata, ["document_date", "effective_date", "last_amended"]);
    if (docDate) {
      const year = parseInt(docDate.match(/\d{4}/)?.[0] ?? "0");
      if (year >= 2024) recencyScore = 0.1;
      else if (year >= 2020) recencyScore = 0.07;
      else if (year >= 2015) recencyScore = 0.04;
    }

    // Document authority (0.1 weight)
    let authorityScore = 0;
    const docType = readString(metadata, ["document_type", "chunk_type"]);
    if (docType === "regulation" || docType === "bylaw") authorityScore = 0.1;
    else if (docType === "procedure" || docType === "meeting") authorityScore = 0.07;
    else authorityScore = 0.05;

    // Department boost
    let deptBoost = 0;
    if (detectedDepartment) {
      const chunkDept = readString(metadata, ["department"]);
      if (chunkDept && chunkDept.toLowerCase().includes(detectedDepartment.toLowerCase())) {
        deptBoost = 0.15;
      }
    }

    const relevanceScore = semanticScore + keywordScore + recencyScore + authorityScore + deptBoost;

    return {
      ...chunk,
      relevanceScore,
    };
  });

  // Sort by relevance score descending
  scored.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

  return scored;
}

// Ensure diversity of sources in final selection
function selectDiverseChunks(chunks: RetrievedChunk[], maxCount: number): RetrievedChunk[] {
  const selected: RetrievedChunk[] = [];
  const seenDocs = new Set<string>();

  // First pass: one chunk per unique document
  for (const chunk of chunks) {
    const docTitle = readString(chunk.metadata, ["document_title", "title"]) ?? "";
    if (!seenDocs.has(docTitle) && selected.length < maxCount) {
      selected.push(chunk);
      seenDocs.add(docTitle);
    }
  }

  // Second pass: fill remaining slots with highest scored chunks
  for (const chunk of chunks) {
    if (selected.length >= maxCount) break;
    if (!selected.includes(chunk)) {
      selected.push(chunk);
    }
  }

  return selected;
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
  }
): Promise<RetrievedChunk[]> {
  const townId = options?.townId ?? DEFAULT_TOWN_ID;
  const matchThreshold = options?.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
  const matchCount = options?.matchCount ?? DEFAULT_MATCH_COUNT;
  const finalCount = options?.finalCount ?? DEFAULT_FINAL_COUNT;

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

  // Step 4: Run vector searches in parallel — original query + expanded query
  const hasExpansions = expanded.length > 0 || intentKeywords.length > 0;

  const searchPromises: Promise<MatchDocumentRow[]>[] = [
    vectorSearch(trimmedQuery, townId, matchThreshold, matchCount),
  ];

  if (hasExpansions) {
    searchPromises.push(
      vectorSearch(fullExpandedQuery, townId, matchThreshold, matchCount),
    );
  }

  const searchResults = await Promise.all(searchPromises);

  // Step 5: Merge and deduplicate, keeping the highest similarity per chunk
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
  const chunks = mergedRows.map((row, index) => toRetrievedChunk(row, index));

  // Step 6: Rerank using the full expanded query for better keyword overlap scoring
  const reranked = rerankChunks(chunks, fullExpandedQuery, detectedDepartment);

  // Step 7: Select diverse chunks
  const diverse = selectDiverseChunks(reranked, finalCount);

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
