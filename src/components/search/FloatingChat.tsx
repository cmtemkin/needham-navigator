"use client";

import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { MessageCircle, X, Send, Maximize2, Minimize2 } from "lucide-react";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { parseStreamResponse } from "@/lib/stream-parser";
import type { MockSource } from "@/lib/mock-data";
import { trackEvent } from "@/lib/pendo";

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
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef(generateSessionId());
    const hasProcessedInitial = useRef(false);
    const latestAiMessageIdRef = useRef<string | null>(null);

    const scrollToLatestAiMessage = useCallback(() => {
      if (!latestAiMessageIdRef.current || !messagesContainerRef.current) return;

      requestAnimationFrame(() => {
        const messageElement = messagesContainerRef.current?.querySelector(
          `[data-message-id="${latestAiMessageIdRef.current}"]`
        );
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }, []);

    const sendMessage = useCallback(
      async (text: string, options?: { isFromSearch?: boolean }) => {
        const startTime = Date.now();
        const isFromSearch = options?.isFromSearch ?? false;

        trackEvent('chat_message_sent', {
          message_length: text.length,
          town_id: townId,
          is_from_search: isFromSearch,
        });

        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          text,
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsTyping(true);

        try {
          // Build conversation history, filtering out typing messages
          const conversationHistory = messages
            .filter((msg) => msg.role !== "typing")
            .map((msg) => ({
              role: msg.role === "ai" ? "assistant" : msg.role,
              content: msg.text,
            }));

          // Add the new user message
          conversationHistory.push({ role: "user", content: text });

          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: conversationHistory,
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
              const aiMessageId = `ai-${Date.now()}`;
              const aiMessage: ChatMessage = {
                id: aiMessageId,
                role: "ai",
                text: fullText || "No response received.",
                sources,
                confidence,
                followups: [],
              };
              latestAiMessageIdRef.current = aiMessageId;
              setMessages((prev) => [...prev, aiMessage]);
              setIsTyping(false);
              scrollToLatestAiMessage();

              trackEvent('chat_response_received', {
                response_length: fullText.length,
                source_count: sources.length,
                confidence,
                response_time_ms: Date.now() - startTime,
                town_id: townId,
              });
            },
            onError: (error) => {
              console.error("Chat stream error:", error);
              const errorMessageId = `ai-${Date.now()}`;
              const errorMessage: ChatMessage = {
                id: errorMessageId,
                role: "ai",
                text: "Sorry, I encountered an error processing your request.",
              };
              latestAiMessageIdRef.current = errorMessageId;
              setMessages((prev) => [...prev, errorMessage]);
              setIsTyping(false);
              scrollToLatestAiMessage();
            },
          });
        } catch (error) {
          console.error("Chat API error:", error);
          const errorMessageId = `ai-${Date.now()}`;
          const errorMessage: ChatMessage = {
            id: errorMessageId,
            role: "ai",
            text: "Sorry, I couldn't connect to the chat service.",
          };
          latestAiMessageIdRef.current = errorMessageId;
          setMessages((prev) => [...prev, errorMessage]);
          setIsTyping(false);
          scrollToLatestAiMessage();
        }
      },
      [townId, messages, scrollToLatestAiMessage]
    );

    const handleSend = useCallback(() => {
      const trimmed = inputValue.trim();
      if (!trimmed || isTyping) return;

      sendMessage(trimmed);
      setInputValue("");
    }, [inputValue, isTyping, sendMessage]);

    const openWithMessage = useCallback(
      (message: string) => {
        trackEvent('chat_opened_from_search', {
          message_length: message.length,
          town_id: townId,
        });

        setIsOpen(true);
        // Wait for panel to open, then send
        setTimeout(() => {
          sendMessage(message, { isFromSearch: true });
        }, 100);
      },
      [sendMessage, townId]
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

    return (
      <>
        {/* FAB Button */}
        {!isOpen && (
          <button
            onClick={() => {
              trackEvent('chat_opened', { town_id: townId });
              setIsOpen(true);
            }}
            className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--primary)] text-white rounded-2xl shadow-lg hover:scale-105 hover:shadow-xl transition-all z-50 flex items-center justify-center"
            aria-label="Open chat"
            data-pendo="chat-fab"
          >
            <MessageCircle size={24} />
          </button>
        )}

        {/* Backdrop overlay (expanded mode only) */}
        {isOpen && isExpanded && (
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setIsExpanded(false)}
          />
        )}

        {/* Chat Panel */}
        {isOpen && (
          <div
            className={`
              fixed bg-white rounded-2xl shadow-2xl border border-border-default flex flex-col transition-all animate-slide-up
              ${
                isExpanded
                  ? "inset-4 sm:inset-8 max-w-[900px] mx-auto h-[calc(100vh-2rem)] sm:h-[calc(100vh-4rem)] z-50 max-sm:inset-0 max-sm:rounded-none"
                  : "bottom-6 right-6 w-full max-w-[400px] h-[540px] z-50 sm:max-w-[400px] max-sm:left-2 max-sm:right-2 max-sm:w-auto"
              }
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--primary)] text-white rounded-t-2xl max-sm:rounded-t-none">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">Needham AI Assistant</span>
                <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-7 h-7 rounded-md hover:bg-white/20 transition-colors flex items-center justify-center"
                  aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
                >
                  {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button
                  onClick={() => {
                    trackEvent('chat_closed', {
                      messages_in_session: messages.length,
                      town_id: townId,
                    });
                    setIsOpen(false);
                    setIsExpanded(false);
                  }}
                  className="w-7 h-7 rounded-md hover:bg-white/20 transition-colors flex items-center justify-center"
                  aria-label="Close chat"
                  data-pendo="chat-close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              className={`flex-1 overflow-y-auto bg-surface space-y-4 ${
                isExpanded ? "px-8 py-6" : "px-4 py-4"
              }`}
            >
              {messages.length === 0 && !isTyping ? (
                <div className="flex flex-col gap-4 mt-4">
                  <p className="text-[15px] text-text-primary text-center">
                    👋 Hi! I&apos;m your Needham AI assistant. Ask me anything about town
                    services, permits, schools, and more.
                  </p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => {
                          trackEvent('suggestion_chip_clicked', {
                            chip,
                            town_id: townId,
                          });
                          sendMessage(chip);
                        }}
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
                    <div className="flex gap-2.5 justify-start animate-msg-in">
                      <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xs font-extrabold shrink-0 mt-0.5">
                        N
                      </div>
                      <div className="bg-white border border-border-light rounded-2xl rounded-bl-md px-[18px] py-3.5 shadow-xs flex items-center gap-2">
                        <div className="inline-flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-blink" />
                          <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-blink [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-blink [animation-delay:0.4s]" />
                        </div>
                        <span className="text-[13px] text-text-secondary">
                          Needham AI is thinking...
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Input Area */}
            <div
              className={`border-t border-border-light bg-white rounded-b-2xl max-sm:rounded-b-none ${
                isExpanded ? "px-8 py-4" : "px-4 py-3"
              }`}
            >
              <p className="text-[11px] text-text-muted text-center mb-2">
                Powered by AI · Answers sourced from official town documents
              </p>
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
                  data-pendo="chat-send"
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
