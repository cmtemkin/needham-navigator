/**
 * src/lib/monitor.ts — Change detection for tracked documents
 *
 * Ported from scripts/monitor.ts so it can be imported by Next.js API routes
 * (scripts/ is excluded from tsconfig). The logic is identical:
 * 1. Checks tracked documents for content-hash changes
 * 2. Checks CivicPlus RSS feed for new pages
 * 3. Flags stale documents (not verified in 90 days)
 * 4. Logs results to Supabase ingestion_log
 */

import { createHash } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { cleanupExpiredCache } from "@/lib/answer-cache";

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
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Content-hash-based change detection
// ---------------------------------------------------------------------------

function hashContent(content: string | Buffer): string {
  return createHash("sha256")
    .update(content)
    .digest("hex");
}

async function checkUrlForChanges(
  doc: TrackedDocument
): Promise<{ changed: boolean; newHash: string | null; error?: string }> {
  try {
    if (doc.source_type === "html") {
      const response = await fetch(doc.url);
      if (!response.ok) {
        return { changed: false, newHash: null, error: `HTTP ${response.status}` };
      }
      const html = await response.text();
      const newHash = hashContent(html);
      return { changed: newHash !== doc.content_hash, newHash };
    }

    if (doc.source_type === "pdf") {
      const response = await fetch(doc.url);
      if (!response.ok) {
        return { changed: false, newHash: null, error: `HTTP ${response.status}` };
      }
      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const newHash = hashContent(pdfBuffer.toString("base64"));
      return { changed: newHash !== doc.content_hash, newHash };
    }

    return { changed: false, newHash: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[monitor] Error checking ${doc.url}:`, errorMessage); // nosemgrep: unsafe-formatstring
    return { changed: false, newHash: null, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// RSS feed check
// ---------------------------------------------------------------------------

async function checkRssFeed(rssFeedUrl: string): Promise<string[]> {
  try {
    const response = await fetch(rssFeedUrl);
    if (!response.ok) {
      console.warn(`[monitor] RSS fetch failed: ${response.status}`);
      return [];
    }
    const xml = await response.text();
    const linkRegex = /<link>([^<]+)<\/link>/g;
    const urls: string[] = [];
    let match;
    while ((match = linkRegex.exec(xml)) !== null) {
      const url = match[1].trim();
      if (url.startsWith("http")) urls.push(url);
    }
    // RSS feed URL count logged in ingestion_log table
    return urls;
  } catch (err) {
    console.error("[monitor] RSS check failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helper functions for change detection stages
// ---------------------------------------------------------------------------

type MonitorSupabaseClient = ReturnType<typeof getSupabaseServiceClient>;

async function checkDocumentsForChanges(
  supabase: MonitorSupabaseClient,
  tracked: TrackedDocument[]
): Promise<{ changedUrls: string[]; unchangedIds: string[]; errorCount: number }> {
  const changedUrls: string[] = [];
  const unchangedIds: string[] = [];
  let errorCount = 0;

  for (const doc of tracked) {
    const { changed, newHash, error } = await checkUrlForChanges(doc);

    if (error) {
      errorCount++;
      continue;
    }

    if (changed) {
      changedUrls.push(doc.url);
      const now = new Date().toISOString();
      await supabase
        .from("documents")
        .update({
          content_hash: newHash,
          last_verified_at: now,
          is_stale: false,
          metadata: { ...doc.metadata, last_changed: now, last_checked: now },
        })
        .eq("id", doc.id);
    } else {
      unchangedIds.push(doc.id);
    }
  }

  return { changedUrls, unchangedIds, errorCount };
}

async function batchUpdateUnchanged(
  supabase: MonitorSupabaseClient,
  unchangedIds: string[]
): Promise<number> {
  if (unchangedIds.length === 0) return 0;

  const now = new Date().toISOString();
  const { error: batchError } = await supabase
    .from("documents")
    .update({ last_verified_at: now })
    .in("id", unchangedIds);

  if (batchError) {
    console.error(`[monitor] Batch update failed: ${batchError.message}`);
    return 1;
  }
  return 0;
}

async function findNewUrlsFromRss(
  supabase: MonitorSupabaseClient,
  townId: string
): Promise<string[]> {
  const rssUrls = await checkRssFeed("https://www.needhamma.gov/rss.aspx");

  const { data: allUrlDocs } = await supabase
    .from("documents")
    .select("url")
    .eq("town_id", townId);
  const existingUrls = new Set((allUrlDocs || []).map((d: { url: string }) => d.url));
  return rssUrls.filter((u) => !existingUrls.has(u));
}

async function flagStaleDocuments(
  supabase: MonitorSupabaseClient,
  townId: string
): Promise<number> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { error: staleError } = await supabase
    .from("documents")
    .update({ is_stale: true })
    .eq("town_id", townId)
    .lt("last_verified_at", ninetyDaysAgo.toISOString());

  if (staleError) {
    console.error(`[monitor] Error flagging stale docs: ${staleError.message}`);
    return 1;
  }
  return 0;
}

async function runCleanupTasks(supabase: MonitorSupabaseClient): Promise<void> {
  try {
    const { data: cleanupResults } = await supabase.rpc("cleanup_old_data");
    if (cleanupResults) {
      console.log("[monitor] Retention cleanup:", cleanupResults);
    }
  } catch (err) {
    console.warn("[monitor] Retention cleanup failed:", err);
  }

  try {
    const cacheDeleted = await cleanupExpiredCache();
    if (cacheDeleted > 0) {
      console.log(`[monitor] Cleaned up ${cacheDeleted} expired cache entries`);
    }
  } catch (err) {
    console.warn("[monitor] Cache cleanup failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Main monitoring function
// ---------------------------------------------------------------------------

export async function runChangeDetection(
  townId: string = "needham",
  triggeredBy: string = "cli"
): Promise<ChangeDetectionResult> {
  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();

  // Stage 1: Fetch a rotating daily subset (~1/7 of documents)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const bucket = dayOfYear % 7;

  const { count: totalCount, error: countError } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("town_id", townId);

  const docCount = countError ? 800 : (totalCount ?? 800);
  const bucketSize = Math.ceil(docCount / 7);
  const rangeStart = bucket * bucketSize;
  const rangeEnd = rangeStart + bucketSize - 1;

  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, content_hash, source_type, metadata")
    .eq("town_id", townId)
    .order("created_at", { ascending: true })
    .range(rangeStart, rangeEnd);

  if (fetchError) {
    throw new Error(`Failed to fetch documents: ${fetchError.message}`);
  }

  const tracked = (documents || []) as TrackedDocument[];

  // Stage 2: Content-hash change detection
  const { changedUrls, unchangedIds, errorCount: changeErrors } =
    await checkDocumentsForChanges(supabase, tracked);
  let errorCount = changeErrors;

  // Stage 3: Batch update unchanged docs
  errorCount += await batchUpdateUnchanged(supabase, unchangedIds);

  // Stage 4: RSS feed check
  const newUrls = await findNewUrlsFromRss(supabase, townId);

  // Stage 5: Staleness flagging
  errorCount += await flagStaleDocuments(supabase, townId);

  // Stage 6: Cleanup tasks
  await runCleanupTasks(supabase);

  const durationMs = Date.now() - startTime;

  // Log to ingestion_log
  await supabase.from("ingestion_log").insert({
    town_id: townId,
    action: "monitor",
    documents_processed: tracked.length,
    errors: errorCount,
    duration_ms: durationMs,
    details: {
      changed_urls: changedUrls,
      new_urls: newUrls,
      checked_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      bucket: `${bucket + 1}/7`,
      total_documents: docCount,
      unchanged_batch_size: unchangedIds.length,
    },
  });

  return {
    checkedUrls: tracked.length,
    changedUrls,
    newUrls,
    removedUrls: [],
    errors: errorCount,
    durationMs,
  };
}
