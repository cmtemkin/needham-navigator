/**
 * Admin search stats endpoint — server-side search quality analytics
 *
 * Returns aggregate statistics from the search_telemetry table:
 * - Total searches (24h, 7d, 30d)
 * - Breakdown by intent
 * - Decomposition rate (% of queries that were complex)
 * - Average latency (with and without reranker)
 * - Queries with 0 results (the failures to investigate)
 * - Source type distribution in results
 */

import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase";

type TelemetryRow = {
  was_decomposed: boolean;
  sub_query_count: number;
  intents: string[] | null;
  source_hints: string[] | null;
  result_count: number | null;
  used_reranker: boolean;
  reranker_latency_ms: number | null;
  total_latency_ms: number | null;
  confidence: string | null;
  created_at: string;
};

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  const supabase = getSupabaseServiceClient();

  try {
    // Fetch all telemetry rows (last 30 days is enough for stats)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from("search_telemetry")
      .select("*")
      .eq("town", townId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as TelemetryRow[];

    // Compute time buckets
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last24h = rows.filter((r) => new Date(r.created_at) >= oneDayAgo);
    const last7d = rows.filter((r) => new Date(r.created_at) >= sevenDaysAgo);
    const last30d = rows;

    // Decomposition rate
    const decomposedCount = rows.filter((r) => r.was_decomposed).length;
    const decompositionRate = rows.length > 0 ? decomposedCount / rows.length : 0;

    // Intent breakdown
    const intentCounts: Record<string, number> = {};
    for (const row of rows) {
      if (row.intents && Array.isArray(row.intents)) {
        for (const intent of row.intents) {
          intentCounts[intent] = (intentCounts[intent] ?? 0) + 1;
        }
      }
    }

    // Source type breakdown
    const sourceTypeCounts: Record<string, number> = {};
    for (const row of rows) {
      if (row.source_hints && Array.isArray(row.source_hints)) {
        for (const source of row.source_hints) {
          sourceTypeCounts[source] = (sourceTypeCounts[source] ?? 0) + 1;
        }
      }
    }

    // Latency stats
    const latencies = rows
      .filter((r) => r.total_latency_ms !== null)
      .map((r) => r.total_latency_ms!);
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : null;

    const rerankerLatencies = rows
      .filter((r) => r.used_reranker && r.reranker_latency_ms !== null)
      .map((r) => r.reranker_latency_ms!);
    const avgRerankerLatency =
      rerankerLatencies.length > 0
        ? rerankerLatencies.reduce((sum, l) => sum + l, 0) / rerankerLatencies.length
        : null;

    const rerankerUsageRate = rows.length > 0
      ? rows.filter((r) => r.used_reranker).length / rows.length
      : 0;

    // Zero-result queries (failures)
    const zeroResultQueries = rows.filter((r) => r.result_count === 0);

    // Confidence distribution
    const confidenceCounts = {
      high: rows.filter((r) => r.confidence === "high").length,
      medium: rows.filter((r) => r.confidence === "medium").length,
      low: rows.filter((r) => r.confidence === "low").length,
    };

    return Response.json({
      total_searches: {
        last_24h: last24h.length,
        last_7d: last7d.length,
        last_30d: last30d.length,
      },
      decomposition: {
        rate: decompositionRate,
        total_decomposed: decomposedCount,
        total_simple: rows.length - decomposedCount,
      },
      intents: Object.entries(intentCounts)
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count),
      source_types: Object.entries(sourceTypeCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      latency: {
        avg_total_ms: avgLatency,
        avg_reranker_ms: avgRerankerLatency,
        reranker_usage_rate: rerankerUsageRate,
      },
      confidence: confidenceCounts,
      failures: {
        zero_results: zeroResultQueries.length,
        zero_results_rate: rows.length > 0 ? zeroResultQueries.length / rows.length : 0,
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected search stats error.";
    return Response.json(
      { error: "Unable to load search stats right now.", details },
      { status: 500 }
    );
  }
}
