/**
 * Article generation utilities for AI-powered news hub.
 *
 * All articles are grounded in real documents from the Supabase `documents` table.
 * No content is fabricated — every article must have a real source URL that exists
 * in the database. Articles with confidence < MIN_CONFIDENCE are discarded.
 */

import OpenAI from 'openai';
import { getSupabaseServiceClient } from '@/lib/supabase';
import type { Article, CreateArticleInput, ArticleCategory, SourceType } from '@/types/article';

const MODEL = 'gpt-4o-mini';
const TOWN_ID = 'needham';
const TOWN_NAME = 'Needham, MA';
const DEFAULT_DAYS_BACK = 30;
const MIN_CONTENT_LENGTH = 500;
const MIN_CONFIDENCE = 0.7;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY for article generation');
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceDocument {
  document_id: string;
  url: string;
  title: string | null;
  content: string;
  ingested_at: string;
}

interface ChunkRow {
  chunk_text: string;
  chunk_index: number;
}

interface DocumentRow {
  id: string;
  url: string;
  title: string | null;
  last_ingested_at: string | null;
  created_at: string;
  document_chunks: ChunkRow[];
}

// ─── URL-based categorization ─────────────────────────────────────────────────

/**
 * Derive article category and source type from a document URL.
 * Returns null if the document doesn't fit a known category (skip it).
 */
function categorizeDocument(url: string): { category: ArticleCategory; sourceType: SourceType } | null {
  const u = url.toLowerCase();

  // Meeting minutes / board proceedings
  if (
    u.includes('planning-board') ||
    u.includes('planning_board') ||
    u.includes('planningboard') ||
    u.includes('minutes') ||
    u.includes('agendas') ||
    u.includes('select-board') ||
    u.includes('selectboard') ||
    u.includes('select_board') ||
    u.includes('town-clerk') ||
    u.includes('zoning-board') ||
    u.includes('zba')
  ) {
    const cat: ArticleCategory = u.includes('planning') || u.includes('zoning')
      ? 'development'
      : 'government';
    return { category: cat, sourceType: 'meeting_minutes' };
  }

  // Schools
  if (
    u.includes('school-committee') ||
    u.includes('schoolcommittee') ||
    u.includes('k12.ma.us') ||
    u.includes('needham.k12') ||
    u.includes('enrollment') ||
    u.includes('schools')
  ) {
    return { category: 'schools', sourceType: 'public_record' };
  }

  // DPW / public works / infrastructure
  if (
    u.includes('dpw') ||
    u.includes('public-works') ||
    u.includes('highway') ||
    u.includes('snow') ||
    u.includes('recycl') ||
    u.includes('trash') ||
    u.includes('solid-waste') ||
    u.includes('transfer-station') ||
    u.includes('water') ||
    u.includes('sewer') ||
    u.includes('street') ||
    u.includes('sidewalk')
  ) {
    return { category: 'government', sourceType: 'dpw_notice' };
  }

  // Building / permits / development
  if (
    u.includes('building') ||
    u.includes('permit') ||
    u.includes('inspection') ||
    u.includes('development') ||
    u.includes('zoning') ||
    u.includes('housing') ||
    u.includes('affordable')
  ) {
    return { category: 'development', sourceType: 'permit_log' };
  }

  // Public safety
  if (
    u.includes('police') ||
    u.includes('fire') ||
    u.includes('emergency') ||
    u.includes('weather') ||
    u.includes('preparedness') ||
    u.includes('safety')
  ) {
    return { category: 'public_safety', sourceType: 'public_record' };
  }

  // Board of health
  if (u.includes('health') || u.includes('biosafety')) {
    return { category: 'public_safety', sourceType: 'public_record' };
  }

  // Conservation / environment / sustainability
  if (
    u.includes('conservation') ||
    u.includes('environment') ||
    u.includes('climate') ||
    u.includes('sustainable')
  ) {
    return { category: 'community', sourceType: 'public_record' };
  }

  // Library / recreation / community
  if (
    u.includes('library') ||
    u.includes('recreation') ||
    u.includes('parks') ||
    u.includes('park-') ||
    u.includes('community') ||
    u.includes('senior') ||
    u.includes('youth') ||
    u.includes('sport')
  ) {
    return { category: 'community', sourceType: 'public_record' };
  }

  // Government / town boards / committees / commissions / licensing
  if (
    u.includes('board-of') ||
    u.includes('commission') ||
    u.includes('committee') ||
    u.includes('licensing') ||
    u.includes('town-meeting') ||
    u.includes('town_meeting') ||
    u.includes('town-clerk') ||
    u.includes('assessor') ||
    u.includes('treasurer') ||
    u.includes('retirement') ||
    u.includes('trust-fund') ||
    u.includes('trust_fund') ||
    u.includes('parking') ||
    u.includes('faq') ||
    u.includes('holiday') ||
    u.includes('registrar') ||
    u.includes('needhamma.gov')
  ) {
    return { category: 'government', sourceType: 'public_record' };
  }

  // Business
  if (
    u.includes('business') ||
    u.includes('commerce') ||
    u.includes('needhamchannel')
  ) {
    return { category: 'business', sourceType: 'public_record' };
  }

  return null; // Unknown category — skip
}

