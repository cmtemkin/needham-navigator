/**
 * scripts/enrich.ts — AI document enrichment utilities
 *
 * Uses GPT-5 Nano to generate structured metadata for documents:
 * - ai_summary: 2-3 sentence plain-text summary
 * - ai_title: Clean, descriptive title
 * - ai_tags: 5-10 topic tags for search
 * - content_type: Document category classification
 *
 * This enrichment happens at ingestion time for zero latency impact on search.
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use the cheapest/fastest model available for bulk processing
// GPT-5 Nano is the ideal choice, fallback to gpt-4o-mini if not available
const ENRICHMENT_MODEL = "gpt-5-nano";

export interface EnrichmentResult {
  ai_summary: string;      // 2-3 sentence plain-text summary
  ai_title: string;        // Clean, descriptive title
  ai_tags: string[];       // 5-10 topic tags
  content_type: string;    // Document category
}

/**
 * Enrich a document with AI-generated metadata
 *
 * @param rawTitle - The original document title
 * @param rawContent - The document content (markdown or plain text)
 * @param sourceUrl - The source URL (for context)
 * @returns Enrichment metadata
 */
export async function enrichDocument(
  rawTitle: string,
  rawContent: string,
  sourceUrl: string
): Promise<EnrichmentResult> {
  try {
    const response = await openai.chat.completions.create({
      model: ENRICHMENT_MODEL,
      // Note: gpt-5-nano does not support custom temperature - uses default (1.0)
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a document enrichment system. Given a web page's title and content, generate structured metadata to improve search and discovery. Return JSON with these fields:

- "ai_summary": A clear, helpful 2-3 sentence summary of what this page is about and what information someone would find here. Write it as if describing the page to someone searching for it. Plain text, no markdown.
- "ai_title": A clean, descriptive page title. Remove any CMS suffixes (like "- CivicPlus.CMS.FAQ"), internal identifiers, or junk. If the title is already clean, keep it. Max 80 characters.
- "ai_tags": An array of 5-10 lowercase topic tags that someone might search for to find this page. Include specific topics, departments, services, and related concepts. Be generous with synonyms and related terms people might actually search.
- "content_type": Classify the page as one of: "faq", "department", "service", "form", "policy", "guide", "news", "meeting", "contact", "calendar", "other"`
        },
        {
          role: "user",
          content: `Title: ${rawTitle}\nURL: ${sourceUrl}\n\nContent (first 3000 chars):\n${rawContent.slice(0, 3000)}`
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content);

    // Validate the response structure
    if (!result.ai_summary || !result.ai_title || !Array.isArray(result.ai_tags) || !result.content_type) {
      throw new Error(`Invalid enrichment response structure: ${content}`);
    }

    return {
      ai_summary: result.ai_summary,
      ai_title: result.ai_title,
      ai_tags: result.ai_tags,
      content_type: result.content_type,
    };
  } catch (err) {
    // If enrichment fails, provide sensible defaults rather than failing the entire ingestion
    console.error(`[enrich] Error enriching document ${sourceUrl}:`, err);

    // Return minimal enrichment metadata
    return {
      ai_summary: `Information from ${rawTitle}. Visit the page for full details.`,
      ai_title: rawTitle.slice(0, 80),
      ai_tags: [],
      content_type: "other",
    };
  }
}

/**
 * Batch enrich multiple documents with rate limiting
 *
 * @param documents - Array of documents to enrich
 * @param batchSize - Number of concurrent API calls (default: 10)
 * @param delayMs - Delay between batches in ms (default: 500)
 * @returns Array of enrichment results in the same order
 */
export async function enrichDocumentsBatch(
  documents: Array<{ title: string; content: string; url: string }>,
  batchSize: number = 10,
  delayMs: number = 500
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    console.log(`[enrich] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);

    const batchResults = await Promise.all(
      batch.map((doc) => enrichDocument(doc.title, doc.content, doc.url))
    );

    results.push(...batchResults);

    // Add delay between batches to avoid rate limits
    if (i + batchSize < documents.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
