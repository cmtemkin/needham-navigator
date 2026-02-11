/**
 * scripts/scraper-config.ts — Configuration for the custom web scraper
 *
 * Defines seed URLs, crawl parameters, URL filtering patterns, and
 * department mappings. Designed to be extensible for additional towns
 * and source types (events, reviews) in the future.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScraperConfig {
  /** Town identifier */
  townId: string;

  /** Starting URLs for the crawl */
  seedUrls: string[];

  /** Only follow links within these domains */
  allowedDomains: string[];

  /** Maximum link-follow depth from seed URLs */
  maxDepth: number;

  /** Maximum total pages to crawl (safety limit) */
  maxPages: number;

  /** Delay between requests in milliseconds (be polite) */
  crawlDelayMs: number;

  /** Maximum retries per failed request */
  maxRetries: number;

  /** User-Agent string sent with every request */
  userAgent: string;

  /** URL patterns to skip (calendar, login, images, etc.) */
  skipPatterns: RegExp[];

  /** Map URL path patterns to department names */
  departmentPatterns: Array<{ pattern: RegExp; department: string }>;

  /** Output file for intermediate scraped data */
  outputFile: string;

  /** File to store crawl progress for resume capability */
  progressFile: string;
}

// ---------------------------------------------------------------------------
// Needham configuration
// ---------------------------------------------------------------------------

export const NEEDHAM_CONFIG: ScraperConfig = {
  townId: "needham",

  seedUrls: [
    "https://www.needhamma.gov",
  ],

  allowedDomains: [
    "www.needhamma.gov",
    "needhamma.gov",
  ],

  maxDepth: 5,
  maxPages: 500,
  crawlDelayMs: 1000, // 1 second between requests — polite to town servers
  maxRetries: 3,

  userAgent:
    "NeedhamNavigator/1.0 (community civic tool; +https://needhamnavigator.com) Node.js",

  skipPatterns: [
    // Calendar / agenda / RSS
    /\/Calendar\.aspx/i,
    /\/AgendaCenter/i,
    /\/rss/i,

    // Login / auth
    /\/Login\.aspx/i,
    /\/Account\//i,

    // Search
    /\/Search\.aspx/i,
    /\/SearchResults/i,

    // Print / email / share
    /\/print\//i,
    /\/email\//i,
    /\/share\//i,

    // Image / media files
    /\.(?:jpg|jpeg|png|gif|svg|ico|webp|bmp|tiff)$/i,

    // Stylesheets / scripts
    /\.(?:css|js|map)$/i,

    // Office docs (non-PDF — we handle PDFs separately)
    /\.(?:xlsx|xls|docx|doc|pptx|ppt|zip|rar)$/i,

    // Anchors and mailto
    /^mailto:/i,
    /^tel:/i,
    /^javascript:/i,
    /#/,

    // ImageRepository (decorative banners)
    /\/ImageRepository\//i,

    // Font / asset directories
    /\/fonts?\//i,
    /\/assets?\//i,

    // Archive pagination (too many pages)
    /\/Archive\.aspx\?/i,
  ],

  departmentPatterns: [
    { pattern: /\/planning/i, department: "Planning & Community Development" },
    { pattern: /\/zoning/i, department: "Planning & Community Development" },
    { pattern: /\/building/i, department: "Building Department" },
    { pattern: /\/dpw|\/public-?works|\/87\//i, department: "Public Works" },
    { pattern: /\/health/i, department: "Board of Health" },
    { pattern: /\/fire/i, department: "Fire Department" },
    { pattern: /\/police/i, department: "Police Department" },
    { pattern: /\/assessing|\/57\//i, department: "Assessing" },
    { pattern: /\/treasurer|\/collector/i, department: "Treasurer/Collector" },
    { pattern: /\/clerk/i, department: "Town Clerk" },
    { pattern: /\/select-?board|\/488\//i, department: "Select Board" },
    { pattern: /\/conservation/i, department: "Conservation" },
    { pattern: /\/recreation|\/park/i, department: "Parks & Recreation" },
    { pattern: /\/library/i, department: "Library" },
    { pattern: /\/school|k12/i, department: "Schools" },
    { pattern: /\/water|\/sewer/i, department: "Water & Sewer" },
    { pattern: /\/permit|\/4644/i, department: "Building Department" },
    { pattern: /\/fee/i, department: "Finance" },
    { pattern: /\/voter|\/election/i, department: "Town Clerk" },
    { pattern: /\/transfer-?station|\/rts/i, department: "Public Works" },
  ],

  outputFile: "scripts/scraped-data.json",
  progressFile: "scripts/scrape-progress.json",
};

// ---------------------------------------------------------------------------
// Future towns — add configs here
// ---------------------------------------------------------------------------

// export const WELLESLEY_CONFIG: ScraperConfig = { ... };
// export const NATICK_CONFIG: ScraperConfig = { ... };

// ---------------------------------------------------------------------------
// Future source types — events, reviews, etc.
// ---------------------------------------------------------------------------

// export interface EventSourceConfig {
//   calendarUrls: string[];
//   icalUrls: string[];
//   googleCalendarIds: string[];
// }

// export interface ReviewSourceConfig {
//   googlePlacesApiKey: string;
//   yelpApiKey: string;
//   categories: string[];
// }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the department for a given URL based on path patterns.
 */
export function getDepartmentFromUrl(
  url: string,
  config: ScraperConfig = NEEDHAM_CONFIG
): string | undefined {
  for (const { pattern, department } of config.departmentPatterns) {
    if (pattern.test(url)) {
      return department;
    }
  }
  return undefined;
}

/**
 * Check if a URL should be skipped based on the skip patterns.
 */
export function shouldSkipUrl(
  url: string,
  config: ScraperConfig = NEEDHAM_CONFIG
): boolean {
  return config.skipPatterns.some((p) => p.test(url));
}

/**
 * Check if a URL is within the allowed domains.
 */
export function isAllowedDomain(
  url: string,
  config: ScraperConfig = NEEDHAM_CONFIG
): boolean {
  try {
    const hostname = new URL(url).hostname;
    return config.allowedDomains.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Detect if a URL points to a PDF.
 */
export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

/**
 * Get config by town ID.
 */
export function getScraperConfig(townId: string = "needham"): ScraperConfig {
  switch (townId) {
    case "needham":
      return NEEDHAM_CONFIG;
    default:
      throw new Error(`No scraper config for town: ${townId}`);
  }
}
