/**
 * src/lib/geo-filter.ts — Geographic relevance filtering
 *
 * Keyword-based pre-filter that checks whether content is geographically
 * relevant to Needham, MA before sending it to GPT for summarization.
 * Saves API costs by rejecting obviously off-topic content (e.g., Connecticut
 * articles that leak in via Patch or other scraped sources).
 *
 * Category-specific scope rules:
 *   - needham_only: government, schools, public_safety, development
 *   - metro_area:   community, events, dining, news, business
 */

// ─── Geographic data ─────────────────────────────────────────────────────────

/** Needham itself — always allowed for all categories */
const CORE_TOWN = 'needham';

/** Neighboring towns — allowed for metro_area categories */
const NEIGHBORING_TOWNS = [
  'wellesley', 'newton', 'dedham', 'dover', 'westwood',
  'natick', 'norwood', 'brookline', 'waltham', 'framingham',
];

/** Greater Boston metro — allowed for metro_area categories */
const METRO_CITIES = [
  'boston', 'cambridge', 'somerville', 'quincy', 'medford',
  'arlington', 'watertown', 'lexington', 'concord',
];

/** All allowed Massachusetts locations */
const ALLOWED_LOCATIONS = new Set([
  CORE_TOWN,
  ...NEIGHBORING_TOWNS,
  ...METRO_CITIES,
  'massachusetts',
]);

/**
 * US states other than Massachusetts — presence of these without a local
 * mention is a strong signal of off-topic content.
 */
const OTHER_STATES = [
  'connecticut', 'new york', 'new jersey', 'rhode island',
  'new hampshire', 'vermont', 'maine', 'pennsylvania',
  'california', 'florida', 'texas', 'ohio', 'virginia',
  'georgia', 'north carolina', 'south carolina', 'michigan',
  'illinois', 'indiana', 'wisconsin', 'minnesota', 'iowa',
  'missouri', 'tennessee', 'kentucky', 'alabama', 'mississippi',
  'louisiana', 'arkansas', 'oklahoma', 'kansas', 'nebraska',
  'colorado', 'arizona', 'new mexico', 'utah', 'nevada',
  'idaho', 'montana', 'wyoming', 'oregon', 'washington',
  'hawaii', 'alaska', 'west virginia', 'maryland', 'delaware',
  'south dakota', 'north dakota',
];

/** State abbreviations (2-letter) — used in patterns like ", CT" or "CT 06103" */
const OTHER_STATE_ABBREVS = [
  'CT', 'NY', 'NJ', 'RI', 'NH', 'VT', 'ME', 'PA',
  'CA', 'FL', 'TX', 'OH', 'VA', 'GA', 'NC', 'SC',
  'MI', 'IL', 'IN', 'WI', 'MN', 'IA', 'MO', 'TN',
  'KY', 'AL', 'MS', 'LA', 'AR', 'OK', 'KS', 'NE',
  'CO', 'AZ', 'NM', 'UT', 'NV', 'ID', 'MT', 'WY',
  'OR', 'WA', 'HI', 'AK', 'WV', 'MD', 'DE', 'SD', 'ND',
  'DC',
];

/** Major cities in other states — strong rejection signal */
const DISTANT_CITIES = [
  // Connecticut
  'hartford', 'stamford', 'bridgeport', 'new haven', 'greenwich',
  'norwalk', 'danbury', 'waterbury',
  // New York
  'manhattan', 'brooklyn', 'queens', 'bronx', 'staten island',
  'buffalo', 'rochester', 'albany', 'syracuse',
  // Other major US cities
  'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin',
  'detroit', 'seattle', 'denver', 'atlanta', 'miami',
  'minneapolis', 'portland', 'las vegas', 'baltimore',
  'milwaukee', 'pittsburgh', 'cleveland', 'nashville',
  'charlotte', 'raleigh', 'indianapolis',
];

// ─── Category scope rules ────────────────────────────────────────────────────

type GeoScope = 'needham_only' | 'metro_area';

const CATEGORY_GEO_SCOPE: Record<string, GeoScope> = {
  government: 'needham_only',
  schools: 'needham_only',
  public_safety: 'needham_only',
  development: 'needham_only',
  // Wider scope for lifestyle/community content
  community: 'metro_area',
  events: 'metro_area',
  dining: 'metro_area',
  sports: 'metro_area',
  business: 'metro_area',
  news: 'metro_area',
};

// ─── Core filter ─────────────────────────────────────────────────────────────

export interface GeoFilterResult {
  isRelevant: boolean;
  reason: string;
  detectedLocations: string[];
}

/**
 * Check whether article content is geographically relevant to Needham, MA.
 *
 * Returns `isRelevant: false` if the article appears to be primarily about
 * another state or distant location with no connection to Needham.
 */
