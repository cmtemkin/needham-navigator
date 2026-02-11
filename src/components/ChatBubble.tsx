"use client";

import { SourceChip } from "./SourceChip";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { MockSource } from "@/lib/mock-data";

export interface ChatMessage {
  id: string;
  role: "user" | "ai" | "typing";
  text: string;
  sources?: MockSource[];
  confidence?: "high" | "medium" | "low";
  followups?: string[];
}

interface ChatBubbleProps {
  message: ChatMessage;
  onFollowupClick?: (question: string) => void;
}

export function ChatBubble({ message, onFollowupClick }: ChatBubbleProps) {
  if (message.role === "typing") {
    return (
      <div
        className="flex gap-2.5 justify-start animate-msg-in"
        role="status"
        aria-live="polite"
      >
        <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xs font-extrabold shrink-0 mt-0.5">
          N
        </div>
        <div className="bg-white border border-border-light rounded-2xl rounded-bl-md px-[18px] py-3.5 shadow-xs">
          <TypingDots />
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-msg-in">
        <div className="max-w-[90%] sm:max-w-[80%] bg-primary text-white px-[18px] py-3.5 rounded-2xl rounded-br-md text-[14.5px] leading-relaxed">
          {message.text}
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-2.5 justify-start animate-msg-in">
      <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xs font-extrabold shrink-0 mt-0.5">
        N
      </div>
      <div>
        <div className="max-w-[92%] sm:max-w-[80%] bg-white border border-border-light rounded-2xl rounded-bl-md px-[18px] py-3.5 shadow-xs text-[14.5px] text-text-primary leading-relaxed">
          {/* Render markdown-like text */}
          <div
            className="prose-sm [&_strong]:font-bold [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.text) }}
          />

          {/* Source chips */}
          {message.sources && message.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {message.sources.map((source, i) => (
                <SourceChip key={i} source={source} />
              ))}
            </div>
          )}

          {/* Confidence badge */}
          {message.confidence && (
            <ConfidenceBadge level={message.confidence} />
          )}

          {/* Follow-up suggestions */}
          {message.followups && message.followups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3.5">
              {message.followups.map((followup) => (
                <button
                  key={followup}
                    onClick={() => onFollowupClick?.(followup)}
                    className="px-3.5 py-[7px] bg-white border border-border-default rounded-[20px] text-[12.5px] text-text-secondary font-medium hover:border-primary hover:text-primary hover:bg-[#F5F8FC] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {followup}
                  </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="inline-flex gap-1 items-center py-1">
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-blink" />
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-blink [animation-delay:0.2s]" />
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-blink [animation-delay:0.4s]" />
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n- /g, "\n<li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
