/**
 * scripts/chunk.ts — Document-type-specific chunking (PRD Section 4)
 *
 * Implements the hybrid chunking strategy: structure-based chunking using
 * document headings/sections combined with semantic boundaries, with
 * document-type-specific parameters.
 */

import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Boilerplate stripping — removes CivicEngage/needhamma.gov chrome
// ---------------------------------------------------------------------------

const BOILERPLATE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Loading placeholders & spinner images
  { pattern: /!\[Loading\]\([^)]*\)/g, label: "loading-img" },
  { pattern: /^Loading$/gm, label: "loading-text" },

  // Skip-to-content links
  { pattern: /\[Skip to Main Content\]\([^)]*\)/g, label: "skip-nav" },

  // CivicEngage image repository images (decorative banners, logos)
  { pattern: /!\[\]\(https?:\/\/(?:www\.)?needhamma\.gov\/ImageRepository\/[^)]*\)/g, label: "banner-img" },

  // Breadcrumb trails: numbered list where each item is a link to needhamma.gov
  { pattern: /^(?:\d+\.\s*\[[^\]]*\]\(https?:\/\/(?:www\.)?needhamma\.gov\/[^)]*\)\n?)+/gm, label: "breadcrumbs" },

  // "Do Not Show Again Close" modal/popup leftovers
  { pattern: /Do Not Show AgainClose/g, label: "modal-close" },

  // BESbswy font measurement strings (CivicEngage anti-FOUT)
  { pattern: /(?:BESbswy){2,}/g, label: "font-probe" },

  // Google Translate language picker (massive list of language names)
  { pattern: /Select Language\s*(?:Abkhaz|Acehnese)[\s\S]*?(?:Zulu|Zapotec)\b/g, label: "translate-picker" },
  // Continuation fragments of the language list (orphan chunk)
  { pattern: /^[a-zA-Z]+(?:ese|ian|ish|ala|ulu|tic|ari|aze|ala)\b(?:[A-Z][a-z]+){5,}/gm, label: "translate-fragment" },

  // "Powered by Google Translate" badge
  { pattern: /Powered by \[!\[Google Translate\][^\]]*\]\([^)]*\)\s*/g, label: "translate-badge" },

  // Slideshow / carousel controls
  { pattern: /Arrow LeftArrow Right/g, label: "carousel-arrows" },
  { pattern: /Slideshow Left Arrow[\s\S]*?Slideshow Right Arrow/g, label: "slideshow-ctrl" },

  // Newsletter sign-up CTA
  { pattern: /Sign Up for the Town's Weekly e-Newsletter/g, label: "newsletter-cta" },

  // Close button text
  { pattern: /^Close \*\*×\*\*$/gm, label: "close-btn" },

  // Empty image tags (no alt text, decorative)
  { pattern: /!\[\]\([^)]*\)/g, label: "empty-img" },

  // CivicEngage footer boilerplate
  { pattern: /Government Websites by CivicPlus®?/g, label: "civic-footer" },
  { pattern: /\[Powered by.*?CivicPlus.*?\]\([^)]*\)/g, label: "civic-powered" },

  // Repeated "Loading\nLoading" blocks
  { pattern: /(?:Loading\s*\n\s*){2,}/g, label: "multi-loading" },
];

/**
 * Strip HTML/CMS boilerplate from crawled markdown, keeping only
 * the substantive page content.
 */
