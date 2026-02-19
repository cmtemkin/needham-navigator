"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";
import type { FloatingChatHandle } from "@/components/search/FloatingChat";

export interface ChatOpenContext {
  searchQuery: string;
  aiAnswer: string;
  sources: { title: string; url: string }[];
}

export type ChatOpenOptions = {
  message?: string;
  context?: ChatOpenContext;
};

interface ChatContextValue {
  /**
   * Open the chat widget and optionally send a message with search context.
   * Accepts either a string (legacy: message only) or ChatOpenOptions (with context).
   */
  openChat: (options?: ChatOpenOptions | string) => void;

  /**
   * Internal: Register the FloatingChat ref (used by ChatProvider)
   */
  registerChatWidget: (ref: FloatingChatHandle | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chatWidgetRef = useRef<FloatingChatHandle | null>(null);

  const registerChatWidget = useCallback((ref: FloatingChatHandle | null) => {
    chatWidgetRef.current = ref;
  }, []);

  const openChat = useCallback((options?: ChatOpenOptions | string) => {
    if (!chatWidgetRef.current) return;

    // Legacy support: if a string is passed, treat as message-only
    if (typeof options === "string") {
      chatWidgetRef.current.openWithMessage(options);
      return;
    }

    if (options?.context) {
      chatWidgetRef.current.openWithContext({
        message: options.message,
        context: options.context,
      });
    } else if (options?.message) {
      chatWidgetRef.current.openWithMessage(options.message);
    } else {
      chatWidgetRef.current.openWithMessage("");
    }
  }, []);

  return (
    <ChatContext.Provider value={{ openChat, registerChatWidget }}>
      {children}
    </ChatContext.Provider>
  );
}

/**
 * Hook to access the chat widget from any component
 *
 * @example
 * ```tsx
 * const { openChat } = useChatWidget();
 *
 * // Open chat with a specific message
 * openChat("Tell me about building permits");
 *
 * // Open chat with search context for follow-up
 * openChat({
 *   message: "What are the fees?",
 *   context: { searchQuery: "building permits", aiAnswer: "...", sources: [...] }
 * });
 *
 * // Or just open the chat
 * openChat();
 * ```
 */
export function useChatWidget() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatWidget must be used within ChatProvider");
  }
  return context;
}
