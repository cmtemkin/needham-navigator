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
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// HTTP HEAD check
// ---------------------------------------------------------------------------

async function checkUrlForChanges(
  url: string,
  storedHash: string | null,
  storedMetadata: Record<string, unknown>
): Promise<{ changed: boolean; newMetadata: Record<string, unknown> }> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      console.warn(`[monitor] HEAD request failed for ${url}: ${response.status}`);
      return { changed: false, newMetadata: storedMetadata };
    }

    const lastModified = response.headers.get("last-modified");
    const contentLength = response.headers.get("content-length");
    const etag = response.headers.get("etag");
    const newMetadata = { ...storedMetadata, last_modified: lastModified, content_length: contentLength, etag, last_checked: new Date().toISOString() };

    const storedEtag = storedMetadata.etag as string | undefined;
    const storedLastModified = storedMetadata.last_modified as string | undefined;
    const storedContentLength = storedMetadata.content_length as string | undefined;

    if (etag && storedEtag && etag !== storedEtag) return { changed: true, newMetadata };
    if (lastModified && storedLastModified && lastModified !== storedLastModified) return { changed: true, newMetadata };
    if (contentLength && storedContentLength && contentLength !== storedContentLength) return { changed: true, newMetadata };
    if (!storedEtag && !storedLastModified && !storedContentLength) return { changed: true, newMetadata };

    return { changed: false, newMetadata };
  } catch (err) {
    console.error(`[monitor] Error checking ${url}:`, err);
    return { changed: false, newMetadata: storedMetadata };
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
    .from("documents").select("id, url, content_hash, metadata").eq("town_id", townId);

  if (fetchError) {
    fetchStage.recordFailure(1, `Failed to fetch documents: ${fetchError.message}`);
    logger.addStageResult(fetchStage.finish());
    await logger.finish();
    throw new Error(`Failed to fetch documents: ${fetchError.message}`);
  }
  tracked = (documents || []) as TrackedDocument[];
  fetchStage.recordSuccess(tracked.length);
  logger.addStageResult(fetchStage.finish());

  // Stage 2: HTTP HEAD checks
  const headCheckStage = logger.startStage("HTTP HEAD Checks");
  const changedUrls: string[] = [];
  for (const doc of tracked) {
    const { changed, newMetadata } = await checkUrlForChanges(doc.url, doc.content_hash, doc.metadata || {});
    if (changed) { changedUrls.push(doc.url); headCheckStage.recordSuccess(); } else { headCheckStage.recordSkip(1); }
    const { error: updateError } = await supabase.from("documents").update({ metadata: newMetadata }).eq("id", doc.id);
    if (updateError) headCheckStage.recordFailure(1, `Error updating ${doc.url}: ${updateError.message}`);
  }
  headCheckStage.addDetail("changed_count", changedUrls.length);
  logger.addStageResult(headCheckStage.finish());

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
