"use client";

import { Bot, Check, MessageCircle, Sparkles } from "lucide-react";
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
      sources: { title: string; url: string }[];
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

export function AIAnswerCard(props: AIAnswerCardProps) {
  // State: Loading
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

        {/* Animated progress bar */}
        <div className="w-full h-1 bg-white/60 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] rounded-full animate-progress" />
        </div>
      </div>
    );
  }

  // State: Prompt (opt-in)
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

  // State: Cached (instant)
  if (props.state === "cached") {
    return (
      <div className="bg-gradient-to-br from-[#EBF5FF] to-[#F0F9FF] border border-[#BAE6FF] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot size={18} className="text-[var(--primary)]" />
          <span className="text-[14px] font-semibold text-[var(--primary)]">
            AI Answer
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/10 text-success text-[11px] font-semibold rounded-full ml-auto">
            <Check size={12} />
            Instant
          </span>
        </div>

        {/* Rendered answer HTML */}
        <div
          className="text-[14px] text-text-primary leading-relaxed mb-4 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_li]:my-1"
          dangerouslySetInnerHTML={{ __html: props.answer.answer_html }}
        />

        {/* Source pills */}
        {props.answer.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {props.answer.sources.map((source) => (
              <SourceChip key={source.url ?? source.title} source={source} />
            ))}
          </div>
        )}

        {/* Ask follow-up button */}
        <button
          onClick={() => props.onFollowUp("Can you tell me more about this?")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BAE6FF] text-[var(--primary)] text-[12px] font-medium rounded-md hover:bg-[#F0F9FF] transition-colors"
        >
          <MessageCircle size={12} />
          Ask follow-up
        </button>
      </div>
    );
  }

  // State: Loaded (streamed in)
  return (
    <div className="bg-gradient-to-br from-[#EBF5FF] to-[#F0F9FF] border border-[#BAE6FF] rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Bot size={18} className="text-[var(--primary)]" />
        <span className="text-[14px] font-semibold text-[var(--primary)]">
          AI Answer
        </span>
      </div>

      {/* Rendered answer HTML */}
      <div
        className="text-[14px] text-text-primary leading-relaxed mb-4 [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3 [&_li]:my-1"
        dangerouslySetInnerHTML={{ __html: props.answerHtml }}
      />

      {/* Source pills */}
      {props.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {props.sources.map((source) => (
            <SourceChip key={source.url ?? source.title} source={source} />
          ))}
        </div>
      )}

      {/* Ask follow-up button */}
      <button
        onClick={() => props.onFollowUp("Can you tell me more about this?")}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BAE6FF] text-[var(--primary)] text-[12px] font-medium rounded-md hover:bg-[#F0F9FF] transition-colors"
      >
        <MessageCircle size={12} />
        Ask follow-up
      </button>
    </div>
  );
}
