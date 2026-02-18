/**
 * src/app/api/cron/ingest/route.ts — Cron endpoint for connector ingestion
 *
 * Triggered by Vercel Cron or GitHub Actions. Runs all due connectors
 * and returns a summary of results. Optionally generates articles after
 * ingestion when ?generate=true is passed.
 *
 * Query params:
 *   ?town=needham        — run only for this town
 *   ?schedule=daily      — run only connectors with this schedule
 *   ?force=true          — run even if not due
 *   ?generate=true       — also run article generation after ingestion
 *
 * Security: Protected by CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from "next/server";
import { runConnectors } from "@/lib/connectors/runner";
import {
  generateFromMeetingMinutes,
  generateFromPublicRecord,
  summarizeExternalArticle,
  generateDailyBrief,
} from "@/lib/article-generator";
import type { ConnectorSchedule } from "@/lib/connectors/types";

// Register all connector factories so the runner can instantiate them
import "@/lib/connectors/register-all";

export const runtime = "nodejs";
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

  const { searchParams } = request.nextUrl;
  const townId = searchParams.get("town") ?? undefined;
  const schedule = searchParams.get("schedule") as ConnectorSchedule | undefined;
  const force = searchParams.get("force") === "true";
  const shouldGenerate = searchParams.get("generate") === "true";

  try {
    const results = await runConnectors({ townId, schedule, force });

    const summary: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      connectorsRun: results.length,
      totalItemsUpserted: results.reduce((s, r) => s + r.itemsUpserted, 0),
      totalItemsSkipped: results.reduce((s, r) => s + r.itemsSkipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      results,
    };

    // Optionally run article generation after ingestion
    if (shouldGenerate) {
      let generated = 0;
      const genErrors: string[] = [];

      try { generated += (await generateFromMeetingMinutes()).length; }
      catch (e) { genErrors.push(`meeting_minutes: ${e instanceof Error ? e.message : String(e)}`); }

      try { generated += (await generateFromPublicRecord()).length; }
      catch (e) { genErrors.push(`public_record: ${e instanceof Error ? e.message : String(e)}`); }

      try { generated += (await summarizeExternalArticle()).length; }
      catch (e) { genErrors.push(`external: ${e instanceof Error ? e.message : String(e)}`); }

      try {
        const brief = await generateDailyBrief();
        if (brief) generated += 1;
      }
      catch (e) { genErrors.push(`daily_brief: ${e instanceof Error ? e.message : String(e)}`); }

      summary.articlesGenerated = generated;
      summary.generationErrors = genErrors;
    }

    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/ingest] Fatal error:", message);
    return NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
