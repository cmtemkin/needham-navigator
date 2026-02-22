/**
 * Document relevance classification for tiered search.
 *
 * Classifies documents into tiers based on domain and URL patterns.
 * Used at ingestion time and for backfilling existing documents.
 */

export type RelevanceTier =
  | "primary"        // Needham-specific: needhamma.gov, needham.k12.ma.us
  | "regional"       // Norfolk County, MBTA, neighboring town overlaps
  | "state"          // mass.gov, statewide programs
  | "supplementary"  // Utilities, review sites, businesses
  | "archive"        // Archive Center pages, old meeting minutes
  | "irrelevant";    // Wrong town, junk

// ---------------------------------------------------------------------------
// Domain → tier mapping
// ---------------------------------------------------------------------------

const DOMAIN_TIER_MAP: Record<string, RelevanceTier> = {
  // Primary — Needham-specific
  "needhamma.gov": "primary",
  "needham.k12.ma.us": "primary",
  "needhamchannel.org": "primary",
  "needhamhistory.org": "primary",
  "needhamcommunityfarm.org": "primary",
  "needhamba.com": "primary",
  "needhamlibrary.org": "primary",
  "needhamhousing.org": "primary",
  "needhamcouncil.org": "primary",
  "needhamopen.space.org": "primary",
  "bidneedham.org": "primary",
  "patch.com": "primary", // local news often Needham-specific
  "wickedlocal.com": "primary",

  // Regional — Norfolk County / transit
  "norfolkcountyma.gov": "regional",
  "mbta.com": "regional",
  "ymcaboston.org": "regional",

  // State — Massachusetts
  "mass.gov": "state",

  // Supplementary — utilities, review sites
  "eversource.com": "supplementary",
  "verizon.com": "supplementary",
  "xfinity.com": "supplementary",
  "yelp.com": "supplementary",
  "angi.com": "supplementary",
  "bbb.org": "supplementary",
  "google.com": "irrelevant",

  // Irrelevant — wrong towns
  "wellesleyma.gov": "irrelevant",
  "newtonma.gov": "irrelevant",
  "dedham-ma.gov": "irrelevant",
  "doverma.gov": "irrelevant",
  "townhall.westwood.ma.us": "irrelevant",
  "westwood.ma.us": "irrelevant",
};

// Domains containing "needham" are always primary
function isNeedhamDomain(hostname: string): boolean {
  return hostname.includes("needham");
}

// ---------------------------------------------------------------------------
// Archive detection
// ---------------------------------------------------------------------------

const ARCHIVE_URL_PATTERNS = [
  /\/archive\.asp/i,
  /\/archivecenter\//i,
  /\/archive\//i,
];

function isArchiveUrl(url: string): boolean {
  return ARCHIVE_URL_PATTERNS.some((p) => p.test(url));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a document's relevance tier based on its URL and title.
 */
export function classifyDocument(url: string, title?: string): RelevanceTier {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return "supplementary";
  }

  // Archive pages — regardless of domain
  if (isArchiveUrl(url) || (title && /archive center/i.test(title))) {
    return "archive";
  }

  // Check explicit domain map
  const domainTier = DOMAIN_TIER_MAP[hostname];
  if (domainTier) {
    return domainTier;
  }

  // Needham-related domains not in the map
  if (isNeedhamDomain(hostname)) {
    return "primary";
  }

  // Faith/community orgs with needham in URL path
  if (pathname.includes("needham")) {
    return "primary";
  }

  // Default
  return "supplementary";
}

/**
 * Get the search tiers that should be included based on query intent.
 * Used at query time to expand search scope for state-level queries.
 */
export const DEFAULT_SEARCH_TIERS: RelevanceTier[] = ["primary", "regional"];
export const EXPANDED_SEARCH_TIERS: RelevanceTier[] = ["primary", "regional", "state"];
export const ALL_SEARCH_TIERS: RelevanceTier[] = [
  "primary", "regional", "state", "supplementary", "archive", "irrelevant",
];
