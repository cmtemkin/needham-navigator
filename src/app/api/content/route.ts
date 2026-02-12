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

    const total = count ?? 0;

    return Response.json({
      items: data ?? [],
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected content API error.";

    return Response.json(
      { error: "Unable to load content.", details },
      { status: 500 }
    );
  }
}
