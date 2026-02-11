import { createHash } from "crypto";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseClient } from "@/lib/supabase";

type FeedbackRequestBody = {
  response_id?: unknown;
  helpful?: unknown;
  comment?: unknown;
  session_id?: unknown;
  town_id?: unknown;
};

type ExistingConversationRow = { id: string };
type InsertedConversationRow = { id: string };

function hashResponseId(responseId: string): string {
  return createHash("sha256").update(responseId).digest("hex");
}

async function findOrCreateConversationId(options: {
  townId: string;
  sessionId: string;
}): Promise<string> {
  const supabase = getSupabaseClient({ townId: options.townId });

  const { data: existingRows, error: lookupError } = await supabase
    .from("conversations")
    .select("id")
    .eq("town_id", options.townId)
    .eq("session_id", options.sessionId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const existing = (existingRows as ExistingConversationRow[] | null)?.[0];
  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("conversations")
    .insert({
      town_id: options.townId,
      session_id: options.sessionId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Could not create conversation.");
  }

  return (inserted as InsertedConversationRow).id;
}

export async function POST(request: Request): Promise<Response> {
  let body: FeedbackRequestBody;

  try {
    body = (await request.json()) as FeedbackRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (typeof body.helpful !== "boolean") {
    return Response.json(
      { error: "Field 'helpful' must be a boolean." },
      { status: 400 }
    );
  }

  const townId =
    (typeof body.town_id === "string" && body.town_id.trim()) || DEFAULT_TOWN_ID;
  const responseId =
    typeof body.response_id === "string" ? body.response_id.trim() : "";
  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (comment.length > 2000) {
    return Response.json(
      { error: "Field 'comment' must be 2000 characters or less." },
      { status: 400 }
    );
  }

  try {
    let conversationId: string | null = null;
    if (sessionId) {
      conversationId = await findOrCreateConversationId({ townId, sessionId });
    }

    const payload: {
      conversation_id: string | null;
      response_text_hash: string | null;
      helpful: boolean;
      comment: string | null;
    } = {
      conversation_id: conversationId,
      response_text_hash: responseId ? hashResponseId(responseId) : null,
      helpful: body.helpful,
      comment: comment || null,
    };

    const supabase = getSupabaseClient({ townId });
    const { error } = await supabase.from("feedback").insert(payload);

    if (error) {
      throw new Error(error?.message ?? "Unable to save feedback.");
    }

    return Response.json(
      {
        success: true,
        conversation_id: conversationId,
      },
      { status: 201 }
    );
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected feedback API error.";
    return Response.json(
      { error: "Unable to submit feedback right now.", details },
      { status: 500 }
    );
  }
}
