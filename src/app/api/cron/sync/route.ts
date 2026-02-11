/**
 * /api/cron/sync — Daily sync endpoint for Replit Scheduled Deployments
 *
 * Called by Replit's cron scheduler (daily at 2 AM).
 * Runs change detection: HTTP HEAD checks on tracked URLs,
 * RSS feed check for new content, staleness flagging.
 *
 * Protected by CRON_SECRET or ADMIN_PASSWORD.
 */

import { getSupabaseServiceClient } from "@/lib/supabase";

const DEFAULT_TOWN_ID = "needham";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret = request.headers.get("x-cron-secret");
    if (headerSecret === cronSecret) return true;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const headerPassword = request.headers.get("x-admin-password");
  if (headerPassword === adminPassword) return true;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === adminPassword) return true;

  return false;
}

async function runChangeDetection(townId: string) {
  const startTime = Date.now();
  const supabase = getSupabaseServiceClient();
  let errors = 0;

  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, content_hash, metadata")
    .eq("town_id", townId);

  if (fetchError) throw new Error(`Failed to fetch documents: ${fetchError.message}`);

  const tracked = (documents || []) as Array<{
    id: string; url: string; content_hash: string | null; metadata: Record<string, unknown>;
  }>;

  const changedUrls: string[] = [];

  for (const doc of tracked) {
    try {
      const response = await fetch(doc.url, { method: "HEAD" });
      if (!response.ok) { errors++; continue; }

      const lastModified = response.headers.get("last-modified");
      const contentLength = response.headers.get("content-length");
      const etag = response.headers.get("etag");

      const stored = doc.metadata || {};
      const storedEtag = stored.etag as string | undefined;
      const storedLastModified = stored.last_modified as string | undefined;
      const storedContentLength = stored.content_length as string | undefined;

      let changed = false;
      if (etag && storedEtag && etag !== storedEtag) changed = true;
      else if (lastModified && storedLastModified && lastModified !== storedLastModified) changed = true;
      else if (contentLength && storedContentLength && contentLength !== storedContentLength) changed = true;
      else if (!storedEtag && !storedLastModified && !storedContentLength) changed = true;

      if (changed) changedUrls.push(doc.url);

      await supabase.from("documents").update({
        metadata: { ...stored, last_modified: lastModified, content_length: contentLength, etag, last_checked: new Date().toISOString() },
      }).eq("id", doc.id);
    } catch {
      errors++;
    }
  }

  // Check RSS feed for new URLs
  const newUrls: string[] = [];
  try {
    const rssResponse = await fetch("https://www.needhamma.gov/rss.aspx");
    if (rssResponse.ok) {
      const xml = await rssResponse.text();
      const linkRegex = /<link>([^<]+)<\/link>/g;
      const existingUrls = new Set(tracked.map((d) => d.url));
      let match;
      while ((match = linkRegex.exec(xml)) !== null) {
        const url = match[1].trim();
        if (url.startsWith("http") && !existingUrls.has(url)) newUrls.push(url);
      }
    }
  } catch { errors++; }

  // Flag stale documents (not verified in 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  await supabase.from("documents").update({ is_stale: true }).eq("town_id", townId).lt("last_verified_at", ninetyDaysAgo.toISOString());

  const durationMs = Date.now() - startTime;

  await supabase.from("ingestion_log").insert({
    town_id: townId,
    action: "monitor",
    documents_processed: tracked.length,
    errors,
    duration_ms: durationMs,
    details: { changed_urls: changedUrls, new_urls: newUrls, checked_at: new Date().toISOString(), triggered_by: "cron" },
  });

  return { checkedUrls: tracked.length, changedUrls, newUrls, errors, durationMs };
}

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runChangeDetection(DEFAULT_TOWN_ID);
    return Response.json({
      status: "completed",
      checked: result.checkedUrls,
      changed: result.changedUrls.length,
      changed_urls: result.changedUrls,
      new_urls: result.newUrls,
      errors: result.errors,
      duration_ms: result.durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected cron sync error.";
    return Response.json({ error: "Cron sync failed.", details }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return POST(request);
}
