import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("ingestion_log")
      .select("id, action, documents_processed, errors, duration_ms, details, created_at")
      .eq("town_id", townId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return Response.json({ logs: data ?? [], total: (data ?? []).length });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected admin logs error.";
    return Response.json({ error: "Unable to load ingestion logs.", details }, { status: 500 });
  }
}
