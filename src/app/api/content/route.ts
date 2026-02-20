/**
 * src/app/api/content/route.ts — Content items API
 *
 * Serves content from the content_items table with filtering,
 * pagination, and source-based filtering.
 *
 * GET /api/content?town=needham&category=news&source=needham:patch-news&limit=20&offset=0
 */

import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID } from "@/lib/towns";
import { checkGeographicRelevance } from "@/lib/geo-filter";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  const category = searchParams.get("category")?.trim() || null;
  const sourceId = searchParams.get("source")?.trim() || null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    const supabase = getSupabaseClient({ townId });

    let query = supabase
      .from("content_items")
      .select("id, source_id, category, title, content, summary, published_at, expires_at, url, image_url, metadata, created_at", { count: "exact" })
      .eq("town_id", townId)
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("category", category);
    }

    if (sourceId) {
      query = query.eq("source_id", sourceId);
    }

    // Exclude expired items
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Post-filter: remove geographically irrelevant content
    type ContentRow = { title?: string; content?: string; summary?: string; url?: string; category?: string };
    const filtered = (data ?? []).filter((item: ContentRow) => {
      const text = (item.summary || item.content?.slice(0, 2000)) ?? "";
      const geo = checkGeographicRelevance(text, item.title ?? "", item.url ?? "", item.category ?? "news");
      return geo.isRelevant;
    });

    const total = count ?? 0;

    return Response.json({
      items: filtered,
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected content API error.";
    console.error("[api/content] Error:", details);

    // If the content_items table doesn't exist yet (migration not applied),
    // return an empty result instead of crashing
    if (
      typeof details === "string" &&
      details.includes("does not exist")
    ) {
      return Response.json({
        items: [],
        total: 0,
        hasMore: false,
        offset,
        limit,
      });
    }

    return Response.json(
      { error: "Unable to load content.", details },
      { status: 500 }
    );
  }
}
