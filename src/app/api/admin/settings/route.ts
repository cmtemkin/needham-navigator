import { NextRequest } from "next/server";
import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/db";
import { DEFAULT_TOWN_ID } from "@/lib/towns";
import { ALLOWED_CHAT_MODELS, GENERATION_MODEL, MODEL_LABELS, MODEL_PRICING } from "@/lib/models";

const AVAILABLE_MODELS = ALLOWED_CHAT_MODELS.map((id) => ({
  id,
  label: MODEL_LABELS[id] ?? id,
  inputPrice: MODEL_PRICING[id]?.input ?? 0,
  outputPrice: MODEL_PRICING[id]?.output ?? 0,
}));

const VALID_MODEL_IDS = new Set<string>(ALLOWED_CHAT_MODELS);
const DEFAULT_MODEL = GENERATION_MODEL;

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
