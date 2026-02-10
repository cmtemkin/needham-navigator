"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { ChatWelcome } from "@/components/ChatWelcome";
import { findMockResponse } from "@/lib/mock-data";

function ChatContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasProcessedInitial = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  const simulateResponse = useCallback(
    (question: string) => {
      setIsTyping(true);
      scrollToBottom();

      const delay = 1200 + Math.random() * 800;
      setTimeout(() => {
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
        setIsTyping(false);
        scrollToBottom();
      }, delay);
    },
    [scrollToBottom]
  );

  const handleSend = useCallback(
    (text: string) => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text,
      };
      setMessages((prev) => [...prev, userMessage]);
      scrollToBottom();
      simulateResponse(text);
    },
    [simulateResponse, scrollToBottom]
  );

  // Process initial query from URL
  useEffect(() => {
    if (initialQuery && !hasProcessedInitial.current) {
      hasProcessedInitial.current = true;
      handleSend(initialQuery);
    }
  }, [initialQuery, handleSend]);

  const showWelcome = messages.length === 0 && !isTyping;

  return (
    <div className="max-w-[800px] mx-auto flex flex-col min-h-[calc(100vh-60px)]">
      {/* Back bar */}
      <div className="px-6 py-3 flex items-center max-sm:px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-[7px] bg-white border border-border-default rounded-lg text-[13px] font-medium text-text-secondary hover:border-primary hover:text-primary transition-all"
        >
          <ChevronLeft size={14} />
          Back to Home
        </Link>
      </div>

      {/* Messages area */}
      <div className="flex-1 px-6 pb-6 flex flex-col gap-5 overflow-y-auto max-sm:px-4 max-sm:pb-4">
        {showWelcome ? (
          <ChatWelcome onSuggestionClick={handleSend} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onFollowupClick={handleSend}
              />
            ))}
            {isTyping && (
              <ChatBubble
                message={{ id: "typing", role: "typing", text: "" }}
              />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <ChatInput onSend={handleSend} disabled={isTyping} />
    </div>
  );
}

export default function ChatPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-extrabold text-xl animate-pulse">
              N
            </div>
          </div>
        }
      >
        <ChatContent />
      </Suspense>
    </>
  );
}
