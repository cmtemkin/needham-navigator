"use client";

import { useEffect, useRef } from "react";
import { History, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { SavedConversation } from "@/lib/chat-history";

interface ChatHistoryProps {
  open: boolean;
  conversations: SavedConversation[];
  onClose: () => void;
  onSelect: (conversation: SavedConversation) => void;
  onDelete: (id: string) => void;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function truncateTitle(title: string, maxLen = 50): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen).trimEnd() + "...";
}

export function ChatHistory({
  open,
  conversations,
  onClose,
  onSelect,
  onDelete,
}: Readonly<ChatHistoryProps>) {
  const { t } = useI18n();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus trap: focus the drawer when opened
  useEffect(() => {
    if (open && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("chat.history")}
        tabIndex={-1}
        className={[
          "fixed left-0 top-0 z-50 h-full w-[320px] max-w-[85vw] bg-white shadow-xl transition-transform duration-300 ease-in-out",
          "flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div className="flex items-center gap-2 text-text-primary">
            <History size={18} aria-hidden="true" />
            <span className="text-[15px] font-semibold">{t("chat.history")}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <History size={32} className="mb-3 text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{t("chat.no_history")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border-light">
              {conversations.map((convo) => (
                <li key={convo.id} className="group relative">
                  <button
                    onClick={() => {
                      onSelect(convo);
                      onClose();
                    }}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <p className="text-[13.5px] font-medium text-text-primary leading-snug">
                      {truncateTitle(convo.title)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {formatTimestamp(convo.updatedAt)}
                      {" · "}
                      {convo.messages.filter((m) => m.role === "user").length} messages
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(convo.id);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={t("chat.delete_conversation")}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
