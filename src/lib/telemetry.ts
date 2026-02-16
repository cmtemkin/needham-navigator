/**
 * src/lib/telemetry.ts — Search quality telemetry logging
 *
 * Logs search quality metrics to the search_telemetry table for monitoring
 * RAG pipeline performance, query patterns, and retrieval quality.
 */

import { getSupabaseServiceClient } from "@/lib/supabase";

export interface SearchTelemetry {
  query: string;
  wasDecomposed?: boolean;
  subQueryCount?: number;
  intents?: string[];
  sourceHints?: string[];
  resultCount: number;
  topSimilarity?: number;
  avgSimilarity?: number;
  usedReranker?: boolean;
  rerankerLatencyMs?: number | null;
  totalLatencyMs: number;
  hadAiAnswer?: boolean;
  confidence?: "high" | "medium" | "low";
  town?: string;
}

/**
 * Log search telemetry asynchronously (non-blocking, fire-and-forget).
 * Failures are logged but don't affect the search response.
 */
export async function logSearchTelemetry(data: SearchTelemetry): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();

    // Compute confidence level from similarity scores
    let confidence: "high" | "medium" | "low" = "low";
    if (data.topSimilarity) {
      if (data.topSimilarity >= 0.75) confidence = "high";
      else if (data.topSimilarity >= 0.55) confidence = "medium";
    }

    await supabase.from("search_telemetry").insert({
      query: data.query,
      was_decomposed: data.wasDecomposed ?? false,
      sub_query_count: data.subQueryCount ?? 1,
      intents: data.intents ?? null,
      source_hints: data.sourceHints ?? null,
      result_count: data.resultCount,
      top_similarity: data.topSimilarity ?? null,
      avg_similarity: data.avgSimilarity ?? null,
      used_reranker: data.usedReranker ?? false,
      reranker_latency_ms: data.rerankerLatencyMs ?? null,
      total_latency_ms: data.totalLatencyMs,
      had_ai_answer: data.hadAiAnswer ?? false,
      confidence: data.confidence ?? confidence,
      town: data.town ?? "needham",
    });
  } catch (error) {
    // Non-critical — log error but don't throw
    console.warn("[telemetry] Failed to log search telemetry:", error);
  }
}
