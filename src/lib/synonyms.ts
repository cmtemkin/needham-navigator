/**
 * Municipal synonym dictionary for query expansion.
 *
 * Two-tier structure:
 *   1. UNIVERSAL synonyms — apply to any municipality
 *   2. TOWN-SPECIFIC synonyms — keyed by town_id, swappable per tenant
 *
 * Each entry maps a set of informal/colloquial triggers to a set of
 * formal/official expansion terms. When a user query matches any trigger,
 * ALL expansion terms are appended to the search.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SynonymEntry = {
  /** Informal phrases residents might use (lowercased) */
  triggers: string[];
  /** Official/formal terms to expand into */
  expansions: string[];
};

export type SynonymDictionary = SynonymEntry[];

// ---------------------------------------------------------------------------
// Universal synonyms (any municipality)
// ---------------------------------------------------------------------------

const UNIVERSAL_SYNONYMS: SynonymDictionary = [
  {
    triggers: ["dump", "garbage", "trash", "rubbish", "waste"],
    expansions: ["transfer station", "solid waste", "recycling center", "refuse disposal"],
  },
  {
    triggers: ["cops", "police station"],
    expansions: ["police department", "public safety"],
  },
  {
    triggers: ["fire station", "firehouse"],
    expansions: ["fire department"],
  },
  {
    triggers: ["town hall", "city hall", "municipal building"],
    expansions: ["town offices", "municipal offices"],
  },
  {
    triggers: ["taxes", "tax bill", "property tax"],
    expansions: ["assessor", "tax collector", "treasurer"],
  },
  {
    triggers: ["schools", "school system"],
    expansions: ["school department", "school committee", "superintendent"],
  },
  {
    triggers: ["roads", "potholes", "plowing", "snow"],
    expansions: ["DPW", "public works", "highway department"],
  },
  {
    triggers: ["water", "sewer", "drains"],
    expansions: ["water and sewer", "DPW", "utilities"],
  },
  {
    triggers: ["parks", "playgrounds", "fields"],
    expansions: ["parks and recreation", "recreation department"],
  },
  {
    triggers: ["library", "books"],
    expansions: ["public library"],
  },
  {
    triggers: ["permits", "building permit", "renovation"],
    expansions: ["building department", "building inspector", "inspectional services"],
  },
  {
    triggers: ["zoning", "can i build", "setback", "lot size"],
    expansions: ["planning", "zoning board", "ZBA", "planning board"],
  },
  {
    triggers: ["vote", "voting", "elections", "register to vote"],
    expansions: ["town clerk", "election commission"],
  },
  {
    triggers: ["birth certificate", "death certificate", "marriage license"],
    expansions: ["town clerk", "vital records"],
  },
  {
    triggers: ["dog license", "pet"],
    expansions: ["town clerk", "animal control"],
  },
  {
    triggers: ["meeting", "town meeting", "annual meeting"],
    expansions: ["town meeting", "select board", "board of selectmen"],
  },
  {
    triggers: ["noise complaint", "neighbor"],
    expansions: ["police", "board of health", "bylaws"],
  },
  {
    triggers: ["restaurant inspection", "food safety"],
    expansions: ["board of health", "health department"],
  },
  {
    triggers: ["septic", "well water"],
    expansions: ["board of health"],
  },
  {
    triggers: ["sidewalks", "crosswalks", "traffic lights"],
    expansions: ["DPW", "public works", "engineering"],
  },
  {
    triggers: ["senior center", "elderly", "aging"],
    expansions: ["council on aging", "senior services"],
  },
  {
    triggers: ["youth", "teens", "after school"],
    expansions: ["youth commission", "recreation"],
  },
  {
    triggers: ["commute", "train", "bus", "transit"],
    expansions: ["MBTA", "commuter rail", "public transportation"],
  },
  {
    triggers: ["tree", "trees", "tree removal"],
    expansions: ["tree warden", "DPW", "conservation"],
  },
  {
    triggers: ["wetlands", "conservation", "environment"],
    expansions: ["conservation commission"],
  },
  {
    triggers: ["historic", "landmark", "old house"],
    expansions: ["historical commission"],
  },
  {
    triggers: ["cable", "tv"],
    expansions: ["cable advisory committee"],
  },
  {
    triggers: ["veterans", "military"],
    expansions: ["veterans services"],
  },
  {
    triggers: ["rat", "rats", "mice", "rodent", "pest"],
    expansions: ["board of health", "health department", "pest control"],
  },
  {
    triggers: ["deck", "build a deck"],
    expansions: ["building permit", "zoning", "building department"],
  },
  {
    triggers: ["fence"],
    expansions: ["building permit", "zoning", "property line", "setback"],
  },
  {
    triggers: ["pothole", "road repair"],
    expansions: ["DPW", "public works", "highway department"],
  },
];

