"use client";

import { useState } from "react";
import { Bot, Check, MessageCircle, Send, Sparkles } from "lucide-react";
import { SourceChip } from "@/components/SourceChip";
import type { CachedAnswer } from "@/types/search";

type AIAnswerCardProps =
  | {
      state: "loading";
    }
  | {
      state: "cached";
      answer: CachedAnswer;
      onFollowUp: (question: string) => void;
    }
  | {
      state: "loaded";
      answerHtml: string;
      sources: { title: string; url: string; date?: string }[];
      onFollowUp: (question: string) => void;
    }
  | {
      state: "prompt";
      onGenerate: () => void;
    };

function LoadingDots() {
  return (
    <div className="inline-flex gap-1 items-center">
      <span className="w-1.5 h-1.5 bg-[var(--primary)] rounded-full animate-blink" />
      <span className="w-1.5 h-1.5 bg-[var(--primary)] rounded-full animate-blink [animation-delay:0.2s]" />
      <span className="w-1.5 h-1.5 bg-[var(--primary)] rounded-full animate-blink [animation-delay:0.4s]" />
    </div>
  );
}

function FollowUpInput({ onSubmit }: Readonly<{ onSubmit: (question: string) => void }>) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#BAE6FF]/50">
      <MessageCircle size={14} className="text-[var(--primary)] shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Ask a follow-up question..."
        className="flex-1 border-none bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="w-7 h-7 rounded-md bg-[var(--primary)] text-white flex items-center justify-center hover:bg-[var(--primary-dark)] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Send follow-up"
      >
        <Send size={12} />
      </button>
    </div>
  );
}

function AnswerBody({
  html,
  sources,
  onFollowUp,
  badge,
}: Readonly<{
  html: string;
  sources: { title: string; url: string; date?: string }[];
  onFollowUp: (question: string) => void;
  badge?: React.ReactNode;
}>) {
  return (
    <div className="bg-gradient-to-br from-[#EBF5FF] to-[#F0F9FF] border border-[#BAE6FF] rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Bot size={18} className="text-[var(--primary)]" />
        <span className="text-[14px] font-semibold text-[var(--primary)]">
          AI Answer
        </span>
        {badge}
      </div>

      {/* Rendered answer HTML */}
      <div
        className="text-[14px] text-text-primary leading-relaxed mb-3 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_li]:my-1"
        // nosemgrep: react-dangerouslysetinnerhtml -- server-generated AI answer HTML
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="text-[11px] text-text-muted mb-4">
        AI answers may not be current — always verify with official sources for critical decisions.
      </p>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {sources.map((source) => (
            <SourceChip key={source.url ?? source.title} source={source} />
          ))}
        </div>
      )}

      <FollowUpInput onSubmit={onFollowUp} />
    </div>
  );
}

export function AIAnswerCard(props: AIAnswerCardProps) {
  if (props.state === "loading") {
    return (
      <div className="bg-gradient-to-br from-[#EBF5FF] to-[#F0F9FF] border border-[#BAE6FF] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={18} className="text-[var(--primary)]" />
          <span className="text-[14px] font-semibold text-[var(--primary)]">
            AI Answer
          </span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-text-secondary mb-4">
          <LoadingDots />
          <span>Generating AI answer...</span>
        </div>
        <div className="w-full h-1 bg-white/60 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full animate-progress" />
        </div>
      </div>
    );
  }

  if (props.state === "prompt") {
    return (
      <div className="border-2 border-dashed border-[#BAE6FF] bg-[#F8FCFF] rounded-xl p-5 mb-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-text-primary mb-1">
              Get an AI-powered answer
            </p>
            <p className="text-[13px] text-text-secondary">
              Generate a comprehensive answer based on these documents
            </p>
          </div>
          <button
            onClick={props.onGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-[14px] font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
          >
            <Bot size={16} />
            Generate Answer
          </button>
        </div>
      </div>
    );
  }

  if (props.state === "cached") {
    return (
      <AnswerBody
        html={props.answer.answer_html}
        sources={props.answer.sources}
        onFollowUp={props.onFollowUp}
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-[11px] font-semibold rounded-full ml-auto">
            <Check size={12} />
            Instant
          </span>
        }
      />
    );
  }

  return (
    <AnswerBody
      html={props.answerHtml}
      sources={props.sources}
      onFollowUp={props.onFollowUp}
    />
  );
}
