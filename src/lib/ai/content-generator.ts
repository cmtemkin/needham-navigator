/**
 * src/lib/ai/content-generator.ts — AI content generation utilities
 *
 * Uses GPT-4o-mini to generate summaries, daily digests, and other
 * AI-authored content from ingested items.
 */

import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY for content generation");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const MODEL = "gpt-4o-mini";

/**
 * Generate a 2-sentence summary of an article.
 */
export async function summarizeArticle(
  title: string,
  content: string
): Promise<string> {
  const openai = getOpenAI();
  const truncatedContent = content.slice(0, 4000);

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a local news summarizer. Write a clear, informative 2-sentence summary of the article. Focus on the key facts. Do not editorialize.",
      },
      {
        role: "user",
        content: `Title: ${title}\n\nContent:\n${truncatedContent}`,
      },
    ],
    max_tokens: 150,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Generate a daily news digest from recent content items.
 */
export async function generateDailyDigest(
  townName: string,
  items: Array<{ title: string; summary?: string; content: string; category: string; source_id: string }>
): Promise<string> {
  if (items.length === 0) {
    return `No new stories for ${townName} today. Check back tomorrow!`;
  }

  const openai = getOpenAI();

  const itemSummaries = items
    .slice(0, 15) // cap to prevent token overflow
    .map(
      (item, i) =>
        `${i + 1}. [${item.category}] ${item.title}: ${item.summary || item.content.slice(0, 200)}`
    )
    .join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a friendly local news editor for ${townName}. Write a brief daily digest (3-4 paragraphs) summarizing the day's top stories. Be warm, conversational, and informative. Group related items together. Start with "Good morning, ${townName}!" or similar greeting.`,
      },
      {
        role: "user",
        content: `Here are today's stories:\n\n${itemSummaries}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Generate a weekend preview from upcoming events.
 */
export async function generateWeekendPreview(
  townName: string,
  events: Array<{ title: string; content: string; metadata: Record<string, unknown> }>
): Promise<string> {
  if (events.length === 0) {
    return `No events listed for this weekend in ${townName}. Know of something happening? Let us know!`;
  }

  const openai = getOpenAI();

  const eventList = events
    .slice(0, 10)
    .map((e, i) => {
      const location = e.metadata.event_location || "";
      const start = e.metadata.event_start || "";
      return `${i + 1}. ${e.title}${location ? ` at ${location}` : ""}${start ? ` (${start})` : ""}`;
    })
    .join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a friendly community events guide for ${townName}. Write a brief weekend preview (2-3 paragraphs) highlighting the most interesting upcoming events. Be enthusiastic and helpful.`,
      },
      {
        role: "user",
        content: `This weekend's events:\n\n${eventList}`,
      },
    ],
    max_tokens: 400,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
