interface ConfidenceBadgeProps {
  level: "high" | "medium" | "low";
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const config = {
    high: {
      bg: "bg-[#ECFDF5]",
      text: "text-success",
      label: "High confidence",
    },
    medium: {
      bg: "bg-[#FFFBEB]",
      text: "text-warning",
      label: "Medium confidence",
    },
    low: {
      bg: "bg-[#FEF3C7]",
      text: "text-orange-600",
      label: "Low confidence",
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
