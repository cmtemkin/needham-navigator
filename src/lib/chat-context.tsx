"use client";

import { createContext, useContext, useRef, useCallback, type ReactNode } from "react";
import type { FloatingChatHandle } from "@/components/search/FloatingChat";

interface ChatContextValue {
  /**
   * Open the chat widget and optionally send a message
   */
  openChat: (message?: string) => void;

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

  const openChat = useCallback((message?: string) => {
    if (message) {
      chatWidgetRef.current?.openWithMessage(message);
    } else {
      // If no message, just open with a generic greeting
      chatWidgetRef.current?.openWithMessage("");
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
