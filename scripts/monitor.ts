/**
 * scripts/monitor.ts — Daily change detection cron
 *
 * Runs daily (typically at 2 AM) to detect changes on needhamma.gov:
 * 1. Checks CivicPlus RSS feed for new announcements
 * 2. Compares HTTP HEAD responses (Last-Modified, Content-Length, ETag)
 *    for tracked URLs against stored hashes
 * 3. Queues changed URLs for re-ingestion
 * 4. Logs all results with structured success/failure counts
 *
 * Designed to be run via Replit Scheduled Deployments.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { IngestionLogger } from "./logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChangeDetectionResult {
  checkedUrls: number;
  changedUrls: string[];
  newUrls: string[];
  removedUrls: string[];
  errors: number;
  durationMs: number;
}

interface TrackedDocument {
  id: string;
  url: string;
  content_hash: string | null;
  source_type: "html" | "pdf" | null;
  last_changed: string | null;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Content-hash-based change detection
// ---------------------------------------------------------------------------

import { createHash } from "crypto";

function hashContent(content: string | Buffer): string {
  return createHash("sha256")
    .update(typeof content === "string" ? content : content)
    .digest("hex");
}

async function checkUrlForChanges(
  doc: TrackedDocument
): Promise<{ changed: boolean; newHash: string | null; error?: string }> {
  try {
    // For HTML pages: re-fetch and compare hash
    if (doc.source_type === "html") {
      const response = await fetch(doc.url);
      if (!response.ok) {
        return {
          changed: false,
          newHash: null,
          error: `HTTP ${response.status}`,
        };
      }
      const html = await response.text();
      const newHash = hashContent(html);
      return { changed: newHash !== doc.content_hash, newHash };
    }

    // For PDFs: download and compare hash
    if (doc.source_type === "pdf") {
      const response = await fetch(doc.url);
      if (!response.ok) {
        return {
          changed: false,
          newHash: null,
          error: `HTTP ${response.status}`,
        };
      }
      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const newHash = hashContent(pdfBuffer.toString("base64"));
      return { changed: newHash !== doc.content_hash, newHash };
    }

    return { changed: false, newHash: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[monitor] Error checking ${doc.url}:`, errorMessage);
    return { changed: false, newHash: null, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// RSS feed check
// ---------------------------------------------------------------------------

async function checkRssFeed(rssFeedUrl: string): Promise<string[]> {
  try {
    const response = await fetch(rssFeedUrl);
    if (!response.ok) { console.warn(`[monitor] RSS fetch failed: ${response.status}`); return []; }
    const xml = await response.text();
    const linkRegex = /<link>([^<]+)<\/link>/g;
    const urls: string[] = [];
    let match;
    while ((match = linkRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (url.startsWith("http")) urls.push(url);
    }
    console.log(`[monitor] RSS feed returned ${urls.length} URLs`);
    return urls;
  } catch (err) {
    console.error("[monitor] RSS check failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main monitoring function
// ---------------------------------------------------------------------------

export async function runChangeDetection(
  townId: string = "needham",
  triggeredBy: string = "cli"
): Promise<ChangeDetectionResult> {
  const logger = new IngestionLogger({ townId, action: "monitor", triggeredBy });
  const supabase = getSupabaseServiceClient();

  // Stage 1: Fetch tracked documents
  const fetchStage = logger.startStage("Fetch Tracked Documents");
  let tracked: TrackedDocument[] = [];
  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, content_hash, source_type, last_changed, metadata")
    .eq("town_id", townId);

  if (fetchError) {
    fetchStage.recordFailure(1, `Failed to fetch documents: ${fetchError.message}`);
    logger.addStageResult(fetchStage.finish());
    await logger.finish();
    throw new Error(`Failed to fetch documents: ${fetchError.message}`);
  }
  tracked = (documents || []) as TrackedDocument[];
  fetchStage.recordSuccess(tracked.length);
  logger.addStageResult(fetchStage.finish());

  // Stage 2: Content-hash change detection
  const changeCheckStage = logger.startStage("Content-Hash Change Detection");
  const changedUrls: string[] = [];
  let errorCount = 0;

  for (const doc of tracked) {
    const { changed, newHash, error } = await checkUrlForChanges(doc);

    if (error) {
      errorCount++;
      changeCheckStage.recordFailure(1, `Error checking ${doc.url}: ${error}`);
      continue;
    }

    if (changed) {
      changedUrls.push(doc.url);
      changeCheckStage.recordSuccess();

      // Update document with new hash and timestamps
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          content_hash: newHash,
          last_crawled: new Date().toISOString(),
          last_changed: new Date().toISOString(),
          is_stale: false,
        })
        .eq("id", doc.id);

      if (updateError) {
        changeCheckStage.recordFailure(1, `Error updating ${doc.url}: ${updateError.message}`);
      }
    } else {
      changeCheckStage.recordSkip(1);

      // Update last_crawled timestamp only
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          last_crawled: new Date().toISOString(),
        })
        .eq("id", doc.id);

      if (updateError) {
        changeCheckStage.recordFailure(1, `Error updating ${doc.url}: ${updateError.message}`);
      }
    }
  }

  changeCheckStage.addDetail("changed_count", changedUrls.length);
  changeCheckStage.addDetail("error_count", errorCount);
  logger.addStageResult(changeCheckStage.finish());

  // Stage 3: RSS feed
  const rssStage = logger.startStage("RSS Feed Check");
  const rssUrls = await checkRssFeed("https://www.needhamma.gov/rss.aspx");
  const existingUrls = new Set(tracked.map((d) => d.url));
  const newUrls = rssUrls.filter((u) => !existingUrls.has(u));
  rssStage.recordSuccess(rssUrls.length);
  rssStage.addDetail("new_urls_found", newUrls.length);
  logger.addStageResult(rssStage.finish());

  // Stage 4: Staleness flagging
  const staleStage = logger.startStage("Staleness Flagging");
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { error: staleError } = await supabase
    .from("documents").update({ is_stale: true }).eq("town_id", townId).lt("last_verified_at", ninetyDaysAgo.toISOString());
  if (staleError) staleStage.recordFailure(1, `Error flagging stale docs: ${staleError.message}`);
  else staleStage.recordSuccess();
  logger.addStageResult(staleStage.finish());

  const summary = await logger.finish({ changed_urls: changedUrls, new_urls: newUrls, checked_at: new Date().toISOString() });

  return { checkedUrls: tracked.length, changedUrls, newUrls, removedUrls: [], errors: summary.totalErrors, durationMs: summary.totalDurationMs };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    try {
      const result = await runChangeDetection();
      console.log("\n--- Change Detection Summary ---");
      console.log(`Checked: ${result.checkedUrls} URLs`);
      console.log(`Changed: ${result.changedUrls.length}`);
      result.changedUrls.forEach((u) => console.log(`  -> ${u}`));
      console.log(`New: ${result.newUrls.length}`);
      result.newUrls.forEach((u) => console.log(`  + ${u}`));
      console.log(`Errors: ${result.errors}`);
      console.log(`Duration: ${result.durationMs}ms`);
    } catch (err) {
      console.error("Change detection failed:", err);
      process.exit(1);
    }
  })();
}
