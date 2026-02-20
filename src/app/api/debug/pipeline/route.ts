/**
 * /api/debug/pipeline — Pipeline health diagnostic endpoint
 *
 * Reports the status of the content ingestion pipeline:
 * - Enabled source_configs and their last_fetched_at / last_error
 * - content_items count by source
 * - articles count by content_type
 * - Last daily brief date
 *
 * Protected by CRON_SECRET so only admins can access.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify secret (skip in development)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseServiceClient();
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Source configs
  try {
    const { data: configs } = await supabase
      .from("source_configs")
      .select("id, connector_type, category, schedule, enabled, last_fetched_at, last_error, error_count")
      .eq("town_id", "needham")
      .order("id");

    results.source_configs = {
      total: configs?.length ?? 0,
      enabled: configs?.filter(c => c.enabled).length ?? 0,
      configs: configs?.map(c => ({
        id: c.id,
        type: c.connector_type,
        category: c.category,
        enabled: c.enabled,
        last_fetched_at: c.last_fetched_at,
        last_error: c.last_error,
        error_count: c.error_count,
      })),
    };
  } catch (e) {
    results.source_configs = { error: e instanceof Error ? e.message : String(e) };
  }

  // 2. Content items by source
  try {
    const { data: items } = await supabase
      .from("content_items")
      .select("source_id, id")
      .eq("town_id", "needham");

    const bySource: Record<string, number> = {};
    for (const item of items ?? []) {
      bySource[item.source_id] = (bySource[item.source_id] ?? 0) + 1;
    }

    results.content_items = {
      total: items?.length ?? 0,
      by_source: bySource,
    };
  } catch (e) {
    results.content_items = { error: e instanceof Error ? e.message : String(e) };
  }

  // 3. Articles by content_type
  try {
    const { data: articles } = await supabase
      .from("articles")
      .select("content_type, id, is_daily_brief")
      .eq("town", "needham");

    const byType: Record<string, number> = {};
    let dailyBriefCount = 0;
    for (const a of articles ?? []) {
      byType[a.content_type] = (byType[a.content_type] ?? 0) + 1;
      if (a.is_daily_brief) dailyBriefCount++;
    }

    results.articles = {
      total: articles?.length ?? 0,
      by_content_type: byType,
      daily_briefs: dailyBriefCount,
    };
  } catch (e) {
    results.articles = { error: e instanceof Error ? e.message : String(e) };
  }

  // 4. Last daily brief
  try {
    const { data: lastBrief } = await supabase
      .from("articles")
      .select("id, title, published_at")
      .eq("town", "needham")
      .eq("is_daily_brief", true)
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

    results.last_daily_brief = lastBrief
      ? { title: lastBrief.title, published_at: lastBrief.published_at }
      : null;
  } catch {
    results.last_daily_brief = null;
  }

  return NextResponse.json(results);
}
