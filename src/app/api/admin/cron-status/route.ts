/**
 * /api/admin/cron-status — Cron pipeline health check
 *
 * Returns diagnostic info about the daily cron pipeline:
 * - Whether CRON_SECRET is configured
 * - Number of source_configs in the database
 * - Recent ingestion_log entries
 * - Recent article generation activity
 */

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Check env vars
  diagnostics.env = {
    CRON_SECRET: !!process.env.CRON_SECRET,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    UPSTASH_VECTOR_REST_URL: !!process.env.UPSTASH_VECTOR_REST_URL,
  };

  try {
    const supabase = getSupabaseClient({});

    // 2. Count source_configs
    const { count: sourceConfigCount, error: scError } = await supabase
      .from("source_configs")
      .select("*", { head: true, count: "exact" });

    if (scError) {
      diagnostics.source_configs = { error: scError.message };
    } else {
      const { data: configs } = await supabase
        .from("source_configs")
        .select("id, town_id, connector_type, schedule, enabled, last_fetched_at, error_count, last_error")
        .eq("enabled", true);

      diagnostics.source_configs = {
        total: sourceConfigCount,
        enabled: configs?.length ?? 0,
        configs: configs?.map((c) => ({
          id: c.id,
          type: c.connector_type,
          schedule: c.schedule,
          last_fetched: c.last_fetched_at,
          errors: c.error_count,
          last_error: c.last_error,
        })),
      };
    }

    // 3. Recent ingestion_log entries (last 5)
    // Use select("*") because the schema varies across environments —
    // some lack `triggered_by`, `status`, or `details` columns.
    const { data: logs, error: logError } = await supabase
      .from("ingestion_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (logError) {
      diagnostics.recent_logs = { error: logError.message };
    } else {
      diagnostics.recent_logs = logs;
    }

    // 4. Recent articles (last 5)
    const { data: articles, error: artError } = await supabase
      .from("articles")
      .select("id, title, content_type, published_at, is_daily_brief")
      .order("published_at", { ascending: false })
      .limit(5);

    if (artError) {
      diagnostics.recent_articles = { error: artError.message };
    } else {
      diagnostics.recent_articles = articles;
    }
  } catch (error) {
    diagnostics.db_error =
      error instanceof Error ? error.message : "Failed to connect to database";
  }

  return NextResponse.json(diagnostics);
}
