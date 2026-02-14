"use client";

import { SourceChip } from "./SourceChip";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FeedbackButtons } from "./FeedbackButtons";
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
  sessionId?: string;
}

export function ChatBubble({ message, onFollowupClick, sessionId }: ChatBubbleProps) {
  if (message.role === "typing") {
    return (
      <div
        className="flex gap-2.5 justify-start animate-msg-in"
        role="status"
        aria-live="polite"
        data-message-id={message.id}
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
      <div className="flex justify-end animate-msg-in" data-message-id={message.id}>
        <div className="max-w-[90%] sm:max-w-[80%] bg-primary text-white px-[18px] py-3.5 rounded-2xl rounded-br-md text-[14.5px] leading-relaxed">
          {message.text}
        </div>
      </div>
    );
  }

  // AI message
  return (
    <div className="flex gap-2.5 justify-start animate-msg-in" data-message-id={message.id}>
      <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xs font-extrabold shrink-0 mt-0.5">
        N
      </div>
      <div>
        <div className="max-w-[92%] sm:max-w-[80%] bg-white border border-border-light rounded-2xl rounded-bl-md px-[18px] py-3.5 shadow-xs text-[14.5px] text-text-primary leading-relaxed">
          {/* Render markdown-like text */}
          <div
            className={[
              "leading-7",
              "[&_strong]:font-semibold",
              "[&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
              "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-[1.625em]",
              "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-[1.625em]",
              "[&_li]:my-2 [&_li]:pl-1.5",
              "[&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-primary/60",
              "[&_ul_ul]:my-2 [&_ol_ol]:my-2 [&_ul_ol]:my-2 [&_ol_ul]:my-2",
            ].join(" ")}
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.text) }}
          />

          {/* Source chips */}
          {message.sources && message.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 sm:flex-wrap overflow-x-auto scrollbar-hide">
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

          {/* Feedback */}
          <FeedbackButtons responseId={message.id} sessionId={sessionId} />
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
  // Inline formatting first (before line-level processing)
  const processed = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\((\d{3})\)\s*(\d{3})-(\d{4})/g,
      '<a href="tel:+1$1$2$3">($1) $2-$3</a>'
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

  // Process block-level elements line by line
  const lines = processed.split("\n");
  const output: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let olItemCount = 0; // Track numbered items so we can resume after bullet interruptions

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/);
    const numberedMatch = line.match(/^\s*\d+[.)]\s+(.+)/);

    if (bulletMatch) {
      if (inList !== "ul") {
        if (inList) output.push(`</${inList}>`);
        output.push("<ul>");
        inList = "ul";
      }
      output.push(`<li>${bulletMatch[1]}</li>`);
    } else if (numberedMatch) {
      if (inList !== "ol") {
        if (inList) output.push(`</${inList}>`);
        // Resume numbering if this is a continuation after a bullet interruption
        const startAttr = olItemCount > 0 ? ` start="${olItemCount + 1}"` : "";
        output.push(`<ol${startAttr}>`);
        inList = "ol";
      }
      olItemCount++;
      output.push(`<li>${numberedMatch[1]}</li>`);
    } else {
      if (inList) {
        output.push(`</${inList}>`);
        inList = null;
      }
      if (line.trim() === "") {
        output.push("</p><p>");
      } else {
        output.push(line + "<br>");
      }
    }
  }

  if (inList) output.push(`</${inList}>`);

  let html = "<p>" + output.join("") + "</p>";

  // Clean up artifacts
  html = html
    .replace(/<br><\/p>/g, "</p>")
    .replace(/<p><\/p>/g, "")
    .replace(/<br>(<ul>|<ol[\s>])/g, "$1")
    .replace(/(<\/ul>|<\/ol>)<br>/g, "$1");

  return html;
}
