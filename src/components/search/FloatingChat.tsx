"use client";

import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { parseStreamResponse } from "@/lib/stream-parser";
import type { MockSource } from "@/lib/mock-data";

export interface FloatingChatHandle {
  openWithMessage: (message: string) => void;
}

interface FloatingChatProps {
  townId: string;
  initialMessage?: string;
}

const SUGGESTION_CHIPS = [
  "When is the transfer station open?",
  "How do I apply for a building permit?",
  "What are the school enrollment deadlines?",
];

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const FloatingChat = forwardRef<FloatingChatHandle, FloatingChatProps>(
  ({ townId, initialMessage }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef(generateSessionId());
    const hasProcessedInitial = useRef(false);

    const scrollToBottom = useCallback(() => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 50);
    }, []);

    const sendMessage = useCallback(
      async (text: string) => {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsTyping(true);
        scrollToBottom();

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: text }],
              town_id: townId,
            }),
          });

          if (!response.ok) {
            throw new Error("API request failed");
          }

          let fullText = "";
          let confidence: "high" | "medium" | "low" | undefined;
          let sources: MockSource[] = [];

          await parseStreamResponse(response, {
            onText: (delta) => {
              fullText += delta;
              // Optionally update UI incrementally here
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
                followups: [],
              };
              setMessages((prev) => [...prev, aiMessage]);
              setIsTyping(false);
              scrollToBottom();
            },
            onError: (error) => {
              console.error("Chat stream error:", error);
              const errorMessage: ChatMessage = {
                id: `ai-${Date.now()}`,
                role: "ai",
                text: "Sorry, I encountered an error processing your request.",
              };
              setMessages((prev) => [...prev, errorMessage]);
              setIsTyping(false);
              scrollToBottom();
            },
          });
        } catch (error) {
          console.error("Chat API error:", error);
          const errorMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "ai",
            text: "Sorry, I couldn't connect to the chat service.",
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsTyping(false);
          scrollToBottom();
        }
      },
      [townId, scrollToBottom]
    );

    const handleSend = useCallback(() => {
      const trimmed = inputValue.trim();
      if (!trimmed || isTyping) return;

      sendMessage(trimmed);
      setInputValue("");
    }, [inputValue, isTyping, sendMessage]);

    const openWithMessage = useCallback(
      (message: string) => {
        setIsOpen(true);
        // Wait for panel to open, then send
        setTimeout(() => {
          sendMessage(message);
        }, 100);
      },
      [sendMessage]
    );

    useImperativeHandle(ref, () => ({
      openWithMessage,
    }));

    // Handle initial message
    useEffect(() => {
      if (initialMessage && !hasProcessedInitial.current) {
        hasProcessedInitial.current = true;
        openWithMessage(initialMessage);
      }
    }, [initialMessage, openWithMessage]);

    // Auto-scroll on new messages
    useEffect(() => {
      scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    return (
      <>
        {/* FAB Button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--primary)] text-white rounded-2xl shadow-lg hover:scale-105 hover:shadow-xl transition-all z-50 flex items-center justify-center"
            aria-label="Open chat"
          >
            <MessageCircle size={24} />
          </button>
        )}

        {/* Chat Panel */}
        {isOpen && (
          <div className="fixed bottom-6 right-6 w-full max-w-[400px] h-[540px] bg-white rounded-2xl shadow-2xl border border-border-default z-50 flex flex-col transition-all animate-slide-up sm:max-w-[400px] max-sm:left-2 max-sm:right-2 max-sm:w-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--primary)] text-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">Needham AI Assistant</span>
                <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-white/20 transition-colors flex items-center justify-center"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-surface">
              {messages.length === 0 && !isTyping ? (
                <div className="flex flex-col gap-3 mt-4">
                  <p className="text-[13px] text-text-secondary text-center mb-2">
                    Ask me anything about Needham:
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => sendMessage(chip)}
                        className="px-3 py-2 bg-white border border-border-default rounded-lg text-[13px] text-text-secondary hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[#F5F8FC] transition-all text-left"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      onFollowupClick={sendMessage}
                      sessionId={sessionIdRef.current}
                    />
                  ))}
                  {isTyping && (
                    <ChatBubble message={{ id: "typing", role: "typing", text: "" }} />
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 border-t border-border-light bg-white rounded-b-2xl">
              <div className="flex items-center bg-surface border border-border-default rounded-lg p-1 pl-3 focus-within:border-[var(--primary)] focus-within:shadow-sm transition-all">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type your question..."
                  disabled={isTyping}
                  className="flex-1 border-none bg-transparent outline-none text-[14px] text-text-primary py-2 placeholder:text-text-muted disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={isTyping || !inputValue.trim()}
                  className="w-9 h-9 rounded-md bg-[var(--primary)] text-white flex items-center justify-center hover:bg-[var(--primary-dark)] transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);

FloatingChat.displayName = "FloatingChat";
