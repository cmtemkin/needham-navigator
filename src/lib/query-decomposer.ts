/**
 * src/lib/query-decomposer.ts — Query decomposition and intent classification
 *
 * Complex queries often contain multiple sub-questions:
 * "What are the school enrollment deadlines and where do I get the forms?"
 * → Sub-query 1: "school enrollment deadlines" (factual, schools)
 * → Sub-query 2: "where to get school enrollment forms" (document_lookup, schools)
 *
 * This module uses GPT-5 Nano to:
 * 1. Detect if a query is complex (multiple distinct questions)
 * 2. Decompose into 1-4 sub-queries
 * 3. Classify intent for each sub-query
 * 4. Suggest source types likely to have relevant information
 * 5. Assign priority for result allocation
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueryIntent =
  | "factual"          // "what are the hours" — needs specific facts
  | "procedural"       // "how do I apply" — needs step-by-step
  | "recommendation"   // "good plumber" — needs business/review data
  | "exploratory"      // "what's happening" — needs broad/recent results
  | "comparison"       // "Needham vs Wellesley" — needs multiple sources
  | "document_lookup"  // "show me the zoning bylaw" — needs specific document
  | "contact"          // "who do I call about" — needs phone/email/person
  | "schedule"         // "when is the next meeting" — needs dates/times
  | "navigational";    // "town hall website" — needs a URL

export type SourceType =
  | "municipal"        // town government, official docs
  | "schools"          // school district
  | "local_business"   // reviews, recommendations
  | "news"             // local news, Patch, etc.
  | "community"        // library, orgs, faith, recreation
  | "transit"          // MBTA, transportation
  | "health"           // hospitals, health dept, senior services
  | "regional"         // surrounding towns, county, state
  | "documents"        // PDFs, bylaws, budgets, meeting minutes (FUTURE)
  | "spreadsheets"     // data tables, budgets, assessor data (FUTURE)
  | "any";             // no source preference

export interface SubQuery {
  query: string;                // the decomposed sub-question
  intent: QueryIntent;          // classified intent for this sub-query
  sourceHint: SourceType[];     // which source types are likely relevant
  priority: number;             // 1 = most important, used for result allocation
}

export interface QueryDecomposition {
  originalQuery: string;
  isComplex: boolean;           // true if query has multiple sub-questions
  subQueries: SubQuery[];       // 1-4 sub-queries (1 = simple query, just pass through)
  strategy: "single" | "parallel" | "sequential";  // how to execute sub-queries
}

// ---------------------------------------------------------------------------
// Decomposition prompt
// ---------------------------------------------------------------------------

const DECOMPOSITION_SYSTEM_PROMPT = `You are a query analyzer for a local municipal information search engine. Analyze user queries and decompose them into structured sub-queries if needed.

INTENT TYPES:
- factual: specific facts (hours, fees, dates, addresses, phone numbers)
- procedural: step-by-step processes (how to apply, how to register)
- recommendation: business/service recommendations (plumber, restaurant, daycare)
- exploratory: broad, open-ended questions (what's happening, what events)
- comparison: comparing multiple things (Needham vs Wellesley schools)
- document_lookup: looking for a specific document (zoning bylaw, budget, meeting minutes)
- contact: who to call/email about something
- schedule: when is something happening (next meeting, deadline)
- navigational: looking for a website or web page

SOURCE TYPES:
- municipal: town government pages, official town documents
- schools: school district pages, school policies
- local_business: local businesses, reviews, recommendations
- news: local news sites, Patch articles
- community: library, community orgs, faith groups, recreation programs
- transit: MBTA, public transit info
- health: hospitals, health department, senior services
- regional: surrounding towns, county, state government
- any: no particular source preference

RULES:
1. Simple queries (single question, one topic) → return 1 sub-query, isComplex=false
2. Complex queries (multiple distinct questions) → split into 2-4 sub-queries, isComplex=true
3. Only decompose if there are genuinely distinct sub-questions
4. For each sub-query, classify intent and suggest 1-3 relevant source types
5. Assign priority: 1 = most important, 2 = secondary, 3 = optional
6. Strategy: "single" for simple queries, "parallel" for independent sub-queries, "sequential" for dependent sub-queries
7. Keep sub-queries concise (under 15 words each)

OUTPUT FORMAT: Valid JSON only, no markdown fences, no explanations.

EXAMPLES:

Input: "what are the transfer station hours"
Output: {"originalQuery":"what are the transfer station hours","isComplex":false,"subQueries":[{"query":"transfer station hours","intent":"factual","sourceHint":["municipal"],"priority":1}],"strategy":"single"}

Input: "school enrollment deadlines and where to get forms"
Output: {"originalQuery":"school enrollment deadlines and where to get forms","isComplex":true,"subQueries":[{"query":"school enrollment deadlines","intent":"schedule","sourceHint":["schools"],"priority":1},{"query":"where to get school enrollment forms","intent":"document_lookup","sourceHint":["schools"],"priority":2}],"strategy":"parallel"}

Input: "how do I register to vote"
Output: {"originalQuery":"how do I register to vote","isComplex":false,"subQueries":[{"query":"voter registration process","intent":"procedural","sourceHint":["municipal"],"priority":1}],"strategy":"single"}

Input: "good plumber in Needham"
Output: {"originalQuery":"good plumber in Needham","isComplex":false,"subQueries":[{"query":"plumber recommendations Needham","intent":"recommendation","sourceHint":["local_business"],"priority":1}],"strategy":"single"}

Input: "compare Needham schools to Wellesley schools"
Output: {"originalQuery":"compare Needham schools to Wellesley schools","isComplex":true,"subQueries":[{"query":"Needham public schools","intent":"comparison","sourceHint":["schools"],"priority":1},{"query":"Wellesley public schools","intent":"comparison","sourceHint":["schools","regional"],"priority":1}],"strategy":"parallel"}`;

// ---------------------------------------------------------------------------
// Decomposition function
// ---------------------------------------------------------------------------

export async function decomposeQuery(query: string): Promise<QueryDecomposition> {
  const trimmed = query.trim();

  // Fast path: empty query → return simple fallback
  if (!trimmed) {
    return {
      originalQuery: trimmed,
      isComplex: false,
      subQueries: [{
        query: trimmed,
        intent: "factual",
        sourceHint: ["any"],
        priority: 1,
      }],
      strategy: "single",
    };
  }

  try {
    // Call GPT-5 Nano with 2-second timeout
    const { text } = await generateText({
      model: openai("gpt-5-nano"),
      system: DECOMPOSITION_SYSTEM_PROMPT,
      prompt: `Query: "${trimmed}"`,
      temperature: 0,
      abortSignal: AbortSignal.timeout(2000), // 2-second timeout
    });

    // Parse JSON response
    const parsed = JSON.parse(text.trim()) as QueryDecomposition;

    // Validate structure
    if (!parsed.subQueries || parsed.subQueries.length === 0) {
      throw new Error("No sub-queries returned");
    }

    return parsed;
  } catch (error) {
    // Fallback: treat as simple factual query
    console.warn("[query-decomposer] Failed to decompose query, using fallback:", error);
    return {
      originalQuery: trimmed,
      isComplex: false,
      subQueries: [{
        query: trimmed,
        intent: "factual",
        sourceHint: ["any"],
        priority: 1,
      }],
      strategy: "single",
    };
  }
}