export function stripBoilerplate(markdown: string): string {
  let cleaned = markdown;

  for (const { pattern } of BOILERPLATE_PATTERNS) {
    // Reset lastIndex for stateful regexes
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }

  // Collapse runs of 3+ blank lines into 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentType =
  | "zoning_bylaws"
  | "general_bylaws"
  | "building_permits"
  | "fee_schedules"
  | "budget"
  | "board_of_health"
  | "public_works"
  | "meeting_minutes"
  | "planning_board"
  | "local_business" // business reviews and recommendations
  | "news" // local news articles
  | "general"; // fallback

export type ChunkType =
  | "regulation"
  | "table"
  | "procedure_step"
  | "meeting_item"
  | "financial_data"
  | "informational";

export interface ChunkMetadata {
  chunk_id: string;
  document_id?: string;
  document_title: string;
  document_type: string;
  department?: string;
  document_url: string;
  section_number?: string;
  section_title?: string;
  page_number?: number;
  effective_date?: string;
  last_amended?: string;
  document_date?: string;
  chunk_type: ChunkType;
  contains_table: boolean;
  cross_references: string[];
  keywords: string[];
  applies_to: string[];
  chunk_index?: number;
  total_chunks?: number;
  content_hash?: string;
  // Business-specific fields (for local_business document type)
  business_name?: string;
  business_category?: string;
  business_subcategory?: string;
  business_rating?: number;
  business_review_count?: number;
  business_address?: string;
  business_phone?: string;
  business_website?: string;
  source_platform?: string; // e.g., "yelp", "angi", "bbb"
  // Enrichment fields (from AI enrichment)
  ai_summary?: string;
  ai_title?: string;
  ai_tags?: string[];
  content_type?: string;
}

export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

interface ChunkingConfig {
  maxTokens: number;
  overlapTokens: number;
  breakStrategy: string;
}

// ---------------------------------------------------------------------------
// Chunking parameters by document type (Section 4.1)
// ---------------------------------------------------------------------------

const CHUNKING_CONFIGS: Record<DocumentType, ChunkingConfig> = {
  zoning_bylaws: {
    maxTokens: 1024,
    overlapTokens: 256,
    breakStrategy: "section_headers",
  },
  general_bylaws: {
    maxTokens: 768,
    overlapTokens: 192,
    breakStrategy: "numbered_paragraphs",
  },
  building_permits: {
    maxTokens: 512,
    overlapTokens: 128,
    breakStrategy: "procedural_steps",
  },
  fee_schedules: {
    maxTokens: 384,
    overlapTokens: 96,
    breakStrategy: "table_atomic",
  },
  budget: {
    maxTokens: 1280,
    overlapTokens: 320,
    breakStrategy: "narrative_data_separation",
  },
  board_of_health: {
    maxTokens: 768,
    overlapTokens: 192,
    breakStrategy: "topic_based",
  },
  public_works: {
    maxTokens: 512,
    overlapTokens: 128,
    breakStrategy: "section_based",
  },
  meeting_minutes: {
    maxTokens: 768,
    overlapTokens: 192,
    breakStrategy: "agenda_items",
  },
  planning_board: {
    maxTokens: 896,
    overlapTokens: 224,
    breakStrategy: "item_project_separation",
  },
  local_business: {
    maxTokens: 512,
    overlapTokens: 128,
    breakStrategy: "business_profile", // Each business review/profile is atomic
  },
  news: {
    maxTokens: 768,
    overlapTokens: 192,
    breakStrategy: "article_paragraphs",
  },
  general: {
    maxTokens: 768,
    overlapTokens: 192,
    breakStrategy: "section_based",
  },
};

// ---------------------------------------------------------------------------
// Document type detection
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_PATTERNS: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  {
    type: "zoning_bylaws",
    patterns: [/zoning\s*by-?law/i, /dimensional\s*requirements/i, /zoning\s*regulation/i],
  },
  {
    type: "general_bylaws",
    patterns: [/general\s*by-?law/i, /town\s*by-?law/i],
  },
  {
    type: "building_permits",
    patterns: [/building\s*permit/i, /permit\s*application/i, /construction\s*permit/i],
  },
  {
    type: "fee_schedules",
    patterns: [/fee\s*schedule/i, /schedule\s*of\s*fees/i, /fee\s*table/i],
  },
  {
    type: "budget",
    patterns: [/budget/i, /financial\s*report/i, /appropriation/i],
  },
  {
    type: "board_of_health",
    patterns: [/board\s*of\s*health/i, /health\s*regulation/i, /sanitary/i],
  },
  {
    type: "public_works",
    patterns: [/public\s*works/i, /transfer\s*station/i, /recycling/i, /DPW/i, /RTS/i],
  },
  {
    type: "meeting_minutes",
    patterns: [/meeting\s*minutes/i, /minutes\s*of/i, /select\s*board\s*meeting/i],
  },
  {
    type: "planning_board",
    patterns: [/planning\s*board/i, /planning\s*department/i, /site\s*plan\s*review/i],
  },
  {
    type: "local_business",
    patterns: [
      /\b\d+\s*star[s]?\b/i, // "4.5 stars"
      /\b\d+\s*review[s]?\b/i, // "23 reviews"
      /rating|rated|score/i,
      /yelp|angi|homeadvisor|thumbtack|bbb|tripadvisor/i,
      /business\s*directory|local\s*business/i,
      /hours:\s*\d|open\s*\d/i, // "Hours: 9am" or "Open 9"
      /\(\d{3}\)\s*\d{3}-\d{4}/,  // Phone number pattern
    ],
  },
  {
    type: "news",
    patterns: [
      /patch\.com|wickedlocal|needham\s*channel/i,
      /by\s+\w+\s+\w+\s*\|\s*\w+\s+\d+,\s+\d{4}/i, // "By John Doe | January 15, 2024"
      /posted\s+on|published\s+on|updated\s+on/i,
      /share\s*article|print\s*article/i,
      /\barticle\b.*\bauthor\b/i,
    ],
  },
];

