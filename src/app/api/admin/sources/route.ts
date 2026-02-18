import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID } from "@/../config/towns";

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town") || DEFAULT_TOWN_ID;
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const activeOnly = searchParams.get("active") === "true";

  try {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from("sources")
      .select("*", { count: "exact" })
      .eq("town_id", townId)
      .order("priority", { ascending: false })
      .order("name", { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,url.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error, count } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ sources: data ?? [], total: count ?? 0 });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch sources", details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const body = await request.json();
    const {
      url,
      name,
      category = "general",
      priority = 3,
      update_frequency = "weekly",
      document_type = "html",
      max_depth = 2,
      max_pages = 10,
      is_active = true,
      town_id = DEFAULT_TOWN_ID,
    } = body as Record<string, unknown>;

    if (!url || !name) {
      return Response.json(
        { error: "url and name are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("sources")
      .insert({
        town_id,
        url,
        name,
        category,
        priority,
        update_frequency,
        document_type,
        max_depth,
        max_pages,
        is_active,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ source: data }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: "Failed to create source", details: String(err) },
      { status: 500 }
    );
  }
}
