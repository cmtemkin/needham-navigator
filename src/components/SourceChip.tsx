import { FileText } from "lucide-react";
import type { MockSource } from "@/lib/mock-data";

interface SourceChipProps {
  source: MockSource;
}

export function SourceChip({ source }: SourceChipProps) {
  return (
    <span className="inline-flex items-center gap-[5px] px-2.5 py-[5px] bg-surface border border-border-default rounded-md text-[11.5px] text-primary font-medium hover:border-primary hover:bg-[#EBF0F8] transition-all cursor-pointer">
      <FileText size={10} />
      {source.title}
      {source.section && (
        <span className="text-text-muted"> &middot; {source.section}</span>
      )}
    </span>
  );
}
