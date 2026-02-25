/**
 * Admin stats endpoint — combined search analytics + content quality data
 *
 * Returns:
 * - Search KPIs: total queries, avg latency, zero-result rate, avg confidence
 * - Top 20 queries by frequency with avg similarity and latency
 * - Zero-result queries (content gaps)
 * - Confidence distribution (high/medium/low)
 * - Content stats: documents by domain, stale documents, freshness distribution
 */

import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase";

interface TelemetryRow {
  query: string;
  result_count: number | null;
  top_similarity: number | null;
  avg_similarity: number | null;
  total_latency_ms: number | null;
  confidence: string | null;
  had_ai_answer: boolean | null;
}

interface DocumentRow {
  id: string;
  url: string;
  title: string;
  is_stale: boolean;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

function computeSearchKPIs(telemetry: TelemetryRow[]) {
  const totalQueries = telemetry.length;

  const latencies = telemetry
    .filter((r) => r.total_latency_ms !== null)
    .map((r) => r.total_latency_ms!);
  const avgLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length)
      : 0;

  const zeroResultCount = telemetry.filter((r) => r.result_count === 0).length;
  const zeroResultRate =
    totalQueries > 0 ? Math.round((zeroResultCount / totalQueries) * 1000) / 10 : 0;

  const similarities = telemetry
    .filter((r) => r.top_similarity !== null)
    .map((r) => r.top_similarity!);
  const avgConfidence =
    similarities.length > 0
      ? Math.round((similarities.reduce((sum, s) => sum + s, 0) / similarities.length) * 1000) / 1000
      : 0;

  const confidenceDistribution = {
    high: telemetry.filter((r) => r.confidence === "high").length,
    medium: telemetry.filter((r) => r.confidence === "medium").length,
    low: telemetry.filter((r) => r.confidence === "low").length,
  };

  return {
    kpis: {
      total_queries: totalQueries,
      avg_latency_ms: avgLatency,
      zero_result_rate: zeroResultRate,
      avg_confidence: avgConfidence,
    },
    confidence_distribution: confidenceDistribution,
  };
}

function computeTopQueries(telemetry: TelemetryRow[]) {
  const queryMap = new Map<string, { count: number; totalSim: number; simCount: number; totalLatency: number; latencyCount: number }>();
  for (const row of telemetry) {
    const q = row.query?.toLowerCase().trim();
    if (!q) continue;
    const entry = queryMap.get(q) ?? { count: 0, totalSim: 0, simCount: 0, totalLatency: 0, latencyCount: 0 };
    entry.count++;
    if (row.top_similarity !== null) {
      entry.totalSim += row.top_similarity;
      entry.simCount++;
    }
    if (row.total_latency_ms !== null) {
      entry.totalLatency += row.total_latency_ms;
      entry.latencyCount++;
    }
    queryMap.set(q, entry);
  }

  return Array.from(queryMap.entries())
    .map(([query, stats]) => ({
      query,
      count: stats.count,
      avg_similarity: stats.simCount > 0 ? Math.round((stats.totalSim / stats.simCount) * 1000) / 1000 : null,
      avg_latency: stats.latencyCount > 0 ? Math.round(stats.totalLatency / stats.latencyCount) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function computeZeroResultQueries(telemetry: TelemetryRow[]) {
  const zeroResultMap = new Map<string, number>();
  for (const row of telemetry) {
    if (row.result_count !== 0) continue;
    const q = row.query?.toLowerCase().trim();
    if (!q) continue;
    zeroResultMap.set(q, (zeroResultMap.get(q) ?? 0) + 1);
  }

  return Array.from(zeroResultMap.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function computeContentStats(documents: DocumentRow[]) {
  const totalDocuments = documents.length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0);
  const staleCount = documents.filter((d) => d.is_stale).length;
  const avgChunksPerDoc =
    totalDocuments > 0
      ? Math.round((totalChunks / totalDocuments) * 10) / 10
      : 0;

  const domainMap = new Map<string, { docCount: number; chunkCount: number }>();
  for (const doc of documents) {
    let domain = "unknown";
    try {
      domain = new URL(doc.url).hostname.replace(/^www\./, "");
    } catch {
      // keep "unknown"
    }
    const entry = domainMap.get(domain) ?? { docCount: 0, chunkCount: 0 };
    entry.docCount++;
    entry.chunkCount += doc.chunk_count ?? 0;
    domainMap.set(domain, entry);
  }

  const documentsByDomain = Array.from(domainMap.entries())
    .map(([domain, stats]) => ({
      domain,
      doc_count: stats.docCount,
      chunk_count: stats.chunkCount,
    }))
    .sort((a, b) => b.doc_count - a.doc_count);

  const staleDocuments = documents
    .filter((d) => d.is_stale)
    .map((d) => ({
      url: d.url,
      title: d.title,
      updated_at: d.updated_at,
    }))
    .slice(0, 50);

  const now = new Date();
  const freshness = { under7: 0, under30: 0, under90: 0, over90: 0 };
  for (const doc of documents) {
    const updatedAt = new Date(doc.updated_at || doc.created_at);
    const ageMs = now.getTime() - updatedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) freshness.under7++;
    else if (ageDays < 30) freshness.under30++;
    else if (ageDays < 90) freshness.under90++;
    else freshness.over90++;
  }

  return {
    kpis: {
      total_documents: totalDocuments,
      total_chunks: totalChunks,
      stale_count: staleCount,
      avg_chunks_per_doc: avgChunksPerDoc,
    },
    by_domain: documentsByDomain,
    stale_documents: staleDocuments,
    freshness,
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  const supabase = getSupabaseServiceClient();

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: telemetryData, error: telemetryError } = await supabase
      .from("search_telemetry")
      .select("query, result_count, top_similarity, avg_similarity, total_latency_ms, confidence, had_ai_answer")
      .eq("town", townId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);

    if (telemetryError) throw new Error(telemetryError.message);

    const telemetry = (telemetryData ?? []) as TelemetryRow[];

    const searchStats = computeSearchKPIs(telemetry);
    const topQueries = computeTopQueries(telemetry);
    const zeroResultQueries = computeZeroResultQueries(telemetry);

    const { data: documentsData, error: documentsError } = await supabase
      .from("documents")
      .select("id, url, title, is_stale, chunk_count, created_at, updated_at")
      .eq("town_id", townId)
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (documentsError) throw new Error(documentsError.message);

    const documents = (documentsData ?? []) as DocumentRow[];
    const contentStats = computeContentStats(documents);

    return Response.json({
      search: {
        kpis: searchStats.kpis,
        top_queries: topQueries,
        zero_result_queries: zeroResultQueries,
        confidence_distribution: searchStats.confidence_distribution,
      },
      content: contentStats,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected stats error.";
    return Response.json(
      { error: "Unable to load stats right now.", details },
      { status: 500 }
    );
  }
}
