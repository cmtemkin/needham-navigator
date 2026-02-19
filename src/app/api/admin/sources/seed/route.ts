import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { CRAWL_SOURCES } from "@/../config/crawl-sources";
import { DEFAULT_TOWN_ID } from "@/../config/towns";

/**
 * POST /api/admin/sources/seed
 * Seeds the `sources` table from the hardcoded crawl-sources config.
 * Uses upsert (on url+town_id) so it's safe to run multiple times.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const supabase = getSupabaseServiceClient();

    const rows = CRAWL_SOURCES.map((src) => ({
      town_id: DEFAULT_TOWN_ID,
      url: src.url,
      name: src.id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      category: src.category,
      priority: src.priority,
      update_frequency: src.updateFrequency,
      document_type: src.documentType ?? "html",
      max_depth: src.maxDepth ?? 2,
      max_pages: src.maxPages ?? 10,
      is_active: src.status !== "blocked",
    }));

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Insert in batches of 50 to avoid payload limits
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { data, error } = await supabase
        .from("sources")
        .upsert(batch, { onConflict: "url,town_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        errors.push(`Batch ${Math.floor(i / 50)}: ${error.message}`);
      } else {
        inserted += data?.length ?? 0;
      }
    }

    skipped = rows.length - inserted;

    return Response.json({
      total_config: CRAWL_SOURCES.length,
      inserted,
      skipped,
      errors,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to seed sources", details: String(err) },
      { status: 500 }
    );
  }
}
