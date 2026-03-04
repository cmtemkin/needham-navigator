export type ConfidenceLevel = "high" | "medium" | "low";
export type ConfidenceColor = "green" | "yellow" | "orange";

export type ConfidenceScore = {
  level: ConfidenceLevel;
  label: string;
  color: ConfidenceColor;
  averageSimilarity: number;
  topSimilarity: number;
  supportingChunks: number;
  reason: string;
};

// Configurable thresholds — tune based on data quality.
// Current crawled data has boilerplate diluting scores, so 0.60 is realistic for "high".
const HIGH_THRESHOLD = parseFloat(process.env.CONFIDENCE_HIGH_THRESHOLD ?? "0.60");
const MEDIUM_THRESHOLD = parseFloat(process.env.CONFIDENCE_MEDIUM_THRESHOLD ?? "0.40");
const HIGH_MIN_CHUNKS = 2;

// Keyword overlap thresholds — catches nonsense queries that get high embedding
// similarity but share no actual words with retrieved chunks.
const KEYWORD_OVERLAP_HIGH_FLOOR = 0.2;  // At least 20% of terms for HIGH
const KEYWORD_OVERLAP_LOW_FLOOR = 0.1;   // Below 10% → downgrade MEDIUM to LOW

const OVERLAP_STOPWORDS = new Set([
  "what", "where", "when", "how", "who", "which", "why",
  "is", "are", "was", "were", "be", "been", "being",
  "the", "a", "an", "this", "that", "these", "those",
  "do", "does", "did", "will", "would", "could", "should", "can", "may",
  "i", "my", "me", "you", "your", "we", "our", "they", "their",
  "to", "for", "of", "in", "on", "at", "about", "with", "from", "by",
  "and", "or", "but", "not", "no", "if", "so", "too", "very",
  "it", "its", "has", "have", "had", "get", "got",
  "need", "know", "tell", "much", "many", "some", "any",
]);

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Compute keyword overlap between a query and chunk texts.
 * Returns the fraction (0..1) of meaningful query terms that appear
 * in at least one chunk. Returns undefined when no meaningful terms
 * exist (e.g. stopword-only queries), so the caller can skip the check.
 */
export function computeKeywordOverlap(
  query: string,
  chunkTexts: string[],
): number | undefined {
  const queryTerms = query
    .toLowerCase()
    .replaceAll(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !OVERLAP_STOPWORDS.has(t));

  if (queryTerms.length === 0) return undefined;

  const combined = chunkTexts.join(" ").toLowerCase();
  const matched = queryTerms.filter((term) => combined.includes(term));

  return matched.length / queryTerms.length;
}

export function scoreConfidence(
  similarities: number[],
  keywordOverlap?: number,
): ConfidenceScore {
  if (similarities.length === 0) {
    return {
      level: "low",
      label: "Limited information — contact the department directly",
      color: "orange",
      averageSimilarity: 0,
      topSimilarity: 0,
      supportingChunks: 0,
      reason: "No supporting documents were retrieved.",
    };
  }

  const validScores = similarities.filter(
    (value) => Number.isFinite(value) && value >= 0
  );

  if (validScores.length === 0) {
    return {
      level: "low",
      label: "Limited information — contact the department directly",
      color: "orange",
      averageSimilarity: 0,
      topSimilarity: 0,
      supportingChunks: 0,
      reason: "Similarity scores were unavailable for retrieved documents.",
    };
  }

  const averageSimilarity =
    validScores.reduce((sum, value) => sum + value, 0) / validScores.length;
  const roundedAverage = roundTo(averageSimilarity, 3);
  const topSimilarity = roundTo(Math.max(...validScores), 3);

  const hasLowOverlap =
    keywordOverlap !== undefined && keywordOverlap < KEYWORD_OVERLAP_HIGH_FLOOR;

  if (topSimilarity >= HIGH_THRESHOLD && validScores.length >= HIGH_MIN_CHUNKS) {
    // Downgrade HIGH → MEDIUM when keyword overlap is suspiciously low
    if (hasLowOverlap) {
      return {
        level: "medium",
        label: "Based on town documents — verify for important decisions",
        color: "yellow",
        averageSimilarity: roundedAverage,
        topSimilarity,
        supportingChunks: validScores.length,
        reason: `Top match similarity ${topSimilarity} but low keyword overlap (${roundTo(keywordOverlap ?? 0, 2)}). Downgraded from high.`,
      };
    }

    return {
      level: "high",
      label: "Verified from official sources",
      color: "green",
      averageSimilarity: roundedAverage,
      topSimilarity,
      supportingChunks: validScores.length,
      reason: `Top match similarity ${topSimilarity} with ${validScores.length} supporting chunks.`,
    };
  }

  if (topSimilarity >= MEDIUM_THRESHOLD || validScores.length === 1) {
    // Downgrade MEDIUM → LOW when keyword overlap is near zero
    if (keywordOverlap !== undefined && keywordOverlap < KEYWORD_OVERLAP_LOW_FLOOR) {
      return {
        level: "low",
        label: "Limited information — contact the department directly",
        color: "orange",
        averageSimilarity: roundedAverage,
        topSimilarity,
        supportingChunks: validScores.length,
        reason: `Top match similarity ${topSimilarity} but near-zero keyword overlap (${roundTo(keywordOverlap, 2)}).`,
      };
    }

    return {
      level: "medium",
      label: "Based on town documents — verify for important decisions",
      color: "yellow",
      averageSimilarity: roundedAverage,
      topSimilarity,
      supportingChunks: validScores.length,
      reason: `Top match similarity ${topSimilarity}. Verification recommended.`,
    };
  }

  return {
    level: "low",
    label: "Limited information — contact the department directly",
    color: "orange",
    averageSimilarity: roundedAverage,
    topSimilarity,
    supportingChunks: validScores.length,
    reason: `Top match similarity ${topSimilarity} is below ${MEDIUM_THRESHOLD}.`,
  };
}

export function scoreConfidenceFromChunks(
  chunks: Array<{ similarity?: number | null; chunkText?: string }>,
  query?: string,
): ConfidenceScore {
  const similarities = chunks
    .map((chunk) => (typeof chunk.similarity === "number" ? chunk.similarity : -1))
    .filter((value) => value >= 0);

  let keywordOverlap: number | undefined;
  if (query) {
    const chunkTexts = chunks
      .map((c) => c.chunkText ?? "")
      .filter((t) => t.length > 0);
    keywordOverlap = computeKeywordOverlap(query, chunkTexts);
  }

  return scoreConfidence(similarities, keywordOverlap);
}
