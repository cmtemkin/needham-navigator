import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ConnectorHealth = "healthy" | "warning" | "error" | "disabled" | "never_run";

interface ConnectorStatus {
  id: string;
  connector_type: string;
  category: string;
  enabled: boolean;
  schedule: string;
  last_fetched_at: string | null;
  error_count: number;
  last_error: string | null;
  health: ConnectorHealth;
}

function classifyHealth(
  enabled: boolean,
  lastFetched: string | null,
  errorCount: number,
  schedule: string,
): ConnectorHealth {
  if (!enabled) return "disabled";
  if (!lastFetched) return "never_run";

  const ageMs = Date.now() - new Date(lastFetched).getTime();
  const scheduleMs: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
  };
  const expectedInterval = scheduleMs[schedule] ?? scheduleMs.daily;

  if (errorCount >= 4 || ageMs > expectedInterval * 3) return "error";
  if (errorCount >= 1 || ageMs > expectedInterval * 2) return "warning";
  return "healthy";
}

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) return unauthorizedAdminResponse();

  try {
    const supabase = getSupabaseServiceClient();

    // Parallel queries for all pipeline data
    const [
      connectorsResult,
      lastCronResult,
      articlesTodayResult,
      articlesWeekResult,
      dailyBriefResult,
      contentTotalResult,
      content24hResult,
      content7dResult,
    ] = await Promise.all([
      // 1. Connector statuses
      supabase
        .from("source_configs")
        .select("id, connector_type, category, enabled, schedule, last_fetched_at, error_count, last_error")
        .order("category")
        .order("id"),

      // 2. Last cron run
      supabase
        .from("ingestion_log")
        .select("created_at, duration_ms, errors, action, details")
        .eq("action", "daily-cron")
        .order("created_at", { ascending: false })
        .limit(1),

      // 3. Articles generated today
      supabase
        .from("articles")
        .select("id", { head: true, count: "exact" })
        .gte("published_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

      // 4. Articles generated this week
      supabase
        .from("articles")
        .select("id", { head: true, count: "exact" })
        .gte("published_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // 5. Last daily brief
      supabase
        .from("articles")
        .select("published_at")
        .eq("is_daily_brief", true)
        .order("published_at", { ascending: false })
        .limit(1),

      // 6. Total content items
      supabase
        .from("content_items")
        .select("id", { head: true, count: "exact" }),

      // 7. Content items last 24h
      supabase
        .from("content_items")
        .select("id", { head: true, count: "exact" })
        .gte("published_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // 8. Content items last 7 days
      supabase
        .from("content_items")
        .select("id", { head: true, count: "exact" })
        .gte("published_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Build connector statuses
    const connectors: ConnectorStatus[] = (connectorsResult.data ?? []).map((c) => ({
      id: c.id,
      connector_type: c.connector_type,
      category: c.category,
      enabled: c.enabled,
      schedule: c.schedule,
      last_fetched_at: c.last_fetched_at,
      error_count: c.error_count ?? 0,
      last_error: c.last_error,
      health: classifyHealth(c.enabled, c.last_fetched_at, c.error_count ?? 0, c.schedule),
    }));

    // Last cron run
    const lastCronEntry = lastCronResult.data?.[0];
    const lastRun = lastCronEntry
      ? {
          timestamp: lastCronEntry.created_at,
          duration_ms: lastCronEntry.duration_ms,
          status: (lastCronEntry.errors ?? 0) > 0 ? "error" : "ok",
        }
      : null;

    // Article generation stats
    const generation = {
      articles_today: articlesTodayResult.count ?? 0,
      articles_this_week: articlesWeekResult.count ?? 0,
      last_daily_brief: dailyBriefResult.data?.[0]?.published_at ?? null,
    };

    // Content freshness
    const freshness = {
      total_items: contentTotalResult.count ?? 0,
      items_last_24h: content24hResult.count ?? 0,
      items_last_7d: content7dResult.count ?? 0,
    };

    return Response.json({
      lastRun,
      connectors,
      generation,
      freshness,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected pipeline status error.";
    return Response.json(
      { error: "Unable to load pipeline status.", details },
      { status: 500 },
    );
  }
}