// ---------------------------------------------------------------------------
// Town-specific synonyms (keyed by town_id)
// ---------------------------------------------------------------------------

const TOWN_SYNONYMS: Record<string, SynonymDictionary> = {
  needham: [
    {
      triggers: ["the dump", "rts"],
      expansions: ["Needham Transfer Station", "1421 Central Avenue", "recycling and transfer station"],
    },
    {
      triggers: ["the rec", "rec center"],
      expansions: ["Needham Recreation", "community center"],
    },
    {
      triggers: ["defazio field", "memorial park"],
      expansions: ["Needham parks", "DeFazio Park", "Memorial Park"],
    },
    {
      triggers: ["the heights", "needham heights"],
      expansions: ["Needham Heights", "village area"],
    },
    {
      triggers: ["charles river"],
      expansions: ["conservation areas", "trails", "Charles River"],
    },
    {
      triggers: ["the greendale"],
      expansions: ["Greendale Avenue"],
    },
    {
      triggers: ["town meeting"],
      expansions: ["Needham Town Meeting", "first Monday in May"],
    },
    {
      triggers: ["override", "prop 2.5", "proposition 2 1/2"],
      expansions: ["proposition 2½", "tax override", "override vote"],
    },
    {
      triggers: ["sticker", "transfer station sticker"],
      expansions: ["RTS sticker", "transfer station permit", "annual sticker"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the combined synonym dictionary for a given town.
 * Returns universal synonyms merged with town-specific ones.
 */
export function getSynonymDictionary(townId: string): SynonymDictionary {
  const townSpecific = TOWN_SYNONYMS[townId] ?? [];
  // Town-specific first so they take priority in matching
  return [...townSpecific, ...UNIVERSAL_SYNONYMS];
}

/**
 * Expand a user query using the synonym dictionary.
 *
 * Returns an object with:
 *   - `original`: the original query
 *   - `expanded`: array of expansion term strings that matched
 *   - `expandedQuery`: a combined query string for embedding
 *
 * Matching is case-insensitive and checks for phrase containment.
 */
export function expandQuery(
  query: string,
  townId: string
): {
  original: string;
  expanded: string[];
  expandedQuery: string;
} {
  const dictionary = getSynonymDictionary(townId);
  const lowerQuery = query.toLowerCase();
  const matchedExpansions = new Set<string>();

  for (const entry of dictionary) {
    const triggered = entry.triggers.some((trigger) => {
      // Multi-word triggers use substring match (phrase matching)
      if (trigger.includes(" ")) {
        return lowerQuery.includes(trigger);
      }
      // Single-word triggers use word-boundary matching to avoid
      // false positives like "tree" inside "street"
      const wordBoundary = new RegExp(`\\b${trigger}\\b`, "i");
      return wordBoundary.test(lowerQuery);
    });
    if (triggered) {
      for (const expansion of entry.expansions) {
        // Don't add if the original query already contains this term
        if (!lowerQuery.includes(expansion.toLowerCase())) {
          matchedExpansions.add(expansion);
        }
      }
    }
  }

  const expanded = Array.from(matchedExpansions);

  // Build a combined query: original + expansion terms
  const expandedQuery =
    expanded.length > 0
      ? `${query} ${expanded.join(" ")}`
      : query;

  return { original: query, expanded, expandedQuery };
}
