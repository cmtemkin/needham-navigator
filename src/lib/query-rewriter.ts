/**
 * src/lib/query-rewriter.ts — LLM-powered query rewriting for RAG retrieval
 *
 * Replaces the static synonym dictionary approach with a fast nano model
 * that rewrites natural language queries into optimized search queries.
 *
 * Benefits over static synonyms:
 * - Works for any town without per-town configuration
 * - Handles novel phrasings the dictionary can't anticipate
 * - Costs ~$0.0001/query with nano model (negligible)
 * - Adds ~200ms to query time (acceptable)
 *
 * The original query is ALWAYS used for primary search. The rewritten
 * query is used as an additional parallel search to catch docs the
 * original query might miss.
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const REWRITE_SYSTEM_PROMPT = `You are a municipal search query optimizer. Your job is to rewrite a resident's question into an ideal search query that would match official government documents.

Rules:
1. Expand informal language into formal municipal terms
2. Add relevant department names when obvious
3. Include both the informal and formal terms (e.g. "dump" → "transfer station dump trash disposal")
4. Keep the rewritten query under 40 words
5. Do NOT answer the question — only rewrite it as a search query
6. Output ONLY the rewritten query, nothing else

Examples:
- "where's the dump?" → "transfer station location address hours solid waste disposal recycling"
- "can I build a deck?" → "building permit deck construction residential zoning requirements application"
- "who do I call about a rat?" → "board of health pest control rodent complaint animal control phone number contact"
- "what are property taxes?" → "property tax rate residential tax bill assessment exemption fiscal year"
- "when is the next town meeting?" → "town meeting date schedule warrant articles annual special town meeting"
- "my kid starts school next year" → "school registration enrollment kindergarten elementary school zone district requirements"`;

export async function rewriteQuery(
  originalQuery: string,
  townName: string = "Needham"
): Promise<string | null> {
  try {
    const { text } = await generateText({
      model: openai("gpt-4.1-nano"),
      system: REWRITE_SYSTEM_PROMPT,
      prompt: `Town: ${townName}\nResident's question: "${originalQuery}"`,
      temperature: 0,
    });

    const rewritten = text.trim();

    // Sanity check: if the rewrite is empty or identical to original, skip it
    if (!rewritten || rewritten.toLowerCase() === originalQuery.toLowerCase()) {
      return null;
    }

    return rewritten;
  } catch (error) {
    // Non-critical — if rewriting fails, we still have the original query
    console.warn("[query-rewriter] Failed to rewrite query, using original:", error);
    return null;
  }
}
