"use client";

import { useI18n } from "@/lib/i18n";

interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low";
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const { t } = useI18n();

  const labels = {
    high: t("confidence.high"),
    medium: t("confidence.medium"),
    low: t("confidence.low"),
  } as const;

  const config = {
    high: {
      bg: "bg-[#ECFDF5]",
      text: "text-success",
      label: labels.high,
    },
    medium: {
      bg: "bg-[#FFFBEB]",
      text: "text-warning",
      label: labels.medium,
    },
    low: {
      bg: "bg-[#FEF3C7]",
      text: "text-orange-600",
      label: labels.low,
    },
  };

  const c = config[level];

  return (
    <div
      className={`inline-flex items-center gap-[5px] mt-2.5 px-2.5 py-1 rounded-[20px] text-[11px] font-semibold ${c.bg} ${c.text}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {c.label}
    </div>
  );
}
