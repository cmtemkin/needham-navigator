import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID } from "@/../config/towns";

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const townId = searchParams.get("town") || DEFAULT_TOWN_ID;

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sources")
      .select("*")
      .eq("town_id", townId)
      .order("category")
      .order("name");

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const sources = data ?? [];

    // Build CSV
    const headers = ["url", "name", "category", "priority", "update_frequency", "document_type", "max_depth", "max_pages", "is_active"];
    const csvLines = [
      headers.join(","),
      ...sources.map((s) =>
        [
          `"${(s.url ?? "").replace(/"/g, '""')}"`,
          `"${(s.name ?? "").replace(/"/g, '""')}"`,
          s.category,
          s.priority,
          s.update_frequency,
          s.document_type,
          s.max_depth,
          s.max_pages,
          s.is_active,
        ].join(",")
      ),
    ];

    return new Response(csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sources-${townId}.csv"`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to export sources", details: String(err) },
      { status: 500 }
    );
  }
}
