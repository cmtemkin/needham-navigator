"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { ChatWelcome } from "@/components/ChatWelcome";
import { findMockResponse } from "@/lib/mock-data";
import { useTownHref, useTown } from "@/lib/town-context";
import { useI18n } from "@/lib/i18n";
import { parseStreamResponse } from "@/lib/stream-parser";

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitial = useRef(false);
  const sessionIdRef = useRef(generateSessionId());
  const homeHref = useTownHref();
  const town = useTown();
  const { t } = useI18n();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }, []);

  const callRealAPI = useCallback(
    async (question: string) => {
      setErrorMessage(null);
      setIsTyping(true);
      scrollToBottom();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: question }],
            town_id: town.town_id,
          }),
        });

        if (!response.ok) {
          throw new Error("API request failed");
        }

        let fullText = "";
        let confidence: "high" | "medium" | "low" | undefined;
        let sources: ChatMessage["sources"] = [];

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
            const aiMessage: ChatMessage = {
              id: `ai-${Date.now()}`,
              role: "ai",
              text: fullText || "No response received.",
              sources,
              confidence,
              followups: [], // Real API doesn't return followups yet
            };
            setMessages((prev) => [...prev, aiMessage]);
          },
          onError: (error) => {
            console.error("Chat stream error:", error);
            setErrorMessage(t("chat.error_response"));
          },
        });
      } catch (error) {
        console.error("Chat API error:", error);
        setErrorMessage(t("chat.error_response"));
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [scrollToBottom, t, town.town_id]
  );

  const simulateMockResponse = useCallback(
    (question: string) => {
      setErrorMessage(null);
      setIsTyping(true);
      scrollToBottom();

      const delay = 900 + Math.random() * 700;
      setTimeout(() => {
        try {
          const response = findMockResponse(question);
          const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "ai",
            text: response.text,
            sources: response.sources,
            confidence: response.confidence,
            followups: response.followups,
          };
          setMessages((prev) => [...prev, aiMessage]);
        } catch {
          setErrorMessage(t("chat.error_response"));
        } finally {
          setIsTyping(false);
          scrollToBottom();
        }
      }, delay);
    },
    [scrollToBottom, t]
  );

  const handleResponse = USE_MOCK_DATA ? simulateMockResponse : callRealAPI;

  const handleSend = useCallback(
    (text: string) => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text,
      };
      setMessages((prev) => [...prev, userMessage]);
      scrollToBottom();
      handleResponse(text);
    },
    [handleResponse, scrollToBottom]
  );

  useEffect(() => {
    if (initialQuery && !hasProcessedInitial.current) {
      hasProcessedInitial.current = true;
      handleSend(initialQuery);
    }
  }, [initialQuery, handleSend]);

  const showWelcome = messages.length === 0 && !isTyping;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-[860px] flex-col">
      <div className="flex items-center px-4 py-3 sm:px-6">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-white px-3.5 py-[7px] text-[13px] font-medium text-text-secondary transition-all hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t("chat.back_home")}
        </Link>
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