export function checkGeographicRelevance(
  text: string,
  title: string,
  url: string,
  category: string,
): GeoFilterResult {
  const combined = `${title} ${text}`.toLowerCase();
  const scope = CATEGORY_GEO_SCOPE[category] ?? 'metro_area';

  // 1. Check for Needham / local mentions
  const hasNeedhamMention = combined.includes('needham');
  const localMentions = [...ALLOWED_LOCATIONS].filter(loc =>
    combined.includes(loc)
  );

  // 2. Check for other-state mentions (full names)
  const detectedOtherStates = OTHER_STATES.filter(state =>
    combined.includes(state)
  );

  // 3. Check for state abbreviation patterns: ", CT" or "(CT)" or "CT 0XXXX"
  const titleAndText = `${title} ${text}`;
  const detectedStateAbbrevs = OTHER_STATE_ABBREVS.filter(abbrev => {
    // Match ", CT" (comma + space + abbrev + word boundary)
    // nosemgrep: detect-non-literal-regexp -- abbrev values are hardcoded state abbreviations
    const commaPattern = new RegExp(String.raw`,\s*${abbrev}\b`);
    // Match "(CT)"
    const parenPattern = new RegExp(String.raw`\(${abbrev}\)`); // nosemgrep: detect-non-literal-regexp
    // Match "CT 0XXXX" (abbreviation + zip code)
    const zipPattern = new RegExp(String.raw`\b${abbrev}\s+\d{5}`); // nosemgrep: detect-non-literal-regexp
    return commaPattern.test(titleAndText) ||
      parenPattern.test(titleAndText) ||
      zipPattern.test(titleAndText);
  });

  // 4. Check for distant city mentions
  const detectedDistantCities = DISTANT_CITIES.filter(city =>
    combined.includes(city)
  );

  const allDistant = [
    ...detectedOtherStates,
    ...detectedStateAbbrevs.map(a => `${a} (abbrev)`),
    ...detectedDistantCities,
  ];
  const distantCount = allDistant.length;

  // ── Decision logic ──

  // Strong rejection: other state(s) mentioned, Needham is NOT mentioned
  if (distantCount > 0 && !hasNeedhamMention) {
    return {
      isRelevant: false,
      reason: `Content about other locations (${allDistant.slice(0, 3).join(', ')}), no Needham mention`,
      detectedLocations: allDistant,
    };
  }

  // For needham_only categories: reject if more distant than local references
  if (scope === 'needham_only' && distantCount > localMentions.length) {
    return {
      isRelevant: false,
      reason: `Government/school content with more distant (${distantCount}) than local (${localMentions.length}) references`,
      detectedLocations: allDistant,
    };
  }

  // Heavy distant content with zero local connection
  if (distantCount >= 3 && localMentions.length === 0) {
    return {
      isRelevant: false,
      reason: `Multiple distant location references (${distantCount}), no local connection`,
      detectedLocations: allDistant,
    };
  }

  let reason: string;
  if (hasNeedhamMention) {
    reason = 'Content mentions Needham';
  } else if (localMentions.length > 0) {
    reason = `Content mentions local area (${localMentions.slice(0, 3).join(', ')})`;
  } else {
    reason = 'No strong geographic signals detected — allowing by default';
  }

  return {
    isRelevant: true,
    reason,
    detectedLocations: localMentions,
  };
}

// ─── URL-level filter ────────────────────────────────────────────────────────

/**
 * Check whether a URL is geographically relevant based on its path.
 * Primarily catches Patch URLs from other states/towns.
 */
export function isUrlGeographicallyRelevant(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // Malformed URL — reject
  }

  const host = parsed.hostname.toLowerCase();
  const fullUrl = parsed.href.toLowerCase();

  // Always allow Needham-specific domains (exact host match OR subdomain)
  // codeql[js/incomplete-url-substring-sanitization] — hostname extracted from URL.parse(), not substring check
  if (host === 'needhamma.gov' || host.endsWith('.needhamma.gov')) return true;
  // codeql[js/incomplete-url-substring-sanitization]
  if (host === 'needham.k12.ma.us' || host.endsWith('.needham.k12.ma.us')) return true;
  // codeql[js/incomplete-url-substring-sanitization]
  if (host === 'needhamobserver.com' || host.endsWith('.needhamobserver.com')) return true;
  // codeql[js/incomplete-url-substring-sanitization]
  if (host === 'needhamlocal.org' || host.endsWith('.needhamlocal.org')) return true;
  // codeql[js/incomplete-url-substring-sanitization]
  if (host === 'needhamchannel.org' || host.endsWith('.needhamchannel.org')) return true;

  // Patch: only allow Massachusetts/Needham paths
  if (host === 'patch.com' || host.endsWith('.patch.com')) {
    return fullUrl.includes('/massachusetts/needham');
  }

  // Wicked Local: only allow Needham paths
  if (host === 'wickedlocal.com' || host.endsWith('.wickedlocal.com')) {
    return fullUrl.includes('needham');
  }

  // Block obviously non-MA paths on generic news sites
  const blockedPathSegments = [
    '/connecticut/', '/new-york/', '/new-jersey/', '/california/',
    '/florida/', '/texas/', '/pennsylvania/', '/virginia/',
  ];
  if (blockedPathSegments.some(seg => fullUrl.includes(seg))) {
    return false;
  }

  // Default: allow (unknown domains get content-level filtering instead)
  return true;
}
