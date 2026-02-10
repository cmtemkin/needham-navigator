import { generateEmbedding } from "@/lib/embeddings";
import { getSupabaseClient } from "@/lib/supabase";

export const DEFAULT_TOWN_ID = "needham";

const DEFAULT_MATCH_THRESHOLD = 0.7;
const DEFAULT_MATCH_COUNT = 8;

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

export async function retrieveRelevantChunks(
  query: string,
  options?: {
    townId?: string;
    matchThreshold?: number;
    matchCount?: number;
  }
): Promise<RetrievedChunk[]> {
  const townId = options?.townId ?? DEFAULT_TOWN_ID;
  const matchThreshold = options?.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
  const matchCount = options?.matchCount ?? DEFAULT_MATCH_COUNT;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const embedding = await generateEmbedding(trimmedQuery);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_town_id: townId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Failed to retrieve semantic matches: ${error.message}`);
  }

  const rows = (data ?? []) as MatchDocumentRow[];
  return rows.map((row, index) => toRetrievedChunk(row, index));
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

  const supabase = getSupabaseClient();
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
