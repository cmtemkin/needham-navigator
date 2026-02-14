import type { MockSource } from "@/lib/mock-data";

/**
 * Callbacks for SSE stream events
 */
export interface StreamCallbacks {
  /** Called for each text delta from the LLM */
  onText: (delta: string) => void;
  /** Called when source citations arrive */
  onSources?: (sources: MockSource[]) => void;
  /** Called when confidence data arrives */
  onConfidence?: (confidence: "high" | "medium" | "low") => void;
  /** Called when the stream completes */
  onDone?: (fullText: string) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Parse a streaming SSE response from /api/chat.
 * The Vercel AI SDK createUIMessageStream sends lines formatted as:
 * data: {"type":"text-delta","delta":"..."}
 * data: {"type":"data-sources","data":[...]}
 * data: {"type":"data-confidence","data":"high"}
 */
export async function parseStreamResponse(
  response: Response,
  callbacks: StreamCallbacks
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE data: lines from Vercel AI SDK createUIMessageStream
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === "text-delta") {
              const delta = data.delta as string;
              fullText += delta;
              callbacks.onText(delta);
            } else if (data.type === "data-confidence") {
              const level = (data.data?.level ?? data.data) as
                | "high"
                | "medium"
                | "low";
              callbacks.onConfidence?.(level);
            } else if (data.type === "data-sources") {
              // Map API source format to MockSource format used by ChatBubble
              const sources: MockSource[] = (data.data ?? []).map(
                (s: Record<string, unknown>) => ({
                  title:
                    (s.document_title as string) ??
                    (s.title as string) ??
                    "Source",
                  section: s.section as string | undefined,
                  date: s.date as string | undefined,
                  url:
                    (s.document_url as string) ??
                    (s.url as string) ??
                    undefined,
                })
              );
              callbacks.onSources?.(sources);
            }
          } catch (err) {
            // Skip invalid JSON chunks (common in SSE streams)
            console.warn("Skipping invalid JSON chunk:", err);
          }
        }
      }
    }

    callbacks.onDone?.(fullText);
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}
