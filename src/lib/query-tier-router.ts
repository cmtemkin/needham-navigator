/**
 * Query-level tier routing for tiered search.
 *
 * Detects whether a user query is about state-level topics
 * (taxes, programs, regulations) and expands the search scope
 * to include mass.gov and other state content.
 */

import type { RelevanceTier } from "./relevance-classifier";
import { DEFAULT_SEARCH_TIERS, EXPANDED_SEARCH_TIERS } from "./relevance-classifier";

const STATE_QUERY_PATTERNS = [
  // Tax
  /\b(state|income|excise|sales|estate)\s*tax/i,
  /\btax\s*(rate|bracket|return|filing|deadline|due|form)/i,
  /\bproperty\s*tax\s*(exemption|abatement|deferral)/i,
  /\bchapter\s*\d+[a-z]?\b/i, // Chapter 40B, Chapter 70, etc.

  // Government programs
  /\bmass\s*health/i,
  /\bmedicaid/i,
  /\bsnap\b/i,
  /\bebt\b/i,
  /\bwic\b/i,
  /\bunemployment\s*(insurance|benefits|claim)/i,
  /\bworkers?\s*comp/i,

  // Registry / licensing
  /\bregistry\s*of\s*(motor|deed)/i,
  /\brmv\b/i,
  /\bdriver.?\s*license/i,
  /\bvehicle\s*registration/i,

  // State law / regulation
  /\bstate\s*(law|regulation|statute|code)/i,
  /\bmassachusetts\s*(law|regulation|general\s*law)/i,
  /\bm\.?g\.?l\.?\b/i, // MGL (Massachusetts General Laws)

  // Housing
  /\bmbta\s*communities/i,
  /\baffordable\s*housing\s*act/i,
  /\bzoning\s*(reform|act)\b/i,

  // Education
  /\bchapter\s*70\b/i, // School funding
  /\bstate\s*(education|school)\s*(funding|aid)/i,
  /\bmcas\b/i, // State testing

  // Public safety / licensing
  /\bstate\s*police/i,
  /\bfire\s*marshal/i,
  /\bbuilding\s*code/i,
  /\bfirearms?\s*(license|permit|id|fid)/i,
  /\bliquor\s*license/i,
  /\bcontractor.?\s*(license|registration)/i,
  /\bhome\s*improvement\s*contractor/i,

  // Building / construction (state codes & permits)
  /\b(plumbing|electrical|gas)\s*(code|permit|license)/i,
  /\bfire\s*(code|prevention|safety\s*code)/i,
  /\b(stretch|energy)\s*code/i,
  /\bseptic\s*(system|permit|inspection|failure)/i,
  /\bboard\s*of\s*health\s*(regulation|requirement)/i,

  // Property / real estate
  /\bproperty\s*(assessment|valuation|transfer)/i,
  /\bread\s*estate\s*(transfer|excise|deed)/i,
  /\bdeed\s*(recording|transfer|registry)/i,

  // Environment / conservation
  /\bdep\b.*\b(regulation|permit)/i,
  /\bwetlands?\s*(protection|act|bylaw)/i,
  /\btitle\s*5\b/i, // Septic
  /\bconservation\s*(commission|law|act|regulation)/i,
  /\bstormwater\s*(management|permit|regulation)/i,
  /\benvironmental\s*(regulation|review|impact)/i,

  // Education (state-level)
  /\bspecial\s*education\s*(law|right|regulation|iep)/i,
  /\b504\s*plan/i,
  /\bcharter\s*school/i,
  /\bschool\s*(choice|funding|aid)/i,
];

/**
 * Determine which relevance tiers to include in a search query.
 *
 * - Default queries → primary + regional
 * - State-level queries → primary + regional + state
 */
export function getSearchTiers(query: string): RelevanceTier[] {
  const isStateQuery = STATE_QUERY_PATTERNS.some((p) => p.test(query));
  return isStateQuery ? EXPANDED_SEARCH_TIERS : DEFAULT_SEARCH_TIERS;
}
