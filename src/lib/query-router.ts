/**
 * src/lib/query-router.ts — Intent-based retrieval configuration
 *
 * Different query intents need different retrieval strategies:
 * - Factual queries → tight similarity threshold, high authority weight
 * - Exploratory queries → looser threshold, high recency weight
 * - Document lookup → very tight threshold, sibling expansion
 * - Recommendations → lower threshold, boost local_business sources
 *
 * This module takes a SubQuery (with intent + sourceHint) and returns
 * a RetrievalConfig that tunes the RAG pipeline for that specific intent.
 */

import { QueryIntent, SourceType } from "./query-decomposer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalConfig {
  similarityThreshold: number;       // base threshold adjusted per intent
  resultCount: number;               // how many results to return
  sourceFilter: SourceType[] | null; // filter chunks by source type (null = no filter)
  sourceBoost: Partial<Record<SourceType, number>>;  // boost scores for preferred sources
  authorityWeight: number;           // adjusted authority weight (default 0.1)
  recencyWeight: number;             // adjusted recency weight (default 0.1)
  expandSiblings: boolean;           // whether to expand sibling chunks
  siblingExpansionCount: number;     // how many siblings to grab
}

// Default weights from the existing 5-factor formula:
// - Semantic: 0.6
// - Keyword: 0.2
// - Recency: 0.1 (adjustable)
// - Authority: 0.1 (adjustable)
// - Department boost: 0.05 (now becomes source boost)

const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_RESULT_COUNT = 8;
const DEFAULT_AUTHORITY_WEIGHT = 0.1;
const DEFAULT_RECENCY_WEIGHT = 0.1;

// ---------------------------------------------------------------------------
// Routing rules by intent
// ---------------------------------------------------------------------------

const INTENT_ROUTING_RULES: Record<QueryIntent, Partial<RetrievalConfig>> = {
  // "what are the hours" — needs specific facts, high precision
  factual: {
    similarityThreshold: DEFAULT_THRESHOLD + 0.05,  // 0.75 — tight threshold
    resultCount: 5,
    sourceFilter: null,
    sourceBoost: { municipal: 0.1 },
    authorityWeight: 0.20,  // boost authority for official facts
    recencyWeight: 0.05,    // recency less important for stable facts
    expandSiblings: false,
  },

  // "how do I apply" — needs step-by-step, context matters
  procedural: {
    similarityThreshold: DEFAULT_THRESHOLD,  // 0.7 — default
    resultCount: 8,
    sourceFilter: null,
    sourceBoost: { municipal: 0.05 },
    authorityWeight: 0.15,
    recencyWeight: 0.05,
    expandSiblings: true,
    siblingExpansionCount: 3,
  },

  // "good plumber" — needs businesses/reviews, lower threshold OK
  recommendation: {
    similarityThreshold: DEFAULT_THRESHOLD - 0.05,  // 0.65 — looser
    resultCount: 10,
    sourceFilter: null,
    sourceBoost: { local_business: 0.2 },
    authorityWeight: 0.05,  // authority less important for recommendations
    recencyWeight: 0.10,    // recency matters for current businesses
    expandSiblings: false,
  },

  // "what's happening" — needs broad, recent results
  exploratory: {
    similarityThreshold: DEFAULT_THRESHOLD - 0.05,  // 0.65 — looser
    resultCount: 12,
    sourceFilter: null,
    sourceBoost: { news: 0.1, community: 0.1 },
    authorityWeight: 0.05,
    recencyWeight: 0.25,   // heavily favor recent content
    expandSiblings: false,
  },

  // "Needham vs Wellesley" — needs diverse sources
  comparison: {
    similarityThreshold: DEFAULT_THRESHOLD - 0.03,  // 0.67
    resultCount: 8,  // per topic, so 16 total for 2 topics
    sourceFilter: null,
    sourceBoost: {},
    authorityWeight: 0.10,
    recencyWeight: 0.10,
    expandSiblings: true,
    siblingExpansionCount: 2,
  },

  // "show me the zoning bylaw" — needs specific document
  document_lookup: {
    similarityThreshold: DEFAULT_THRESHOLD + 0.03,  // 0.73 — tight
    resultCount: 3,
    sourceFilter: ["documents" as SourceType],  // FUTURE: when we have document source type
    sourceBoost: {},
    authorityWeight: 0.25,  // authority very important for official documents
    recencyWeight: 0.05,
    expandSiblings: true,
    siblingExpansionCount: 5,  // grab lots of context for documents
  },

  // "who do I call about" — needs contact info
  contact: {
    similarityThreshold: DEFAULT_THRESHOLD + 0.05,  // 0.75 — tight
    resultCount: 3,
    sourceFilter: null,
    sourceBoost: { municipal: 0.15 },
    authorityWeight: 0.20,
    recencyWeight: 0.05,
    expandSiblings: false,
  },

  // "when is the next meeting" — needs dates/schedules
  schedule: {
    similarityThreshold: DEFAULT_THRESHOLD + 0.05,  // 0.75 — tight
    resultCount: 5,
    sourceFilter: null,
    sourceBoost: { municipal: 0.1 },
    authorityWeight: 0.10,
    recencyWeight: 0.20,  // favor recent schedules
    expandSiblings: false,
  },

  // "town hall website" — needs a URL
  navigational: {
    similarityThreshold: DEFAULT_THRESHOLD + 0.05,  // 0.75 — tight
    resultCount: 3,
    sourceFilter: null,
    sourceBoost: { municipal: 0.1 },
    authorityWeight: 0.15,
    recencyWeight: 0.05,
    expandSiblings: false,
  },
};

// ---------------------------------------------------------------------------
// Router function
// ---------------------------------------------------------------------------

export function getRetrievalConfig(
  intent: QueryIntent,
  sourceHint: SourceType[]
): RetrievalConfig {
  // Start with the intent-based rules
  const intentRules = INTENT_ROUTING_RULES[intent] || INTENT_ROUTING_RULES.factual;

  // Apply source hints as additional boosts
  const sourceBoost: Record<string, number> = { ...(intentRules.sourceBoost || {}) };
  for (const source of sourceHint) {
    if (source !== "any") {
      // If the source isn't already boosted by intent rules, add a small boost
      if (!sourceBoost[source]) {
        sourceBoost[source] = 0.05;
      }
    }
  }

  // Build the final config with defaults filled in
  return {
    similarityThreshold: intentRules.similarityThreshold ?? DEFAULT_THRESHOLD,
    resultCount: intentRules.resultCount ?? DEFAULT_RESULT_COUNT,
    sourceFilter: intentRules.sourceFilter ?? null,
    sourceBoost: sourceBoost as Record<SourceType, number>,
    authorityWeight: intentRules.authorityWeight ?? DEFAULT_AUTHORITY_WEIGHT,
    recencyWeight: intentRules.recencyWeight ?? DEFAULT_RECENCY_WEIGHT,
    expandSiblings: intentRules.expandSiblings ?? false,
    siblingExpansionCount: intentRules.siblingExpansionCount ?? 3,
  };
}
