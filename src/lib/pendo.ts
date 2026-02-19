/**
 * Pendo analytics configuration and helpers.
 * Uses anonymous visitor IDs (no auth system) with town_id as account.
 */

const PENDO_API_KEY = process.env.NEXT_PUBLIC_PENDO_API_KEY;

type PageType =
  | "home"
  | "search_home"
  | "search_results"
  | "news"
  | "chat"
  | "permits"
  | "releases"
  | "admin"
  | "other";

/** Generate or retrieve a persistent anonymous visitor ID */
export function getVisitorId(): string {
  if (typeof globalThis.window === 'undefined') return 'server';

  const STORAGE_KEY = 'nn_visitor_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `anon-${crypto.randomUUID()}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Generate or retrieve the first-seen timestamp for this visitor */
function getFirstSeen(): string {
  if (typeof globalThis.window === 'undefined') return new Date().toISOString();

  const STORAGE_KEY = 'nn_first_seen';
  let firstSeen = localStorage.getItem(STORAGE_KEY);
  if (!firstSeen) {
    firstSeen = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, firstSeen);
  }
  return firstSeen;
}

/** Initialize Pendo with visitor and account data */
export function initializePendo(townId: string, townName: string): void {
  if (!PENDO_API_KEY || typeof globalThis.window === 'undefined') return;

  const pendo = globalThis.pendo;
  if (!pendo) return;

  pendo.initialize({
    visitor: {
      id: getVisitorId(),
      // Stable timestamp for cohorting and retention analytics
      first_seen: getFirstSeen(),
    },
    account: {
      id: townId,
      name: townName,
    },
  });
}

/** Resolve app-level page type for stable Pendo tagging across root and town-scoped URLs */
export function resolvePageType(pathname: string, query?: string): PageType {
  const normalizedPath = pathname.toLowerCase();
  const hasQuery = (query ?? "").trim().length > 0;

  if (normalizedPath.endsWith("/news") || normalizedPath === "/news") return "news";
  if (normalizedPath.endsWith("/chat") || normalizedPath === "/chat") return "chat";
  if (normalizedPath.endsWith("/permits") || normalizedPath === "/permits") return "permits";
  if (normalizedPath.endsWith("/releases") || normalizedPath === "/releases") return "releases";
  if (normalizedPath.startsWith("/admin")) return "admin";
  if (normalizedPath.endsWith("/search") || normalizedPath === "/search") {
    return hasQuery ? "search_results" : "search_home";
  }
  if (hasQuery) return "search_results";

  // "/" or "/needham" style roots
  if (normalizedPath === "/" || /^\/[^/]+$/.test(normalizedPath)) return "home";
  return "other";
}

/** Track a page view from the current browser URL */
export function trackCurrentPageView(townId: string): void {
  if (typeof globalThis.window === "undefined") return;

  const path = globalThis.location.pathname;
  const query = new URLSearchParams(globalThis.location.search).get("q")?.trim() ?? "";

  trackEvent("page_view", {
    town_id: townId,
    page_path: path,
    page_type: resolvePageType(path, query),
    has_search_query: query.length > 0,
  });
}

/** Track a custom event in Pendo */
export function trackEvent(eventName: string, metadata?: Record<string, unknown>): void {
  if (typeof globalThis.window === 'undefined') return;
  const pendo = globalThis.pendo;
  if (!pendo?.track) return;

  pendo.track(eventName, {
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}
