"use client";

import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { FloatingChat, type FloatingChatHandle } from "@/components/search/FloatingChat";
import { useChatWidget } from "@/lib/chat-context";

interface FloatingChatWrapperProps {
  townId: string;
  assistantName?: string;
}

/**
 * Wrapper component that mounts the FloatingChat and registers it with ChatContext.
 * Automatically hides on the /chat page to avoid conflicts with the old chat UI.
 */
export function FloatingChatWrapper({ townId, assistantName }: FloatingChatWrapperProps) {
  const pathname = usePathname();
  const { registerChatWidget } = useChatWidget();
  const chatRef = useRef<FloatingChatHandle>(null);

  useEffect(() => {
    registerChatWidget(chatRef.current);
  }, [registerChatWidget]);

  // Don't show the floating chat on the old /chat page
  const isOnChatPage = pathname?.endsWith("/chat");
  if (isOnChatPage) {
    return null;
  }

  return <FloatingChat ref={chatRef} townId={townId} assistantName={assistantName} />;
}
