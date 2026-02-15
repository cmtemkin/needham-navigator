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
    .update(typeof content === "string" ? content : content)
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
// Main monitoring function
// ---------------------------------------------------------------------------

export async function runChangeDetection(
  townId: string = "needham",
  triggeredBy: string = "cli"
): Promise<ChangeDetectionResult> {
  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();
  let errorCount = 0;

  // Stage 1: Fetch tracked documents
  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, content_hash, source_type, metadata")
    .eq("town_id", townId);

  if (fetchError) {
    throw new Error(`Failed to fetch documents: ${fetchError.message}`);
  }

  const tracked = (documents || []) as TrackedDocument[];

  // Stage 2: Content-hash change detection
  const changedUrls: string[] = [];

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
      const now = new Date().toISOString();
      await supabase
        .from("documents")
        .update({
          last_verified_at: now,
          metadata: { ...doc.metadata, last_checked: now },
        })
        .eq("id", doc.id);
    }
  }

  // Change detection results logged to ingestion_log table

  // Stage 3: RSS feed check
  const rssUrls = await checkRssFeed("https://www.needhamma.gov/rss.aspx");
  const existingUrls = new Set(tracked.map((d) => d.url));
  const newUrls = rssUrls.filter((u) => !existingUrls.has(u));
  // New URLs logged to ingestion_log table

  // Stage 4: Staleness flagging
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { error: staleError } = await supabase
    .from("documents")
    .update({ is_stale: true })
    .eq("town_id", townId)
    .lt("last_verified_at", ninetyDaysAgo.toISOString());

  if (staleError) {
    errorCount++;
    console.error(`[monitor] Error flagging stale docs: ${staleError.message}`);
  }

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
    },
  });

  // Monitor completion logged to ingestion_log table

  return {
    checkedUrls: tracked.length,
    changedUrls,
    newUrls,
    removedUrls: [],
    errors: errorCount,
    durationMs,
  };
}
