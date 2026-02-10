"use client";

import { chatWelcomeSuggestions } from "@/lib/mock-data";

interface ChatWelcomeProps {
  onSuggestionClick: (question: string) => void;
}

export function ChatWelcome({ onSuggestionClick }: ChatWelcomeProps) {
  return (
    <div className="flex flex-col items-center pt-8 pb-4 px-4">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-extrabold text-xl mb-3">
        N
      </div>
      <h3 className="text-lg font-bold text-text-primary mb-1.5">
        Hi! I&apos;m Needham Navigator
      </h3>
      <p className="text-sm text-text-secondary max-w-[360px] text-center leading-relaxed mb-5">
        Ask me anything about Needham town services, permits, schools, zoning,
        and more.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {chatWelcomeSuggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.question)}
            className="px-4 py-[9px] bg-white border border-border-default rounded-3xl text-[13px] text-text-primary font-medium hover:border-primary hover:text-primary hover:bg-[#F5F8FC] hover:-translate-y-px transition-all cursor-pointer"
          >
            {suggestion.icon} {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