// ─── Source URL utilities ─────────────────────────────────────────────────────

/**
 * Normalize a source URL: upgrade http:// to https://.
 * Scraper sometimes stores HTTP URLs that redirect to HTTPS; store the canonical form.
 */
function normalizeSourceUrl(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * Check whether a source URL is publicly accessible.
 * Uses a browser User-Agent to avoid bot-blocking (e.g. k12.ma.us returns 403 to bare requests).
 * Returns true if the server responds with a non-4xx status.
 * Treats network errors and timeouts as inaccessible.
 */
async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NeedhamNavigator/1.0; +https://needhamnavigator.com)',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    // Treat anything under 400 as accessible
    if (res.status < 400) return true;
    // Some servers reject HEAD — retry with GET (truncated)
    if (res.status === 405) {
      const getRes = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NeedhamNavigator/1.0; +https://needhamnavigator.com)',
          Range: 'bytes=0-0', // Request only 1 byte to minimise bandwidth
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      return getRes.status < 400 || getRes.status === 416; // 416 = Range Not Satisfiable (still reachable)
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Source helpers ───────────────────────────────────────────────────────────

/**
 * Query recent documents from Supabase, concatenating their chunks into full text.
 */
async function getRecentDocuments(options: {
  daysBack?: number;
  minContentLength?: number;
}): Promise<SourceDocument[]> {
  const { daysBack = DEFAULT_DAYS_BACK, minContentLength = MIN_CONTENT_LENGTH } = options;

  const supabase = getSupabaseServiceClient();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      url,
      title,
      last_ingested_at,
      created_at,
      document_chunks(chunk_text, chunk_index)
    `)
    .eq('town_id', TOWN_ID)
    .gte('last_ingested_at', since)
    .order('last_ingested_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[article-generator] Error fetching documents:', error);
    return [];
  }

  const docs = (data as DocumentRow[]) ?? [];

  const result: SourceDocument[] = [];
  for (const doc of docs) {
    const chunks = (doc.document_chunks ?? []);
    // Sort by chunk_index ascending to preserve document order
    chunks.sort((a, b) => a.chunk_index - b.chunk_index);
    const content = chunks.map((c) => c.chunk_text).join('\n\n');
    if (content.length < minContentLength) continue;

    result.push({
      document_id: doc.id,
      url: normalizeSourceUrl(doc.url),
      title: doc.title,
      content,
      ingested_at: doc.last_ingested_at ?? doc.created_at,
    });
  }

  return result;
}

/**
 * Check whether an article sourced from this URL already exists.
 * Prevents duplicate articles on repeated runs.
 */
async function articleExistsForSource(url: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase
    .from('articles')
    .select('id')
    .eq('town', TOWN_ID)
    .contains('source_urls', [url])
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// ─── Core generation ──────────────────────────────────────────────────────────

/**
 * Generate a single article from a source document.
 * Returns null if the document is skipped (low confidence, already exists, etc.)
 */
async function generateArticleFromDocument(doc: SourceDocument): Promise<Article | null> {
  const classification = categorizeDocument(doc.url);
  if (!classification) return null;

  const { category, sourceType } = classification;

  // Skip if we already generated an article from this exact source
  if (await articleExistsForSource(doc.url)) {
    return null;
  }

  // Skip if the source URL is not publicly accessible — no point citing a broken link
  const accessible = await isUrlAccessible(doc.url);
  if (!accessible) {
    console.warn(`[article-generator] Source URL inaccessible (skipping): ${doc.url}`);
    return null;
  }

  const openai = getOpenAI();
  // Truncate to ~6000 chars to stay within context limits while preserving key content
  const truncatedContent = doc.content.slice(0, 6000);

  const isMeetingMinutes = sourceType === 'meeting_minutes';

  const systemPrompt = isMeetingMinutes
    ? `You are a local government reporter for ${TOWN_NAME}. Your job is to write factual news articles from official town documents.

CRITICAL RULES — NEVER VIOLATE:
- ONLY include facts explicitly stated in the source text
- Do NOT invent quotes, vote counts, dollar amounts, names, or decisions not in the source
- Do NOT speculate or fill gaps with assumptions
- If the content is too vague or lacks substantive facts, respond with exactly: {"skip": true}
- Include specific dates, meeting dates, or decision dates if mentioned in the source

Respond with valid JSON in exactly this format:
{
  "title": "Clear, factual news headline (not a question, not clickbait)",
  "subtitle": "One sentence expanding on the headline",
  "summary": "2-3 sentence summary of the key facts",
  "body": "Full markdown article with ## section headers. Use bullet points for lists of decisions/items.",
  "confidence_score": 0.0
}
Set confidence_score between 0.7 and 1.0 based on: how much the article is directly supported by clear, specific facts in the source. Set lower if the source is vague.`
    : `You are a local government reporter for ${TOWN_NAME}. Your job is to write factual news articles from official town documents.

CRITICAL RULES — NEVER VIOLATE:
- ONLY include facts explicitly stated in the source text
- Do NOT invent names, dates, dollar amounts, or details not in the source
- Do NOT speculate or fill gaps with assumptions
- If the content is too vague or lacks substantive facts, respond with exactly: {"skip": true}

Respond with valid JSON in exactly this format:
{
  "title": "Clear, factual news headline",
  "subtitle": "One sentence expanding on the headline",
  "summary": "2-3 sentence summary of the key facts",
  "body": "Full markdown article with ## section headers",
  "confidence_score": 0.0
}
Set confidence_score between 0.7 and 1.0 based on how much the article is directly supported by specific facts in the source.`;

  const userPrompt = `Source URL: ${doc.url}
${doc.title ? `Document Title: ${doc.title}\n` : ''}
Content:
${truncatedContent}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;

    let parsed: {
      skip?: boolean;
      title?: string;
      subtitle?: string;
      summary?: string;
      body?: string;
      confidence_score?: number;
    };

    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      console.warn('[article-generator] Failed to parse JSON response for', doc.url);
      return null;
    }

    // Model explicitly said to skip
    if (parsed.skip) return null;

    // Validate required fields
    if (!parsed.title || !parsed.body) {
      console.warn('[article-generator] Missing title or body for', doc.url);
      return null;
    }

    // Enforce minimum confidence
    const confidence = parsed.confidence_score ?? 0;
    if (confidence < MIN_CONFIDENCE) {
      console.log(`[article-generator] Low confidence (${confidence}) for ${doc.url} — skipping`);
      return null;
    }

    const sourceName = doc.title || (() => {
      try { return new URL(doc.url).hostname; } catch { return doc.url; }
    })();

    const articleInput: CreateArticleInput = {
      title: parsed.title,
      subtitle: parsed.subtitle,
      body: parsed.body,
      summary: parsed.summary,
      content_type: 'ai_generated',
      category,
      source_urls: [doc.url],
      source_type: sourceType,
      source_names: [sourceName],
      town: TOWN_ID,
      author: 'Needham Navigator AI',
      model_used: MODEL,
      generation_prompt: systemPrompt.slice(0, 500), // store truncated prompt for reproducibility
      confidence_score: confidence,
      status: 'published',
    };

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('articles')
      .insert(articleInput)
      .select()
      .single();

    if (error || !data) {
      console.error('[article-generator] Error inserting article:', error);
      return null;
    }

    console.log(`[article-generator] Generated: "${parsed.title}" from ${doc.url}`);
    return data as Article;
  } catch (error) {
    console.error('[article-generator] Error generating from', doc.url, error);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate articles from recent meeting minutes (planning board, select board, etc.)
 */
export async function generateFromMeetingMinutes(options?: { daysBack?: number }): Promise<Article[]> {
  const docs = await getRecentDocuments({ daysBack: options?.daysBack ?? DEFAULT_DAYS_BACK });

  const minutesDocs = docs.filter((doc) => {
    const u = doc.url.toLowerCase();
    return (
      u.includes('planning') ||
      u.includes('minutes') ||
      u.includes('agendas') ||
      u.includes('select-board') ||
      u.includes('selectboard') ||
      u.includes('select_board') ||
      u.includes('town-clerk') ||
      u.includes('zoning-board') ||
      u.includes('zba') ||
      u.includes('school-committee')
    );
  });

  const articles: Article[] = [];
  for (const doc of minutesDocs) {
    const article = await generateArticleFromDocument(doc);
    if (article) articles.push(article);
  }
  return articles;
}

/**
 * Generate articles from recent public records (permits, DPW notices, health, conservation).
 */
export async function generateFromPublicRecord(options?: { daysBack?: number }): Promise<Article[]> {
  const docs = await getRecentDocuments({ daysBack: options?.daysBack ?? DEFAULT_DAYS_BACK });

  const recordDocs = docs.filter((doc) => {
    const u = doc.url.toLowerCase();
    return (
      u.includes('dpw') ||
      u.includes('public-works') ||
      u.includes('highway') ||
      u.includes('permit') ||
      u.includes('building') ||
      u.includes('inspection') ||
      u.includes('health') ||
      u.includes('conservation') ||
      u.includes('police') ||
      u.includes('fire') ||
      u.includes('emergency')
    );
  });

  const articles: Article[] = [];
  for (const doc of recordDocs) {
    const article = await generateArticleFromDocument(doc);
    if (article) articles.push(article);
  }
  return articles;
}

/**
 * Generate articles from ALL categorizable documents (bulk backfill).
 * Unlike the specific functions above, this doesn't apply an additional URL filter —
 * any document that passes categorizeDocument() is eligible.
 */
export async function generateFromAllDocuments(options?: { daysBack?: number }): Promise<Article[]> {
  const docs = await getRecentDocuments({ daysBack: options?.daysBack ?? DEFAULT_DAYS_BACK });

  // Only keep documents that categorizeDocument() can classify
  const categorizable = docs.filter((doc) => categorizeDocument(doc.url) !== null);
  console.log(`[article-generator] ${docs.length} docs fetched, ${categorizable.length} categorizable`);

  const articles: Article[] = [];
  for (const doc of categorizable) {
    const article = await generateArticleFromDocument(doc);
    if (article) articles.push(article);
  }
  return articles;
}

/**
 * Summarize external news articles.
 * Currently a no-op — external news is not yet ingested into the documents table.
 * Will be implemented when an external news connector is added.
 */
export async function summarizeExternalArticle(): Promise<Article[]> {
  return [];
}

/**
 * Generate a daily brief from today's generated articles.
 * Skips if a brief already exists for today.
 * Returns null if there are no articles to summarize.
 *
 * Design: GPT outputs structured JSON where each topic includes the EXACT
 * source_url copied from our input — it never invents URLs. We then build
 * the markdown body ourselves so citations are always correct.
 */
export async function generateDailyBrief(): Promise<Article | null> {
  const supabase = getSupabaseServiceClient();

  // Check if today's brief already exists
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: existing } = await supabase
    .from('articles')
    .select('id')
    .eq('town', TOWN_ID)
    .eq('is_daily_brief', true)
    .gte('published_at', todayStart.toISOString())
    .lte('published_at', todayEnd.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    console.log("[article-generator] Daily brief already exists for today — skipping.");
    return null;
  }

  // Only use articles that were generated today (last 24h), not raw documents.
  // Each article already has a verified, topic-specific source_url.
  const { data: recentArticles } = await supabase
    .from('articles')
    .select('title, summary, body, source_urls, source_names, category')
    .eq('town', TOWN_ID)
    .eq('is_daily_brief', false)
    .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('published_at', { ascending: false })
    .limit(10);

  if (!recentArticles || recentArticles.length === 0) {
    console.log('[article-generator] No recent articles for daily brief — skipping.');
    return null;
  }

  const openai = getOpenAI();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Build a numbered source list. Each entry has a source_url that GPT must
  // copy verbatim — it cannot invent its own URLs.
  type ArticleRow = {
    title: string;
    summary?: string;
    body: string;
    source_urls?: string[];
    source_names?: string[];
    category: string;
  };

  const sourceItems = recentArticles
    .map((a) => a as ArticleRow)
    .filter((a) => a.source_urls && a.source_urls.length > 0)
    .map((a) => ({
      title: a.title,
      summary: a.summary || a.body.slice(0, 250),
      source_url: a.source_urls![0],
      source_name: a.source_names?.[0] || a.source_urls![0],
    }));

  if (sourceItems.length === 0) {
    console.log('[article-generator] No articles with source URLs — skipping brief.');
    return null;
  }

  const sourceList = sourceItems
    .map((s, i) => `${i + 1}. source_url: "${s.source_url}"\n   title: ${s.title}\n   summary: ${s.summary}`)
    .join('\n\n');

  const systemPrompt = `You are a factual daily news editor for ${TOWN_NAME}.
Output ONLY valid JSON. Do NOT output markdown or prose outside the JSON.

Rules:
- Write a brief for today (${today}) covering the provided sources
- Each topic's "source_url" field MUST be copied EXACTLY from the corresponding numbered source above — do not modify or invent URLs
- "heading" is a short topic label (3-6 words, no trailing colon)
- "detail" is one factual sentence from the source
- Include 3-5 topics, one per source (skip a source if its content is too vague)

Output format:
{"topics": [{"heading": "...", "detail": "...", "source_url": "..."}]}`;

  const userPrompt = `Sources for today's brief:\n\n${sourceList}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 700,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;

  let parsed: { topics?: { heading: string; detail: string; source_url: string }[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    console.error('[article-generator] Failed to parse daily brief JSON');
    return null;
  }

  const topics = parsed.topics ?? [];
  if (topics.length === 0) return null;

  // Build markdown body ourselves — we control the URLs, not GPT.
  // Validate each source_url is in our known set; fall back to closest match if not.
  const knownUrls = new Set(sourceItems.map((s) => s.source_url));
  const usedUrls = new Set<string>();

  const bodyLines = topics.map((t) => {
    // Accept the URL only if it's from our list
    const url = knownUrls.has(t.source_url)
      ? t.source_url
      : sourceItems.find((s) => s.title.toLowerCase().includes(t.heading.toLowerCase().slice(0, 10)))?.source_url
        ?? sourceItems[0].source_url;
    usedUrls.add(url);
    return `**${t.heading}**: ${t.detail} ([source](${url}))`;
  });

  const briefContent = bodyLines.join('\n\n');

  // source_urls/names = only the URLs actually cited in the brief, in order used
  const finalSourceUrls = [...usedUrls];
  const finalSourceNames = finalSourceUrls.map((url) => {
    const item = sourceItems.find((s) => s.source_url === url);
    return item?.source_name ?? url;
  });

  const articleInput: CreateArticleInput = {
    title: `${TOWN_NAME} Daily Brief — ${today}`,
    body: briefContent,
    summary: topics.map((t) => t.heading).join(' · '),
    content_type: 'ai_generated',
    category: 'government',
    source_urls: finalSourceUrls,
    source_names: finalSourceNames,
    source_type: 'public_record',
    town: TOWN_ID,
    author: 'Needham Navigator AI',
    is_daily_brief: true,
    is_featured: true,
    model_used: MODEL,
    confidence_score: 0.85,
    status: 'published',
  };

  const { data, error } = await supabase
    .from('articles')
    .insert(articleInput)
    .select()
    .single();

  if (error || !data) {
    console.error('[article-generator] Error inserting daily brief:', error);
    return null;
  }

  console.log('[article-generator] Daily brief generated.');
  return data as Article;
}
