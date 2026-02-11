import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  try {
    const supabase = getSupabaseClient({ townId });
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, phone, email, address, hours, description")
      .eq("town_id", townId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ departments: data ?? [] });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected departments API error.";
    return Response.json(
      {
        error: "Unable to load departments right now.",
        details,
      },
      { status: 500 }
    );
  }
}
