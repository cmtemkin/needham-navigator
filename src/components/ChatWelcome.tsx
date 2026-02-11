"use client";

import { chatWelcomeSuggestions } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n";
import { useTown } from "@/lib/town-context";

interface ChatWelcomeProps {
  onSuggestionClick: (question: string) => void;
}

export function ChatWelcome({ onSuggestionClick }: ChatWelcomeProps) {
  const town = useTown();
  const { t } = useI18n();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");
  const appName = `${shortTownName} Navigator`;

  return (
    <div className="flex flex-col items-center pt-8 pb-4 px-4">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-extrabold text-xl mb-3">
        N
      </div>
      <h3 className="text-lg font-bold text-text-primary mb-1.5">
        {t("chat.welcome_title", { app_name: appName })}
      </h3>
      <p className="text-sm text-text-secondary max-w-[360px] text-center leading-relaxed mb-5">
        {t("chat.welcome_description", { town: shortTownName })}
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {chatWelcomeSuggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            onClick={() => onSuggestionClick(suggestion.question)}
            className="px-4 py-[9px] bg-white border border-border-default rounded-3xl text-[13px] text-text-primary font-medium hover:border-primary hover:text-primary hover:bg-[#F5F8FC] hover:-translate-y-px transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {suggestion.icon} {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
