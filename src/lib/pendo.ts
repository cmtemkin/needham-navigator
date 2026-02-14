/**
 * Pendo analytics configuration and helpers.
 * Uses anonymous visitor IDs (no auth system) with town_id as account.
 */

const PENDO_API_KEY = process.env.NEXT_PUBLIC_PENDO_API_KEY;

/** Generate or retrieve a persistent anonymous visitor ID */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server';

  const STORAGE_KEY = 'nn_visitor_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Generate or retrieve the first-seen timestamp for this visitor */
function getFirstSeen(): string {
  if (typeof window === 'undefined') return new Date().toISOString();

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
  if (!PENDO_API_KEY || typeof window === 'undefined') return;

  const pendo = window.pendo;
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

/** Track a custom event in Pendo */
export function trackEvent(eventName: string, metadata?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const pendo = window.pendo;
  if (!pendo?.track) return;

  pendo.track(eventName, {
    ...metadata,
    timestamp: new Date().toISOString(),
  });
}