export function detectDocumentType(title: string, content: string): DocumentType {
  const searchText = `${title}\n${content.substring(0, 2000)}`;
  for (const { type, patterns } of DOCUMENT_TYPE_PATTERNS) {
    if (patterns.some((p) => p.test(searchText))) {
      return type;
    }
  }
  return "general";
}

// ---------------------------------------------------------------------------
// Tokenizer (js-tiktoken for exact token counting)
//
// Uses the same tokenizer as OpenAI's text-embedding-3-small model
// for accurate token counting. This prevents chunks from exceeding
// embedding model limits and ensures consistent overlap.
// ---------------------------------------------------------------------------

import { encodingForModel } from "js-tiktoken";

// Initialize encoder (reuse for performance)
const encoder = encodingForModel("gpt-4"); // Compatible with text-embedding-3-small

function estimateTokens(text: string): number {
  return encoder.encode(text).length;
}

function charLimitFromTokens(tokens: number): number {
  // Still use char approximation for initial splits, then validate with actual tokenization
  return tokens * 4;
}

// ---------------------------------------------------------------------------
// Section splitters
// ---------------------------------------------------------------------------

// Markdown heading pattern: # Heading, ## Heading, ### Heading
const HEADING_REGEX = /^(#{1,4})\s+(.+)$/gm;

// Numbered paragraph: 1. text, 1.2 text, (a) text
const NUMBERED_PARA_REGEX = /^(?:\d+\.[\d.]*|[a-z]\)|[A-Z]\.|\([a-z]\))\s/gm;

