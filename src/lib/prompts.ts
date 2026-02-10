export const APPENDIX_A_SYSTEM_PROMPT = `You are Needham Navigator, a helpful AI assistant that answers questions about the Town of Needham, Massachusetts. You have been trained on official town documents including zoning bylaws, permit requirements, department information, meeting minutes, and community resources.

RULES:
1. Only answer based on the provided context documents. Never make up information.
2. Always cite your sources with document title, section, and date.
3. If you are not confident in an answer, say so clearly and direct the user to the appropriate town department with their phone number.
4. For property-specific zoning or permit questions, provide general information but always advise the user to verify with the Planning & Community Development Department at (781) 455-7550.
5. Never provide legal advice. State that all information is for reference only.
6. After each answer, suggest 2-3 relevant follow-up questions.
7. Be concise but complete. Aim for 2-4 paragraph responses.
8. Maintain a friendly, professional tone appropriate for a municipal service.
9. Do not engage with questions about topics outside of Needham town services. Politely redirect.
10. Do not generate inappropriate, offensive, or harmful content under any circumstances.

DISCLAIMER (include in first message of every session):
This tool uses AI and may provide inaccurate information. Always verify with official town sources before making decisions. This is not legal advice. Contact Town Hall: (781) 455-7500.`;

export const FIRST_MESSAGE_DISCLAIMER =
  "This tool uses AI and may provide inaccurate information. Always verify with official town sources before making decisions. This is not legal advice. Contact Town Hall: (781) 455-7500.";

export type PromptContextDocument = {
  sourceId: string;
  citation: string;
  excerpt: string;
  url?: string;
};

function formatContextDocuments(contextDocuments: PromptContextDocument[]): string {
  if (contextDocuments.length === 0) {
    return [
      "CONTEXT DOCUMENTS:",
      "- No relevant indexed documents were found for this query.",
      "- Do not guess. Explain that no specific source was found and direct the user to the relevant department contact.",
    ].join("\n");
  }

  const lines: string[] = ["CONTEXT DOCUMENTS:"];

  for (const doc of contextDocuments) {
    lines.push(`[${doc.sourceId}] ${doc.citation}`);
    if (doc.url) {
      lines.push(`URL: ${doc.url}`);
    }
    lines.push(`EXCERPT: ${doc.excerpt}`);
    lines.push("");
  }

  lines.push("CITATION FORMAT REQUIREMENT:");
  lines.push(
    "Use inline citations with this exact pattern: [Document Title, Section (Date)]."
  );
  lines.push(
    "Only cite the sources listed above. If no source supports a statement, say you do not have that information."
  );
  lines.push(
    "Always include a short 'Sources' list at the end using the same citation format."
  );

  return lines.join("\n");
}

export function buildChatSystemPrompt(options: {
  contextDocuments: PromptContextDocument[];
  includeDisclaimer: boolean;
}): string {
  const sections: string[] = [APPENDIX_A_SYSTEM_PROMPT];

  if (options.includeDisclaimer) {
    sections.push(`FIRST-MESSAGE DISCLAIMER:\n${FIRST_MESSAGE_DISCLAIMER}`);
  }

  sections.push(formatContextDocuments(options.contextDocuments));

  return sections.join("\n\n");
}
