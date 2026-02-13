/**
 * /api/cron/monitor — Daily content change detection
 *
 * Triggered by Vercel Cron (daily at 6:00 AM UTC / 1:00 AM Eastern).
 * Checks tracked needhamma.gov pages for content changes via hash
 * comparison, monitors RSS for new pages, and flags stale documents.
 *
 * Security: Protected by CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { runChangeDetection } from "@/lib/monitor";

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

  try {
    const result = await runChangeDetection("needham", "vercel-cron");

    return NextResponse.json({
      status: "completed",
      timestamp: new Date().toISOString(),
      checked: result.checkedUrls,
      changed: result.changedUrls.length,
      changedUrls: result.changedUrls,
      newUrls: result.newUrls,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/monitor] Fatal error:", message);
    return NextResponse.json(
      { error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