// Table detection (markdown tables)
const TABLE_REGEX = /\|.+\|[\s\S]*?\n\|[-:\s|]+\|[\s\S]*?(?=\n\n|\n#|$)/g;

// Cross-reference detection
const CROSS_REF_REGEX =
  /(?:§|Section|Chapter|Article)\s*[\d.]+(?:\s*(?:of|,)\s*(?:the\s+)?(?:Zoning|General|Town)\s*(?:By-?law|Code|Regulation)s?)?/gi;

function extractCrossReferences(text: string): string[] {
  const refs = text.match(CROSS_REF_REGEX) || [];
  return Array.from(new Set(refs));
}

function containsTable(text: string): boolean {
  return TABLE_REGEX.test(text);
}

function extractKeywords(text: string): string[] {
  // Extract notable terms from the chunk
  const keywords = new Set<string>();
  const keywordPatterns = [
    /(?:setback|FAR|floor area ratio|height limit|lot coverage)/gi,
    /(?:permit|license|certificate|variance|waiver)/gi,
    /(?:residential|commercial|industrial|mixed.?use)/gi,
    /(?:fee|cost|charge|price|rate)/gi,
    /(?:deadline|due date|hours|schedule)/gi,
  ];

  for (const pattern of keywordPatterns) {
    const matches = text.match(pattern) || [];
    matches.forEach((m) => keywords.add(m.toLowerCase()));
  }

  return Array.from(keywords);
}

function extractAppliesTo(text: string): string[] {
  const zones = new Set<string>();
  const zonePatterns = [
    /\b(?:SRB|SRC|SRA|GRB|GRA|APT|BR|CH|CI|IND|RG)\b/g, // Common Needham zone codes
    /(?:Single\s*Residence|General\s*Residence|Business|Commercial|Industrial)/gi,
  ];

  for (const pattern of zonePatterns) {
    const matches = text.match(pattern) || [];
    matches.forEach((m) => zones.add(m));
  }

  return Array.from(zones);
}

// ---------------------------------------------------------------------------
// Core chunking
// ---------------------------------------------------------------------------

interface SplitSection {
  title: string;
  sectionNumber: string;
  content: string;
}

/**
 * Split text at structural boundaries (headings, numbered paragraphs, etc.)
 */
function splitAtBoundaries(
  text: string,
  strategy: string
): SplitSection[] {
  const sections: SplitSection[] = [];

  if (strategy === "table_atomic") {
    // Fee schedules: never split tables
    const tables = text.match(TABLE_REGEX) || [];
    const nonTableParts = text.split(TABLE_REGEX);

    for (let i = 0; i < nonTableParts.length; i++) {
      if (nonTableParts[i].trim()) {
        sections.push({
          title: "",
          sectionNumber: "",
          content: nonTableParts[i].trim(),
        });
      }
      if (tables[i]) {
        sections.push({
          title: "Table",
          sectionNumber: "",
          content: tables[i].trim(),
        });
      }
    }

    if (sections.length === 0) {
      sections.push({ title: "", sectionNumber: "", content: text });
    }

    return sections;
  }

  // Default: split on headings
  const headingMatches = Array.from(text.matchAll(HEADING_REGEX));

  if (headingMatches.length === 0) {
    // No headings found — split on double newlines
    const paragraphs = text.split(/\n\n+/);
    for (const para of paragraphs) {
      if (para.trim()) {
        sections.push({ title: "", sectionNumber: "", content: para.trim() });
      }
    }
    return sections.length > 0 ? sections : [{ title: "", sectionNumber: "", content: text }];
  }

  // Split at headings
  for (let i = 0; i < headingMatches.length; i++) {
    const match = headingMatches[i];
    const startIndex = match.index!;
    const endIndex =
      i + 1 < headingMatches.length
        ? headingMatches[i + 1].index!
        : text.length;

    const sectionContent = text.substring(startIndex, endIndex).trim();
    const headingTitle = match[2].trim();

    // Try to extract section number
    const secNumMatch = headingTitle.match(/^([\d.]+)\s*/);

    sections.push({
      title: headingTitle,
      sectionNumber: secNumMatch ? secNumMatch[1] : "",
      content: sectionContent,
    });
  }

  // Capture any text before the first heading
  if (headingMatches[0].index! > 0) {
    const preface = text.substring(0, headingMatches[0].index!).trim();
    if (preface) {
      sections.unshift({ title: "Introduction", sectionNumber: "", content: preface });
    }
  }

  return sections;
}

/**
 * Get the last N tokens from text (for overlap)
 */
function getLastNTokens(text: string, n: number): string {
  const tokens = encoder.encode(text);
  if (tokens.length <= n) return text;
  const overlapTokens = tokens.slice(-n);
  return encoder.decode(overlapTokens);
}

/**
 * Split a section into chunks that respect the max token limit,
 * with overlap for context continuity.
 *
 * Uses actual token counting for accurate chunk sizing.
 */
function splitSectionIntoChunks(
  section: SplitSection,
  config: ChunkingConfig
): string[] {
  // Check if section is already small enough
  const sectionTokens = estimateTokens(section.content);
  if (sectionTokens <= config.maxTokens) {
    return [section.content];
  }

  const chunks: string[] = [];
  const paragraphs = section.content.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const testChunk = currentChunk + (currentChunk ? "\n\n" : "") + para;
    const actualTokens = estimateTokens(testChunk);

    if (actualTokens > config.maxTokens && currentChunk) {
      // Current chunk + para exceeds limit, save current chunk and start new one
      chunks.push(currentChunk.trim());

      // Add overlap from end of previous chunk
      const overlapText = getLastNTokens(currentChunk, config.overlapTokens);
      currentChunk = overlapText + "\n\n" + para;
    } else {
      currentChunk = testChunk;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ChunkDocumentOptions {
  documentId?: string;
  documentUrl: string;
  documentTitle: string;
  documentType?: DocumentType;
  department?: string;
  effectiveDate?: string;
  documentDate?: string;
}

/**
 * Recursively split an oversized chunk until every piece fits within the
 * embedding model's token limit.  Strategy (in order):
 *   1. Split on paragraph breaks (\n\n)
 *   2. Split on single newlines (\n)
 *   3. Split on sentence boundaries (. ! ?)
 *   4. Hard split by encoded tokens (last resort)
 */
function splitOversizedChunk(
  chunk: Chunk,
  limit: number,
  overlapTokens: number,
  out: Chunk[],
): void {
  if (estimateTokens(chunk.text) <= limit) {
    out.push(chunk);
    return;
  }

  // Try progressively finer split delimiters
  const delimiters = [/\n\n+/, /\n/, /(?<=\.)\s+/];

  for (const delim of delimiters) {
    const parts = chunk.text.split(delim);
    if (parts.length <= 1) continue; // delimiter not found, try next

    let currentText = "";
    let didSplit = false;

    for (const part of parts) {
      const separator = delim.source.includes("\\n\\n") ? "\n\n" : delim.source.includes("\\n") ? "\n" : " ";
      const testText = currentText + (currentText ? separator : "") + part;

      if (estimateTokens(testText) > limit && currentText) {
        // Recurse in case currentText is still oversized
        splitOversizedChunk(
          { text: currentText.trim(), metadata: { ...chunk.metadata } },
          limit,
          overlapTokens,
          out,
        );
        const overlapText = getLastNTokens(currentText, overlapTokens);
        currentText = overlapText + separator + part;
        didSplit = true;
      } else {
        currentText = testText;
      }
    }

    if (currentText.trim()) {
      splitOversizedChunk(
        { text: currentText.trim(), metadata: { ...chunk.metadata } },
        limit,
        overlapTokens,
        out,
      );
    }

    if (didSplit) return;
  }

  // Last resort: hard-split by tokens
  const tokens = encoder.encode(chunk.text);
  for (let start = 0; start < tokens.length; start += limit - overlapTokens) {
    const slice = tokens.slice(start, start + limit);
    const text = encoder.decode(slice).trim();
    if (text) {
      out.push({ text, metadata: { ...chunk.metadata } });
    }
  }
}

export function chunkDocument(
  text: string,
  options: ChunkDocumentOptions
): Chunk[] {
  // Strip CMS/HTML boilerplate before chunking
  const cleanedText = stripBoilerplate(text);

  const docType = options.documentType || detectDocumentType(options.documentTitle, cleanedText);
  const config = CHUNKING_CONFIGS[docType];

  const sections = splitAtBoundaries(cleanedText, config.breakStrategy);
  const chunks: Chunk[] = [];

  let chunkIndex = 0;

  for (const section of sections) {
    const textChunks = splitSectionIntoChunks(section, config);

    for (const chunkText of textChunks) {
      const chunkId = `${docType.toUpperCase().substring(0, 3)}-${
        section.sectionNumber || chunkIndex
      }`;

      chunks.push({
        text: chunkText,
        metadata: {
          chunk_id: chunkId,
          document_id: options.documentId,
          document_title: options.documentTitle,
          document_type: docType,
          department: options.department,
          document_url: options.documentUrl,
          section_number: section.sectionNumber || undefined,
          section_title: section.title || undefined,
          effective_date: options.effectiveDate,
          document_date: options.documentDate,
          chunk_type: detectChunkType(chunkText, docType),
          contains_table: containsTable(chunkText),
          cross_references: extractCrossReferences(chunkText),
          keywords: extractKeywords(chunkText),
          applies_to: extractAppliesTo(chunkText),
        },
      });

      chunkIndex++;
    }
  }

  // Safety check: split any chunk exceeding the embedding model limit (8192 tokens).
  // We use 7500 as the ceiling to leave headroom.
  const EMBEDDING_TOKEN_LIMIT = 7500;
  const SAFETY_OVERLAP_TOKENS = 50;
  const safeChunks: Chunk[] = [];

  for (const chunk of chunks) {
    splitOversizedChunk(chunk, EMBEDDING_TOKEN_LIMIT, SAFETY_OVERLAP_TOKENS, safeChunks);
  }

  // Add chunk_index, total_chunks, and content_hash to all chunks
  const totalChunks = safeChunks.length;
  for (let i = 0; i < safeChunks.length; i++) {
    safeChunks[i].metadata.chunk_index = i;
    safeChunks[i].metadata.total_chunks = totalChunks;
    safeChunks[i].metadata.content_hash = createHash("sha256")
      .update(safeChunks[i].text)
      .digest("hex");
  }

  console.log(
    `[chunk] Chunked "${options.documentTitle}" (${docType}) into ${safeChunks.length} chunks`
  );
  return safeChunks;
}

function detectChunkType(text: string, docType: DocumentType): ChunkType {
  if (containsTable(text)) return "table";

  switch (docType) {
    case "zoning_bylaws":
    case "general_bylaws":
    case "board_of_health":
      return "regulation";
    case "building_permits":
      return "procedure_step";
    case "meeting_minutes":
      return "meeting_item";
    case "budget":
    case "fee_schedules":
      return "financial_data";
    default:
      return "informational";
  }
}

// Exported for testing
export { CHUNKING_CONFIGS, estimateTokens, splitAtBoundaries, splitSectionIntoChunks };
