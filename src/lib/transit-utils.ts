/**
 * Utility functions for MBTA transit data.
 */

export interface MbtaAlertPeriod {
  start: string;
  end: string | null;
}

export interface MbtaAlertLike {
  attributes?: {
    active_period?: MbtaAlertPeriod[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Filter MBTA alerts to only those with a currently-active period.
 * Alerts with no active_period data are included (fail-open).
 */
export function filterActiveAlerts<T extends MbtaAlertLike>(alerts: T[]): T[] {
  const now = new Date();
  return alerts.filter((alert) => {
    const periods = alert.attributes?.active_period ?? [];
    if (periods.length === 0) return true; // no period info → show it
    return periods.some((p) => {
      const start = p.start ? new Date(p.start) : new Date(0);
      const end = p.end ? new Date(p.end) : new Date(8640000000000000);
      return now >= start && now <= end;
    });
  });
}
