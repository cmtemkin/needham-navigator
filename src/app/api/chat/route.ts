import { randomUUID } from "crypto";
import { openai } from "@ai-sdk/openai";
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { scoreConfidenceFromChunks } from "@/lib/confidence";
import { trackCost } from "@/lib/cost-tracker";
import { buildChatSystemPrompt } from "@/lib/prompts";
import {
  buildContextDocuments,
  dedupeSources,
  DEFAULT_TOWN_ID,
  retrieveRelevantChunks,
  type RetrievedChunk,
} from "@/lib/rag";
import { getSupabaseClient } from "@/lib/supabase";

const DEFAULT_CHAT_MODEL = "gpt-5-nano";
const ALLOWED_MODELS = new Set([
  "gpt-5-nano", "gpt-5-mini", "gpt-4o-mini", "gpt-4.1-mini",
]);

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequestBody = {
  messages?: unknown;
  town_id?: unknown;
  townId?: unknown;
};

function normalizeMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const messages: IncomingMessage[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;

    if (
      (role === "user" || role === "assistant" || role === "system") &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      messages.push({ role, content: content.trim() });
    }
  }

  return messages;
}

function staticStreamResponse(options: {
  text: string;
  confidence: ReturnType<typeof scoreConfidenceFromChunks>;
  sources: Array<{
    source_id: string;
    citation: string;
    document_title: string;
    document_url?: string;
    section?: string;
    date?: string;
    page_number?: number;
  }>;
  responseId: string;
  status?: number;
}): Response {
  const textPartId = randomUUID();

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "text-start", id: textPartId });
      writer.write({ type: "text-delta", id: textPartId, delta: options.text });
      writer.write({ type: "text-end", id: textPartId });
      writer.write({
        type: "data-confidence",
        data: options.confidence,
        transient: true,
      });
      writer.write({
        type: "data-sources",
        data: options.sources,
        transient: true,
      });
      writer.write({
        type: "data-response-id",
        data: options.responseId,
        transient: true,
      });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    status: options.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const messages = normalizeMessages(body.messages);
  if (messages.length === 0) {
    return Response.json(
      { error: "Request must include at least one message." },
      { status: 400 }
    );
  }

  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (!latestUserMessage) {
    return Response.json(
      { error: "Request must include at least one user message." },
      { status: 400 }
    );
  }

  const townId =
    (typeof body.town_id === "string" && body.town_id.trim()) ||
    (typeof body.townId === "string" && body.townId.trim()) ||
    DEFAULT_TOWN_ID;

  const includeDisclaimer = messages.every((message) => message.role !== "assistant");
  const responseId = randomUUID();

  try {
    // Wrap retrieval in its own try/catch so embedding/Supabase failures
    // degrade gracefully to the "call Town Hall" fallback instead of a 500
    let chunks: RetrievedChunk[] = [];
    try {
      chunks = await retrieveRelevantChunks(latestUserMessage.content, {
        townId,
        matchThreshold: 0.30,
      });
    } catch (retrievalError) {
      console.error("[api/chat] Retrieval failed, returning fallback:", retrievalError);
    }

    const confidence = scoreConfidenceFromChunks(chunks);
    const sources = dedupeSources(chunks).map((source) => ({
      source_id: source.sourceId,
      citation: source.citation,
      document_title: source.documentTitle,
      document_url: source.documentUrl,
      section: source.section,
      date: source.date,
      page_number: source.pageNumber,
    }));

    if (chunks.length === 0) {
      return staticStreamResponse({
        text: [
          "I'm not sure about that one. Your best bet is to call Town Hall at (781) 455-7500 — they'll know right away or can point you to the right department.",
          "You can also try asking me about permits, zoning, the Transfer Station, schools, taxes, or other town services.",
        ].join("\n\n"),
        confidence,
        sources,
        responseId,
      });
    }

    // Read configured chat model from town config
    let chatModel = DEFAULT_CHAT_MODEL;
    try {
      const supabase = getSupabaseClient({ townId });
      const { data } = await supabase
        .from("towns")
        .select("config")
        .eq("id", townId)
        .single();
      const config = (data?.config as Record<string, unknown>) ?? {};
      if (typeof config.chat_model === "string" && ALLOWED_MODELS.has(config.chat_model)) {
        chatModel = config.chat_model;
      }
    } catch {
      // Fall through to default model
    }

    const systemPrompt = buildChatSystemPrompt({
      contextDocuments: buildContextDocuments(chunks),
      includeDisclaimer,
    });

    const result = streamText({
      model: openai(chatModel),
      system: systemPrompt,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    // Fire-and-forget: log token usage and cost after streaming completes
    Promise.resolve(result.usage).then((usage) => {
      const prompt = usage.inputTokens ?? 0;
      const completion = usage.outputTokens ?? 0;
      const total = usage.totalTokens ?? (prompt + completion);
      trackCost({
        townId,
        endpoint: "chat",
        model: chatModel,
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: total,
        metadata: {
          question_length: latestUserMessage.content.length,
          source_count: sources.length,
          confidence_level: confidence.level,
        },
      }).catch((err) => console.error("[api/chat] cost tracking error:", err));
    }).catch((err) => console.error("[api/chat] usage retrieval error:", err));

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({
          type: "data-confidence",
          data: confidence,
          transient: true,
        });
        writer.write({
          type: "data-sources",
          data: sources,
          transient: true,
        });
        writer.write({
          type: "data-response-id",
          data: responseId,
          transient: true,
        });
        writer.merge(
          result.toUIMessageStream({
            sendSources: true,
          })
        );
      },
      onError: () =>
        "Something went wrong while generating the answer. Please try again.",
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/chat] Error:", error);
    const message =
      error instanceof Error ? error.message : "Unexpected chat API error.";
    return Response.json(
      {
        error:
          "Unable to process this question right now. Please try again in a moment.",
        details: message,
      },
      { status: 500 }
    );
  }
}
