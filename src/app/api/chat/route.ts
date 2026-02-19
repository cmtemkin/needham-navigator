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
  hybridSearch,
  type RetrievedChunk,
} from "@/lib/rag";
import { getSupabaseClient } from "@/lib/supabase";
import { getTownById } from "@/lib/towns";
import { getCachedAnswer, setCachedAnswer } from "@/lib/answer-cache";

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

export const maxDuration = 60;

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

  const townConfig = getTownById(townId);
  const townName = townConfig?.name ?? "Your Town";
  const townHallPhone =
    townConfig?.departments.find((d) => d.name === "Town Hall")?.phone ?? "";

  const includeDisclaimer = messages.every((message) => message.role !== "assistant");
  const responseId = randomUUID();

  try {
    // Check answer cache first — skip entire RAG pipeline for cache hits
    try {
      const cached = await getCachedAnswer(latestUserMessage.content, townId);
      if (cached) {
        // Reconstruct source references from cached data
        const cachedSources = (cached.sources ?? []).map((s, i) => ({
          source_id: `S${i + 1}`,
          citation: `[${s.title}]`,
          document_title: s.title,
          document_url: s.url,
        }));

        return staticStreamResponse({
          text: cached.answer_html,
          confidence: {
            level: "high" as const,
            label: "Verified from official sources",
            color: "green" as const,
            averageSimilarity: 0.9,
            topSimilarity: 0.95,
            supportingChunks: cachedSources.length,
            reason: "Served from answer cache",
          },
          sources: cachedSources,
          responseId,
        });
      }
    } catch {
      // Cache lookup failure is non-fatal — proceed with full RAG pipeline
    }

    // Wrap retrieval in its own try/catch so embedding/Supabase failures
    // degrade gracefully to the "call Town Hall" fallback instead of a 500
    let chunks: RetrievedChunk[] = [];
    try {
      const hybridResults = await hybridSearch(latestUserMessage.content, {
        townId,
        limit: 10,
      });
      chunks = hybridResults.map((r, i) => ({
        id: r.id,
        chunkText: r.chunk_text,
        similarity: r.similarity,
        metadata: r.metadata,
        source: { ...r.source, sourceId: r.source.sourceId || `S${i + 1}` },
      }));
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
      const fallbackPhone = townHallPhone ? ` at ${townHallPhone}` : "";
      return staticStreamResponse({
        text: [
          `I don't have specific information about that topic in my indexed documents.`,
          `Your best bet is to call Town Hall${fallbackPhone} — they'll know right away or can point you to the right department.`,
          "I can help with questions about:",
          "- Permits and building requirements",
          "- Trash & recycling (Transfer Station)",
          "- Property taxes and payments",
          "- Zoning regulations",
          "- Schools and enrollment",
          "- Town meetings and elections",
          "- Recreation programs",
          "- Department contact information",
        ].join("\n\n"),
        confidence,
        sources: [], // No sources when no relevant chunks found
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
      townName,
      townHallPhone,
    });

    const result = streamText({
      model: openai(chatModel),
      system: systemPrompt,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    // Real streaming: pipe LLM tokens directly to the client as they arrive
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Send metadata immediately so the UI can render confidence + sources
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

        // Stream LLM text in real-time
        const textPartId = randomUUID();
        writer.write({ type: "text-start", id: textPartId });

        let fullText = "";
        for await (const delta of result.textStream) {
          fullText += delta;
          writer.write({ type: "text-delta", id: textPartId, delta });
        }

        writer.write({ type: "text-end", id: textPartId });

        // Post-stream: parse USED_SOURCES metadata and update sources
        let filteredSources = sources;
        const usedSourcesMatch = fullText.match(/USED_SOURCES:\s*(.+?)(?:\n|$)/i);

        if (usedSourcesMatch) {
          const usedSourcesStr = usedSourcesMatch[1].trim();
          if (usedSourcesStr.toLowerCase() === "none") {
            filteredSources = [];
          } else {
            const usedIds = new Set(
              usedSourcesStr.split(",").map((id) => id.trim().toUpperCase())
            );
            filteredSources = sources.filter((source) =>
              usedIds.has(source.source_id.toUpperCase())
            );
          }

          // Send updated (filtered) sources after USED_SOURCES parsing
          writer.write({
            type: "data-sources",
            data: filteredSources,
            transient: true,
          });
        }

        const cleanedText = fullText.replace(/USED_SOURCES:\s*.+?(?:\n|$)/gi, "").trim();

        // Fire-and-forget: log token usage and cost
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
              source_count: filteredSources.length,
              confidence_level: confidence.level,
            },
          }).catch((err) => console.error("[api/chat] cost tracking error:", err));
        }).catch((err) => console.error("[api/chat] usage retrieval error:", err));

        // Fire-and-forget: cache this answer for future requests
        setCachedAnswer(
          latestUserMessage.content,
          townId,
          cleanedText,
          filteredSources.map(s => ({ title: s.document_title, url: s.document_url ?? '' }))
        ).catch(() => {}); // silent fail
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
