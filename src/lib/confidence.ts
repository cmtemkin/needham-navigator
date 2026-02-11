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

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function scoreConfidence(similarities: number[]): ConfidenceScore {
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

  if (topSimilarity >= HIGH_THRESHOLD && validScores.length >= HIGH_MIN_CHUNKS) {
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
  chunks: Array<{ similarity?: number | null }>
): ConfidenceScore {
  const similarities = chunks
    .map((chunk) => (typeof chunk.similarity === "number" ? chunk.similarity : -1))
    .filter((value) => value >= 0);

  return scoreConfidence(similarities);
}
