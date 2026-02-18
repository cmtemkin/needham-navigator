/**
 * /api/cron/generate — Daily article generation
 *
 * Triggered by Vercel Cron (daily at 10:00 AM UTC / 5:00 AM Eastern).
 * Runs after the ingest cron so new content_items are available.
 *
 * Pipeline:
 * 1. Generate articles from new meeting minutes
 * 2. Generate articles from new public records
 * 3. Summarize external news (from content_items ingested by RSS/scrape)
 * 4. Generate daily brief from today's articles
 *
 * Security: Protected by CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateFromMeetingMinutes,
  generateFromPublicRecord,
  summarizeExternalArticle,
  generateDailyBrief,
} from "@/lib/article-generator";

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
  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Step 1: Meeting minutes
  try {
    const articles = await generateFromMeetingMinutes();
    generated += articles.length;
  } catch (err) {
    errors.push(`meeting_minutes: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Public records
  try {
    const articles = await generateFromPublicRecord();
    generated += articles.length;
  } catch (err) {
    errors.push(`public_record: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: External article summaries
  try {
    const articles = await summarizeExternalArticle();
    generated += articles.length;
  } catch (err) {
    errors.push(`external: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 4: Daily brief
  try {
    const brief = await generateDailyBrief();
    if (brief) {
      generated += 1;
    } else {
      skipped += 1;
    }
  } catch (err) {
    errors.push(`daily_brief: ${err instanceof Error ? err.message : String(err)}`);
  }

  const durationMs = Date.now() - startTime;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    generated,
    skipped,
    errors,
    durationMs,
  });
}
