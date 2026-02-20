/**
 * /api/cron/daily — Unified daily cron endpoint
 *
 * Consolidates monitor, ingest, and generate into a single endpoint
 * to stay within Vercel Hobby plan limits (1 daily cron job).
 *
 * Runs at 6:00 AM UTC (1:00 AM Eastern) and executes in order:
 * 1. Monitor — change detection on tracked pages
 * 2. Ingest — run all due connectors
 * 3. Generate — create articles from new content
 *
 * The individual /api/cron/monitor, /api/cron/ingest, and /api/cron/generate
 * endpoints remain available for manual or on-demand use.
 *
 * Security: Protected by CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { runChangeDetection } from "@/lib/monitor";
import { runConnectors } from "@/lib/connectors/runner";
import {
  generateFromMeetingMinutes,
  generateFromPublicRecord,
  summarizeExternalArticle,
  generateDailyBrief,
} from "@/lib/article-generator";
import { getSupabaseClient } from "@/lib/supabase";

// Register all connector factories so the runner can instantiate them
import "@/lib/connectors/register-all";

/** Wrap a promise with a timeout to prevent any single step from
 *  monopolising disk IO on the Supabase free tier. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Small delay to spread disk IO between cron steps. */
const IO_COOLDOWN_MS = 3_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for cron jobs

export async function GET(request: NextRequest) {
  // Verify cron secret (skip in development)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // Keep-alive: lightweight query to prevent Supabase free-tier auto-pause
  try {
    const supabase = getSupabaseClient({});
    await supabase.from("towns").select("id", { head: true, count: "exact" });
  } catch (e) {
    console.warn("[cron/daily] Keep-alive ping failed:", e);
  }

  // Step 1: Monitor — change detection (timeout: 90s)
  try {
    const monitor = await withTimeout(
      runChangeDetection("needham", "vercel-cron"),
      90_000,
      "Monitor",
    );
    results.monitor = {
      status: "ok",
      checked: monitor.checkedUrls,
      changed: monitor.changedUrls.length,
      changedUrls: monitor.changedUrls,
      newUrls: monitor.newUrls,
      errors: monitor.errors,
      durationMs: monitor.durationMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily] Monitor error:", message);
    results.monitor = { status: "error", error: message };
  }

  // Cooldown: let disk IO settle before next step
  await new Promise((r) => setTimeout(r, IO_COOLDOWN_MS));

  // Step 2: Ingest — run connectors (timeout: 120s)
  try {
    const connectorResults = await withTimeout(
      runConnectors({ townId: "needham" }),
      120_000,
      "Ingest",
    );
    results.ingest = {
      status: "ok",
      connectorsRun: connectorResults.length,
      connectors: connectorResults.map(r => ({
        id: r.connectorId,
        found: r.itemsFound,
        upserted: r.itemsUpserted,
        skipped: r.itemsSkipped,
        errors: r.errors,
        durationMs: r.durationMs,
      })),
      totalItemsUpserted: connectorResults.reduce((s, r) => s + r.itemsUpserted, 0),
      totalItemsSkipped: connectorResults.reduce((s, r) => s + r.itemsSkipped, 0),
      totalErrors: connectorResults.reduce((s, r) => s + r.errors.length, 0),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily] Ingest error:", message);
    results.ingest = { status: "error", error: message };
  }

  // Cooldown: let disk IO settle before next step
  await new Promise((r) => setTimeout(r, IO_COOLDOWN_MS));

  // Step 3: Generate — create articles from new content
  try {
    let generated = 0;
    const genErrors: string[] = [];
    const genDetails: Record<string, unknown> = {};

    try {
      const meetingArticles = await generateFromMeetingMinutes();
      generated += meetingArticles.length;
      genDetails.meeting_minutes = { count: meetingArticles.length, titles: meetingArticles.map(a => a.title) };
    }
    catch (e) { genErrors.push(`meeting_minutes: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      const recordArticles = await generateFromPublicRecord();
      generated += recordArticles.length;
      genDetails.public_record = { count: recordArticles.length, titles: recordArticles.map(a => a.title) };
    }
    catch (e) { genErrors.push(`public_record: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      const externalArticles = await summarizeExternalArticle();
      generated += externalArticles.length;
      genDetails.external = { count: externalArticles.length, titles: externalArticles.map(a => a.title) };
    }
    catch (e) { genErrors.push(`external: ${e instanceof Error ? e.message : String(e)}`); }

    try {
      const brief = await generateDailyBrief();
      if (brief) {
        generated += 1;
        genDetails.daily_brief = { generated: true, title: brief.title };
      } else {
        genDetails.daily_brief = { generated: false, reason: "skipped (already exists or no articles)" };
      }
    }
    catch (e) { genErrors.push(`daily_brief: ${e instanceof Error ? e.message : String(e)}`); }

    results.generate = {
      status: genErrors.length === 0 ? "ok" : "partial",
      articlesGenerated: generated,
      details: genDetails,
      errors: genErrors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily] Generate error:", message);
    results.generate = { status: "error", error: message };
  }

  results.totalDurationMs = Date.now() - startTime;

  return NextResponse.json(results);
}
