/**
 * src/app/api/cron/ingest/route.ts — Cron endpoint for connector ingestion
 *
 * Triggered by Vercel Cron or GitHub Actions. Runs all due connectors
 * and returns a summary of results.
 *
 * Query params:
 *   ?town=needham        — run only for this town
 *   ?schedule=daily      — run only connectors with this schedule
 *   ?force=true          — run even if not due
 *
 * Security: Protected by CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from "next/server";
import { runConnectors } from "@/lib/connectors/runner";
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

  try {
    const results = await runConnectors({ townId, schedule, force });

    const summary = {
      timestamp: new Date().toISOString(),
      connectorsRun: results.length,
      totalItemsUpserted: results.reduce((s, r) => s + r.itemsUpserted, 0),
      totalItemsSkipped: results.reduce((s, r) => s + r.itemsSkipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      results,
    };

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
