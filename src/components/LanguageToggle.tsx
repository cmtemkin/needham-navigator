"use client";

import { Languages } from "lucide-react";
import { useI18n, type LanguageCode } from "@/lib/i18n";

const LANGUAGE_ORDER: LanguageCode[] = ["en", "es", "zh"];

export function LanguageToggle() {
  const { isEnabled, language, setLanguage, t } = useI18n();

  if (!isEnabled) {
    return null;
  }

  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-white px-2.5 py-1.5 text-xs font-medium text-text-secondary">
      <Languages size={13} aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        className="bg-transparent text-xs font-medium text-text-secondary outline-none focus-visible:text-primary"
      >
        {LANGUAGE_ORDER.map((code) => (
          <option key={code} value={code}>
            {t(
              code === "en"
                ? "language.english"
                : code === "es"
                  ? "language.spanish"
                  : "language.chinese"
            )}
          </option>
        ))}
      </select>
    </label>
  );
}
