/**
 * scripts/monitor.ts — Daily change detection cron
 *
 * Runs daily (typically at 2 AM) to detect changes on needhamma.gov:
 * 1. Checks CivicPlus RSS feed for new announcements
 * 2. Compares HTTP HEAD responses (Last-Modified, Content-Length, ETag)
 *    for tracked URLs against stored hashes
 * 3. Queues changed URLs for re-ingestion
 *
 * Designed to be run via Replit Scheduled Deployments.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";

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
      console.warn(
        `[monitor] HEAD request failed for ${url}: ${response.status}`
      );
      return { changed: false, newMetadata: storedMetadata };
    }

    const lastModified = response.headers.get("last-modified");
    const contentLength = response.headers.get("content-length");
    const etag = response.headers.get("etag");

    const newMetadata = {
      ...storedMetadata,
      last_modified: lastModified,
      content_length: contentLength,
      etag,
      last_checked: new Date().toISOString(),
    };

    // Detect changes
    const storedEtag = storedMetadata.etag as string | undefined;
    const storedLastModified = storedMetadata.last_modified as string | undefined;
    const storedContentLength = storedMetadata.content_length as string | undefined;

    // ETag is the most reliable change indicator
    if (etag && storedEtag && etag !== storedEtag) {
      return { changed: true, newMetadata };
    }

    // Last-Modified comparison
    if (lastModified && storedLastModified && lastModified !== storedLastModified) {
      return { changed: true, newMetadata };
    }

    // Content-Length as fallback
    if (
      contentLength &&
      storedContentLength &&
      contentLength !== storedContentLength
    ) {
      return { changed: true, newMetadata };
    }

    // If we have no prior metadata, flag as changed on first run
    if (!storedEtag && !storedLastModified && !storedContentLength) {
      return { changed: true, newMetadata };
    }

    return { changed: false, newMetadata };
  } catch (err) {
    console.error(`[monitor] Error checking ${url}:`, err);
    return { changed: false, newMetadata: storedMetadata };
  }
}

// ---------------------------------------------------------------------------
// RSS feed check
// ---------------------------------------------------------------------------

async function checkRssFeed(
  rssFeedUrl: string
): Promise<string[]> {
  try {
    const response = await fetch(rssFeedUrl);
    if (!response.ok) {
      console.warn(`[monitor] RSS fetch failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();

    // Simple RSS link extraction (no XML parser needed for basic use)
    const linkRegex = /<link>([^<]+)<\/link>/g;
    const urls: string[] = [];
    let match;
    while ((match = linkRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (url.startsWith("http")) {
        urls.push(url);
      }
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
  townId: string = "needham"
): Promise<ChangeDetectionResult> {
  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();
  let errors = 0;

  console.log(`[monitor] Starting change detection for town: ${townId}`);

  // Get all tracked documents
  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, content_hash, metadata")
    .eq("town_id", townId);

  if (fetchError) {
    throw new Error(`Failed to fetch documents: ${fetchError.message}`);
  }

  const tracked = (documents || []) as TrackedDocument[];
  console.log(`[monitor] Checking ${tracked.length} tracked documents`);

  const changedUrls: string[] = [];

  // Check each tracked URL for changes
  for (const doc of tracked) {
    const { changed, newMetadata } = await checkUrlForChanges(
      doc.url,
      doc.content_hash,
      doc.metadata || {}
    );

    if (changed) {
      changedUrls.push(doc.url);
      console.log(`[monitor] Change detected: ${doc.url}`);
    }

    // Update metadata with latest HEAD response data
    const { error: updateError } = await supabase
      .from("documents")
      .update({ metadata: newMetadata })
      .eq("id", doc.id);

    if (updateError) {
      errors++;
      console.error(`[monitor] Error updating ${doc.url}: ${updateError.message}`);
    }
  }

  // Check RSS feed for new URLs
  const rssUrls = await checkRssFeed(
    "https://www.needhamma.gov/rss.aspx"
  );

  const existingUrls = new Set(tracked.map((d) => d.url));
  const newUrls = rssUrls.filter((u) => !existingUrls.has(u));

  // Flag stale documents (not verified in 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { error: staleError } = await supabase
    .from("documents")
    .update({ is_stale: true })
    .eq("town_id", townId)
    .lt("last_verified_at", ninetyDaysAgo.toISOString());

  if (staleError) {
    console.error(`[monitor] Error flagging stale docs: ${staleError.message}`);
    errors++;
  }

  // Log the monitoring run
  const durationMs = Date.now() - startTime;
  await supabase.from("ingestion_log").insert({
    town_id: townId,
    action: "monitor",
    documents_processed: tracked.length,
    errors,
    duration_ms: durationMs,
    details: {
      changed_urls: changedUrls,
      new_urls: newUrls,
      checked_at: new Date().toISOString(),
    },
  });

  const result: ChangeDetectionResult = {
    checkedUrls: tracked.length,
    changedUrls,
    newUrls,
    removedUrls: [],
    errors,
    durationMs,
  };

  console.log(
    `[monitor] Complete: ${changedUrls.length} changed, ${newUrls.length} new, ${errors} errors (${durationMs}ms)`
  );

  return result;
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
      result.changedUrls.forEach((u) => console.log(`  → ${u}`));
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
