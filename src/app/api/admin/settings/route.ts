import { NextRequest } from "next/server";
import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID } from "@/lib/towns";

const AVAILABLE_MODELS = [
  { id: "gpt-5-nano", label: "GPT-5 Nano", inputPrice: 0.05, outputPrice: 0.40 },
  { id: "gpt-5-mini", label: "GPT-5 Mini", inputPrice: 0.25, outputPrice: 2.00 },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", inputPrice: 0.15, outputPrice: 0.60 },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", inputPrice: 0.40, outputPrice: 1.60 },
];

const VALID_MODEL_IDS = new Set(AVAILABLE_MODELS.map((m) => m.id));
const DEFAULT_MODEL = "gpt-5-nano";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  const townId =
    request.nextUrl.searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("towns")
      .select("config")
      .eq("id", townId)
      .single();

    if (error) {
      console.error("[api/admin/settings] GET error:", error.message);
    }

    const config = (data?.config as Record<string, unknown>) ?? {};
    const chatModel =
      typeof config.chat_model === "string" && VALID_MODEL_IDS.has(config.chat_model)
        ? config.chat_model
        : DEFAULT_MODEL;

    return Response.json({
      chat_model: chatModel,
      available_models: AVAILABLE_MODELS,
    });
  } catch (err) {
    console.error("[api/admin/settings] GET error:", err);
    return Response.json(
      { chat_model: DEFAULT_MODEL, available_models: AVAILABLE_MODELS },
    );
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  let body: { chat_model?: unknown; town?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chatModel = typeof body.chat_model === "string" ? body.chat_model.trim() : "";
  if (!VALID_MODEL_IDS.has(chatModel)) {
    return Response.json(
      { error: `Invalid model. Must be one of: ${Array.from(VALID_MODEL_IDS).join(", ")}` },
      { status: 400 },
    );
  }

  const townId =
    (typeof body.town === "string" && body.town.trim()) || DEFAULT_TOWN_ID;

  try {
    const supabase = getSupabaseServiceClient();

    // Read existing config to merge (not overwrite)
    const { data: existing } = await supabase
      .from("towns")
      .select("config")
      .eq("id", townId)
      .single();

    const currentConfig = (existing?.config as Record<string, unknown>) ?? {};
    const updatedConfig = { ...currentConfig, chat_model: chatModel };

    const { error } = await supabase
      .from("towns")
      .update({ config: updatedConfig })
      .eq("id", townId);

    if (error) {
      console.error("[api/admin/settings] PUT error:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ chat_model: chatModel, updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[api/admin/settings] PUT error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
