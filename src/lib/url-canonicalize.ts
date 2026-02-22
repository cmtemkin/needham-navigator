/**
 * Shared URL canonicalization for deduplication.
 * Used by scraper, search API, ingestion, and cleanup scripts.
 */

/**
 * Canonicalize a URL for deduplication:
 * - Force https://
 * - Strip www. prefix
 * - Strip trailing slash (except root)
 * - Strip fragment (#...)
 * - Strip common tracking params (utm_*, fbclid, etc.)
 * - Lowercase everything
 */
export function canonicalizeUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return rawUrl.trim().toLowerCase();
  }

  // Force https
  url.protocol = "https:";

  // Strip www prefix
  url.hostname = url.hostname.replace(/^www\./, "");

  // Strip fragment
  url.hash = "";

  // Strip tracking params
  const trackingParams = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "ref", "source",
  ];
  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }

  // Strip trailing slash (except root path)
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  url.pathname = path;

  return url.toString().toLowerCase();
}
