/**
 * Tests for transit-utils.ts — filterActiveAlerts
 */

import { filterActiveAlerts, type MbtaAlertLike } from "@/lib/transit-utils";

function makeAlert(periods: { start: string; end: string | null }[]): MbtaAlertLike {
  return {
    id: `alert-${Math.random().toString(36).slice(2, 8)}`,
    attributes: {
      header: "Test Alert",
      active_period: periods,
    },
  };
}

describe("filterActiveAlerts", () => {
  it("includes alerts with no active_period (fail-open)", () => {
    const alert: MbtaAlertLike = { attributes: { header: "No period" } };
    expect(filterActiveAlerts([alert])).toHaveLength(1);
  });

  it("includes alerts with empty active_period array", () => {
    const alert = makeAlert([]);
    expect(filterActiveAlerts([alert])).toHaveLength(1);
  });

  it("includes alerts with a currently-active period", () => {
    const now = new Date();
    const start = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const end = new Date(now.getTime() + 3600000).toISOString();   // 1 hour from now
    const alert = makeAlert([{ start, end }]);
    expect(filterActiveAlerts([alert])).toHaveLength(1);
  });

  it("excludes alerts with an expired period", () => {
    const now = new Date();
    const start = new Date(now.getTime() - 7200000).toISOString(); // 2 hours ago
    const end = new Date(now.getTime() - 3600000).toISOString();   // 1 hour ago
    const alert = makeAlert([{ start, end }]);
    expect(filterActiveAlerts([alert])).toHaveLength(0);
  });

  it("excludes alerts with a future-only period", () => {
    const now = new Date();
    const start = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now
    const end = new Date(now.getTime() + 7200000).toISOString();   // 2 hours from now
    const alert = makeAlert([{ start, end }]);
    expect(filterActiveAlerts([alert])).toHaveLength(0);
  });

  it("includes alerts with null end date (ongoing)", () => {
    const now = new Date();
    const start = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const alert = makeAlert([{ start, end: null }]);
    expect(filterActiveAlerts([alert])).toHaveLength(1);
  });

  it("includes alert if any period is active (multiple periods)", () => {
    const now = new Date();
    const expired = {
      start: new Date(now.getTime() - 7200000).toISOString(),
      end: new Date(now.getTime() - 3600000).toISOString(),
    };
    const current = {
      start: new Date(now.getTime() - 1800000).toISOString(),
      end: new Date(now.getTime() + 1800000).toISOString(),
    };
    const alert = makeAlert([expired, current]);
    expect(filterActiveAlerts([alert])).toHaveLength(1);
  });

  it("filters mixed active and expired alerts correctly", () => {
    const now = new Date();
    const activeAlert = makeAlert([{
      start: new Date(now.getTime() - 3600000).toISOString(),
      end: new Date(now.getTime() + 3600000).toISOString(),
    }]);
    const expiredAlert = makeAlert([{
      start: new Date(now.getTime() - 7200000).toISOString(),
      end: new Date(now.getTime() - 3600000).toISOString(),
    }]);

    const result = filterActiveAlerts([activeAlert, expiredAlert]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(activeAlert);
  });

  it("returns empty array for empty input", () => {
    expect(filterActiveAlerts([])).toHaveLength(0);
  });
});
