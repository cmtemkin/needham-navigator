"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, History, Share2, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { ChatWelcome } from "@/components/ChatWelcome";
import { ChatHistory } from "@/components/ChatHistory";
import { findMockResponse } from "@/lib/mock-data";
import { useTownHref, useTown } from "@/lib/town-context";
import { useI18n } from "@/lib/i18n";
import { parseStreamResponse } from "@/lib/stream-parser";
import { trackEvent } from "@/lib/pendo";
import {
  getConversations,
  saveConversation,
  deleteConversation as deleteConvo,
  type SavedConversation,
} from "@/lib/chat-history";

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

const toolbarBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-white px-3.5 py-[7px] text-[13px] font-medium text-text-secondary transition-all hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function generateSessionId(): string {
  return `sess-${crypto.randomUUID()}`;
}

function generateConvoId(): string {
  return `convo-${crypto.randomUUID()}`;
}

/** Simple pattern matching to generate follow-up suggestion chips. */
function getFollowUpSuggestions(lastAiText: string): string[] {
  const lower = lastAiText.toLowerCase();
  const suggestions: string[] = [];

  if (lower.includes("permit") || lower.includes("building")) {
    suggestions.push(
      "What are the permit fees?",
      "How long does the permit process take?",
      "What documents do I need to apply?"
    );
  } else if (lower.includes("school") || lower.includes("enrollment") || lower.includes("student")) {
    suggestions.push(
      "How do I enroll my child?",
      "What are the school district boundaries?",
      "When does the school year start?"
    );
  } else if (lower.includes("tax") || lower.includes("assessment") || lower.includes("property")) {
    suggestions.push(
      "When are property taxes due?",
      "How do I appeal my assessment?",
      "What is the current tax rate?"
    );
  } else if (lower.includes("trash") || lower.includes("recycl") || lower.includes("waste") || lower.includes("dpw")) {
    suggestions.push(
      "What is the trash pickup schedule?",
      "What can I recycle?",
      "How do I dispose of bulk items?"
    );
  } else if (lower.includes("recreation") || lower.includes("park") || lower.includes("program")) {
    suggestions.push(
      "What programs are available?",
      "How do I register for activities?",
      "What are the park hours?"
    );
  } else if (lower.includes("zoning") || lower.includes("variance") || lower.includes("setback")) {
    suggestions.push(
      "What is my zoning district?",
      "How do I apply for a variance?",
      "What are the setback requirements?"
    );
  } else {
    suggestions.push(
      "Tell me about town services",
      "What permits do I need for a renovation?",
      "How do I contact town hall?"
    );
  }

  return suggestions.slice(0, 3);
}

function ChatLoadingFallback() {
  return (
    <div
      className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-[860px] flex-col gap-4 px-4 py-6 sm:px-6"
      aria-busy="true"
    >
      <div className="h-9 w-36 animate-pulse rounded-lg bg-surface" />
      <div className="h-24 w-full animate-pulse rounded-2xl bg-white" />
      <div className="ml-auto h-20 w-[70%] animate-pulse rounded-2xl bg-white" />
      <div className="h-24 w-[85%] animate-pulse rounded-2xl bg-white" />
      <div className="mt-auto h-16 w-full animate-pulse rounded-xl bg-white" />
    </div>
  );
}

function ChatContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentConvoId, setCurrentConvoId] = useState<string>(generateConvoId);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitial = useRef(false);
  const sessionIdRef = useRef(generateSessionId());
  const homeHref = useTownHref();
  const town = useTown();
  const { t } = useI18n();

  /** DRY helper — shared base context for all Pendo chat tracking calls. */
  const trackChatEvent = useCallback(
    (eventName: string, extras: Record<string, unknown> = {}) => {
      trackEvent(eventName, {
        town_id: town.town_id,
        session_id: sessionIdRef.current,
        interaction_surface: "full_chat_page",
        page_path: pathname,
        ...extras,
      });
    },
    [pathname, town.town_id]
  );

  // Load conversations for the history drawer
  const [conversations, setConversations] = useState<SavedConversation[]>([]);

  const refreshConversations = useCallback(() => {
    setConversations(getConversations(town.town_id));
  }, [town.town_id]);

  // Load conversations on mount
  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Auto-save conversation when messages update (after at least one AI response)
  useEffect(() => {
    const hasAiMessage = messages.some((m) => m.role === "ai");
    if (!hasAiMessage || messages.length === 0) return;

    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg?.text ?? "Untitled";
    const now = new Date().toISOString();

    saveConversation({
      id: currentConvoId,
      townId: town.town_id,
      title,
      messages,
      createdAt: now, // will be overwritten on first save, preserved on update
      updatedAt: now,
    });
    refreshConversations();
  }, [messages, currentConvoId, town.town_id, refreshConversations]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }, []);

  /** Shared handler: append AI message + track receipt. */
  const completeResponse = useCallback(
    (msg: ChatMessage, startTime: number, extras: Record<string, unknown> = {}) => {
      setMessages((prev) => [...prev, msg]);
      trackChatEvent("chat_response_received", {
        response_length: msg.text.length,
        source_count: msg.sources?.length ?? 0,
        confidence: msg.confidence,
        response_time_ms: Math.round(performance.now() - startTime),
        ...extras,
      });
    },
    [trackChatEvent]
  );

  /** Shared handler: show error + track failure. */
  const handleResponseError = useCallback(
    (stage: string, err?: unknown) => {
      if (err) console.error("Chat error:", err);
      setErrorMessage(t("chat.error_response"));
      trackChatEvent("chat_response_error", { error_stage: stage });
    },
    [t, trackChatEvent]
  );

  const callRealAPI = useCallback(
    async (question: string) => {
      const startTime = performance.now();
      setErrorMessage(null);
      setIsTyping(true);
      scrollToBottom();

      try {
        const chatBody = JSON.stringify({
          messages: [{ role: "user", content: question }],
          town_id: town.town_id,
        });
        const chatHeaders = { "Content-Type": "application/json" };
        let response = await fetch("/api/chat", {
          method: "POST",
          headers: chatHeaders,
          body: chatBody,
        });

        if (!response.ok) {
          // Retry once for cold-start timeouts
          console.warn(`/api/chat returned ${response.status}, retrying in 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
          response = await fetch("/api/chat", {
            method: "POST",
            headers: chatHeaders,
            body: chatBody,
          });
        }

        if (!response.ok) {
          throw new Error("API request failed");
        }

        let fullText = "";
        let confidence: "high" | "medium" | "low" | undefined;
        let sources: NonNullable<ChatMessage["sources"]> = [];

        await parseStreamResponse(response, {
          onText: (delta) => {
            fullText += delta;
          },
          onConfidence: (level) => {
            confidence = level;
          },
          onSources: (srcs) => {
            sources = srcs;
          },
          onDone: () => {
            completeResponse(
              { id: `ai-${crypto.randomUUID().slice(0, 8)}`, role: "ai", text: fullText || "No response received.", sources, confidence, followups: [] },
              startTime
            );
          },
          onError: (error) => handleResponseError("stream", error),
        });
      } catch (error) {
        handleResponseError("request", error);
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [completeResponse, handleResponseError, scrollToBottom, town.town_id]
  );

  const simulateMockResponse = useCallback(
    (question: string) => {
      const startTime = performance.now();
      setErrorMessage(null);
      setIsTyping(true);
      scrollToBottom();

      const delay = 900 + (crypto.getRandomValues(new Uint8Array(1))[0] / 255) * 700;
      setTimeout(() => {
        try {
          const response = findMockResponse(question);
          completeResponse(
            { id: `ai-${crypto.randomUUID().slice(0, 8)}`, role: "ai", text: response.text, sources: response.sources, confidence: response.confidence, followups: response.followups },
            startTime,
            { mock_mode: true }
          );
        } catch {
          handleResponseError("mock");
        } finally {
          setIsTyping(false);
          scrollToBottom();
        }
      }, delay);
    },
    [completeResponse, handleResponseError, scrollToBottom]
  );

  const handleResponse = USE_MOCK_DATA ? simulateMockResponse : callRealAPI;

  const handleSend = useCallback(
    (text: string) => {
      trackChatEvent("chat_message_sent", {
        message_length: text.length,
        is_from_search: initialQuery === text,
      });

      const userMessage: ChatMessage = {
        id: `user-${crypto.randomUUID().slice(0, 8)}`,
        role: "user",
        text,
      };
      setMessages((prev) => [...prev, userMessage]);
      scrollToBottom();
      handleResponse(text);
    },
    [handleResponse, initialQuery, pathname, scrollToBottom, town.town_id]
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setErrorMessage(null);
    sessionIdRef.current = generateSessionId();
    setCurrentConvoId(generateConvoId());
    hasProcessedInitial.current = true; // prevent re-processing ?q= param
    trackChatEvent("chat_new_started");
  }, [pathname, town.town_id]);

  const handleRestoreConversation = useCallback(
    (convo: SavedConversation) => {
      setMessages(convo.messages);
      setCurrentConvoId(convo.id);
      sessionIdRef.current = generateSessionId();
      setErrorMessage(null);
      hasProcessedInitial.current = true; // prevent re-processing ?q= param
      trackChatEvent("chat_history_restored", {
        restored_message_count: convo.messages.length,
      });
      scrollToBottom();
    },
    [pathname, scrollToBottom, town.town_id]
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConvo(id);
      refreshConversations();
      // If deleting the current conversation, start a new one
      if (id === currentConvoId) {
        handleNewChat();
      }
    },
    [currentConvoId, handleNewChat, refreshConversations]
  );

  const handleShare = useCallback(async () => {
    const formatted = messages
      .filter((m) => m.role === "user" || m.role === "ai")
      .map((m) => {
        if (m.role === "user") {
          return `Q: ${m.text}`;
        }
        let block = `A: ${m.text}`;
        if (m.sources && m.sources.length > 0) {
          const sourceList = m.sources
            .map((s) => `  - ${s.title}${s.url ? ` (${s.url})` : ""}`)
            .join("\n");
          block += `\nSources:\n${sourceList}`;
        }
        return block;
      })
      .join("\n---\n");

    const shareText = `${formatted}\n---\nShared from Needham Navigator`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      trackChatEvent("chat_shared", { message_count: messages.length });
    } catch {
      // Fallback: do nothing if clipboard API is unavailable
    }
  }, [messages, pathname, town.town_id]);

  useEffect(() => {
    trackChatEvent("chat_page_viewed", {
      initial_query_present: Boolean(initialQuery),
    });
  }, [initialQuery, trackChatEvent]);

  useEffect(() => {
    if (initialQuery && !hasProcessedInitial.current) {
      hasProcessedInitial.current = true;
      handleSend(initialQuery);
    }
  }, [initialQuery, handleSend]);

  const showWelcome = messages.length === 0 && !isTyping;

  // Compute follow-up suggestions from the last AI message
  const followUpSuggestions = useMemo(() => {
    if (isTyping || messages.length === 0) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "ai") return [];
    // If the message already has followups from the API/mock, use those
    if (lastMsg.followups && lastMsg.followups.length > 0) return [];
    return getFollowUpSuggestions(lastMsg.text);
  }, [messages, isTyping]);

  const hasMessages = messages.some((m) => m.role === "user" || m.role === "ai");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-[860px] flex-col">
      {/* History drawer */}
      <ChatHistory
        open={historyOpen}
        conversations={conversations}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleRestoreConversation}
        onDelete={handleDeleteConversation}
      />

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
        <Link href={homeHref} className={toolbarBtnCls}>
          <ChevronLeft size={14} aria-hidden="true" />
          {t("chat.back_home")}
        </Link>

        <button onClick={handleNewChat} className={toolbarBtnCls}>
          <Plus size={14} aria-hidden="true" />
          {t("chat.new_chat")}
        </button>

        <button onClick={() => setHistoryOpen(true)} className={toolbarBtnCls}>
          <History size={14} aria-hidden="true" />
          {t("chat.history")}
        </button>

        {/* Share button — only visible when there are messages */}
        {hasMessages && (
          <button onClick={handleShare} className={`ml-auto ${toolbarBtnCls}`}>
            <Share2 size={14} aria-hidden="true" />
            {copyFeedback ? t("chat.copied") : t("chat.share")}
          </button>
        )}
      </div>

      <div
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6 sm:px-6 sm:pb-4"
        aria-live="polite"
      >
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-[#FFF7ED] px-3 py-2 text-sm text-warning">
            <AlertTriangle size={16} aria-hidden="true" />
            {errorMessage}
          </div>
        )}

        {showWelcome ? (
          <ChatWelcome onSuggestionClick={handleSend} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} onFollowupClick={handleSend} sessionId={sessionIdRef.current} />
            ))}

            {/* Follow-up suggestion chips (shown after last AI message when no built-in followups) */}
            {followUpSuggestions.length > 0 && (
              <div className="ml-[42px]">
                <p className="mb-2 text-[12px] font-medium text-text-muted">
                  {t("chat.suggested_questions")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {followUpSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="px-3.5 py-[7px] bg-white border border-border-default rounded-[20px] text-[12.5px] text-text-secondary font-medium hover:border-primary hover:text-primary hover:bg-[#F5F8FC] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isTyping && (
              <ChatBubble message={{ id: "typing", role: "typing", text: "" }} />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <ChatInput disabled={isTyping} onSend={handleSend} />
    </div>
  );
}

export function TownChatPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<ChatLoadingFallback />}>
        <ChatContent />
      </Suspense>
    </>
  );
}
