import { ExternalLink } from "lucide-react";
import type { MockSource } from "@/lib/mock-data";

interface SourceChipProps {
  source: MockSource;
}

/** Sections that are CMS boilerplate and should not be displayed */
const BOILERPLATE_SECTIONS = new Set([
  "default",
  "introduction",
  "n/a",
  "section n/a",
  "note",
]);

function isBoilerplateSection(section: string | undefined): boolean {
  if (!section) return true;
  return BOILERPLATE_SECTIONS.has(section.toLowerCase().trim());
}

export function SourceChip({ source }: SourceChipProps) {
  const showSection = source.section && !isBoilerplateSection(source.section);

  const content = (
    <>
      <ExternalLink size={10} className="shrink-0" />
      <span className="truncate">{source.title}</span>
      {showSection && (
        <span className="text-text-muted truncate"> &middot; {source.section}</span>
      )}
    </>
  );

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-[5px] max-w-[260px] px-2.5 py-[5px] bg-surface border border-border-default rounded-md text-[11.5px] text-primary font-medium hover:border-primary hover:bg-[#EBF0F8] transition-all cursor-pointer no-underline"
      >
        {content}
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-[5px] max-w-[260px] px-2.5 py-[5px] bg-surface border border-border-default rounded-md text-[11.5px] text-primary font-medium">
      {content}
    </span>
  );
}
