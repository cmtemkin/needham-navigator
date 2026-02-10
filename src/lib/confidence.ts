export type ConfidenceLevel = "high" | "medium" | "low";
export type ConfidenceColor = "green" | "yellow" | "orange";

export type ConfidenceScore = {
  level: ConfidenceLevel;
  label: string;
  color: ConfidenceColor;
  averageSimilarity: number;
  supportingChunks: number;
  reason: string;
};

const HIGH_THRESHOLD = 0.85;
const MEDIUM_THRESHOLD = 0.7;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function scoreConfidence(similarities: number[]): ConfidenceScore {
  if (similarities.length === 0) {
    return {
      level: "low",
      label: "Low Confidence",
      color: "orange",
      averageSimilarity: 0,
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
      label: "Low Confidence",
      color: "orange",
      averageSimilarity: 0,
      supportingChunks: 0,
      reason: "Similarity scores were unavailable for retrieved documents.",
    };
  }

  const averageSimilarity =
    validScores.reduce((sum, value) => sum + value, 0) / validScores.length;
  const roundedAverage = roundTo(averageSimilarity, 3);

  if (roundedAverage > HIGH_THRESHOLD && validScores.length >= 2) {
    return {
      level: "high",
      label: "High Confidence",
      color: "green",
      averageSimilarity: roundedAverage,
      supportingChunks: validScores.length,
      reason:
        "Multiple supporting chunks have strong semantic similarity (> 0.85).",
    };
  }

  if (roundedAverage >= MEDIUM_THRESHOLD || validScores.length === 1) {
    return {
      level: "medium",
      label: "Medium Confidence",
      color: "yellow",
      averageSimilarity: roundedAverage,
      supportingChunks: validScores.length,
      reason:
        "Some relevant supporting context was found, but verification may still be needed.",
    };
  }

  return {
    level: "low",
    label: "Low Confidence",
    color: "orange",
    averageSimilarity: roundedAverage,
    supportingChunks: validScores.length,
    reason:
      "Matches were weak (< 0.70 similarity) or not sufficiently corroborated.",
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
