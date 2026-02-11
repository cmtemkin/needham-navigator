import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase";

type ConversationRow = { id: string; session_id: string };
type FeedbackRow = { helpful: boolean | null; comment: string | null };

const STOP_WORDS = new Set([
  "the", "and", "for", "needham", "town", "with", "about", "what",
  "when", "where", "this", "that", "from", "have", "your", "you",
  "are", "how", "can", "get", "all",
]);

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractTopicTokens(sessionId: string): string[] {
  if (!sessionId || isUuidLike(sessionId)) return [];
  return sessionId.toLowerCase().split(/[^a-z0-9]+/g).filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function computeTopTopics(sessionIds: string[]): Array<{ topic: string; count: number }> {
  const counts = new Map<string, number>();
  for (const sid of sessionIds) {
    for (const token of extractTopicTokens(sid)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count).slice(0, 8);
}

async function fetchAllConversations(townId: string): Promise<ConversationRow[]> {
  const supabase = getSupabaseServiceClient();
  const rows: ConversationRow[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from("conversations").select("id, session_id").eq("town_id", townId).range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as ConversationRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

async function fetchFeedbackByConversationIds(conversationIds: string[]): Promise<FeedbackRow[]> {
  if (conversationIds.length === 0) return [];
  const supabase = getSupabaseServiceClient();
  const allRows: FeedbackRow[] = [];
  for (const ids of chunkIds(conversationIds, 500)) {
    const { data, error } = await supabase.from("feedback").select("helpful, comment").in("conversation_id", ids);
    if (error) throw new Error(error.message);
    allRows.push(...((data ?? []) as FeedbackRow[]));
  }
  return allRows;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  const supabase = getSupabaseServiceClient();

  try {
    const [documentsCountResult, chunksCountResult, conversations] = await Promise.all([
      supabase.from("documents").select("id", { head: true, count: "exact" }).eq("town_id", townId),
      supabase.from("document_chunks").select("id", { head: true, count: "exact" }).eq("town_id", townId),
      fetchAllConversations(townId),
    ]);

    if (documentsCountResult.error) throw new Error(documentsCountResult.error.message);
    if (chunksCountResult.error) throw new Error(chunksCountResult.error.message);

    const conversationIds = conversations.map((c) => c.id);
    const feedbackRows = await fetchFeedbackByConversationIds(conversationIds);

    const feedbackSummary = { helpful: 0, not_helpful: 0, unknown: 0 };
    for (const row of feedbackRows) {
      if (row.helpful === true) feedbackSummary.helpful++;
      else if (row.helpful === false) feedbackSummary.not_helpful++;
      else feedbackSummary.unknown++;
    }

    const topTopics = computeTopTopics(conversations.map((c) => c.session_id));

    // Compute confidence distribution from query logs in ingestion_log
    let avgConfidence: number | null = null;
    let confidenceDistribution: { high: number; medium: number; low: number } | null = null;

    const { data: queryLogs } = await supabase
      .from("ingestion_log")
      .select("details")
      .eq("town_id", townId)
      .eq("action", "query")
      .order("created_at", { ascending: false })
      .limit(500);

    if (queryLogs && queryLogs.length > 0) {
      let totalSim = 0;
      let simCount = 0;
      const dist = { high: 0, medium: 0, low: 0 };

      for (const row of queryLogs) {
        const details = row.details as Record<string, unknown> | null;
        if (!details) continue;
        const conf = details.confidence_level as string | undefined;
        const sim = details.avg_similarity as number | undefined;
        if (conf === "high") dist.high++;
        else if (conf === "medium") dist.medium++;
        else if (conf === "low") dist.low++;
        if (typeof sim === "number") { totalSim += sim; simCount++; }
      }

      if (simCount > 0) avgConfidence = totalSim / simCount;
      if (dist.high + dist.medium + dist.low > 0) confidenceDistribution = dist;
    }

    return Response.json({
      total_documents: documentsCountResult.count ?? 0,
      total_chunks: chunksCountResult.count ?? 0,
      total_conversations: conversations.length,
      total_feedback: feedbackRows.length,
      feedback_breakdown: feedbackSummary,
      top_topics: topTopics,
      avg_confidence: avgConfidence,
      confidence_distribution: confidenceDistribution,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected admin analytics error.";
    return Response.json({ error: "Unable to load analytics right now.", details }, { status: 500 });
  }
}
