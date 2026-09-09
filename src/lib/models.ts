/**
 * Canonical AI model registry.
 *
 * Every model id used by the app and by the ingestion scripts lives here so a
 * model upgrade is a one-line change instead of a hunt across a dozen files.
 * Import from here rather than hardcoding a model string.
 */

/**
 * Default model for all text generation: chat answers, article and brief
 * generation, document enrichment, query rewriting, and query decomposition.
 *
 * gpt-5.6-luna replaced gpt-5-nano / gpt-4o-mini. It uses adaptive reasoning —
 * on the deck-permit benchmark it answered in ~3.8s using 264 completion tokens
 * where gpt-5-nano took ~9.4s and 1,934 tokens (1,792 of them reasoning), so it
 * is both faster and more token-efficient on this workload.
 */
export const GENERATION_MODEL = "gpt-5.6-luna";

/**
 * Models an admin may select for the chat endpoint. Anything outside this set
 * falls back to GENERATION_MODEL.
 */
export const ALLOWED_CHAT_MODELS = [
  "gpt-5.6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5-mini",
  "gpt-5-nano",
] as const;

/**
 * Embedding model. Do NOT change without a full re-embed: the Upstash Vector
 * index is built at 1536 dimensions, and mixing embedding spaces silently
 * destroys retrieval quality rather than erroring.
 */
export const EMBEDDING_MODEL = "text-embedding-3-large";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Pricing in USD per 1M tokens.
 *
 * NOTE: gpt-5.6-* pricing is an unverified estimate — OpenAI does not expose
 * prices over the API. Cost-dashboard figures for these models are indicative
 * only until the numbers are confirmed against the official pricing page.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Chat / generation models
  "gpt-5.6-luna":              { input: 0.25, output: 2.00 }, // estimate — verify
  "gpt-5.6-sol":               { input: 0.25, output: 2.00 }, // estimate — verify
  "gpt-5.6-terra":             { input: 0.25, output: 2.00 }, // estimate — verify
  "gpt-5-nano":                { input: 0.10, output: 0.40 },
  "gpt-5-mini":                { input: 0.30, output: 1.20 },
  "gpt-4o-mini":               { input: 0.15, output: 0.60 },
  "gpt-4.1-mini":              { input: 0.40, output: 1.60 },
  // Embedding models
  "text-embedding-3-small":    { input: 0.02, output: 0 },
  "text-embedding-3-large":    { input: 0.13, output: 0 },
};

/** Human-readable labels for the admin model picker. */
export const MODEL_LABELS: Record<string, string> = {
  "gpt-5.6-luna": "GPT-5.6 Luna",
  "gpt-5.6-sol": "GPT-5.6 Sol",
  "gpt-5.6-terra": "GPT-5.6 Terra",
  "gpt-5-mini": "GPT-5 Mini",
  "gpt-5-nano": "GPT-5 Nano",
};
