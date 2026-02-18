"use client";

import { useState, useEffect } from "react";
import { Train, Clock, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";

type MbtaAlert = {
  id: string;
  attributes: {
    header: string;
    description: string;
    severity: number;
    effect: string;
    updated_at: string;
    active_period: { start: string; end: string | null }[];
  };
};

type MbtaSchedule = {
  id: string;
  attributes: {
    departure_time: string | null;
    arrival_time: string | null;
    direction_id: number;
  };
  relationships?: {
    stop?: { data?: { id: string } };
  };
};

type MbtaStop = {
  id: string;
  attributes: {
    name: string;
  };
};

type TransitData = {
  alerts: MbtaAlert[];
  schedules: MbtaSchedule[];
  stops: MbtaStop[];
};

const FETCH_TIMEOUT_MS = 10000;

function formatTime(isoStr: string | null): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TransitPage() {
  const town = useTown();
  const { openChat } = useChatWidget();
  const [data, setData] = useState<TransitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");
  const routeId = town.transit_route ?? null;

  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchTransit() {
      setLoading(true);
      setError(null);

      try {
        // Fetch alerts for this route
        const alertsPromise = fetch(
          `https://api-v3.mbta.com/alerts?filter[route]=${routeId}&sort=-updated_at`,
          { signal: controller.signal }
        ).then((r) => r.json());

        // Fetch upcoming schedules
        const now = new Date().toISOString();
        const schedulesPromise = fetch(
          `https://api-v3.mbta.com/schedules?filter[route]=${routeId}&filter[min_time]=${now.split("T")[1]?.slice(0, 5) ?? "00:00"}&sort=departure_time&page[limit]=20&include=stop`,
          { signal: controller.signal }
        ).then((r) => r.json());

        const [alertsData, schedulesData] = await Promise.all([alertsPromise, schedulesPromise]);

        setData({
          alerts: alertsData.data ?? [],
          schedules: schedulesData.data ?? [],
          stops: schedulesData.included?.filter((i: { type: string }) => i.type === "stop") ?? [],
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Transit fetch error:", err);
          setError("Unable to load transit data. Please try again.");
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    void fetchTransit();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [routeId]);

  const getStopName = (schedule: MbtaSchedule): string => {
    const stopId = schedule.relationships?.stop?.data?.id;
    if (!stopId || !data) return "";
    return data.stops.find((s) => s.id === stopId)?.attributes.name ?? "";
  };

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">Transit</span>
            </h1>
            <p className="text-lg text-white/90">
              {routeId
                ? `MBTA schedules, alerts, and service updates`
                : `Public transportation information`}
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {!routeId && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🚌</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Transit info coming soon</h2>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Public transit details for {shortTownName} are being configured. Ask Navigator about getting around.
              </p>
              <button
                onClick={() => openChat(`What public transit options are available in ${shortTownName}?`)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Ask About Transit
              </button>
            </div>
          )}

          {routeId && loading && (
            <div className="space-y-4">
              <div className="bg-white border border-border-light rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          )}

          {routeId && !loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Transit Unavailable</h2>
              <p className="text-text-secondary mb-6">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          )}

          {routeId && !loading && !error && data && (
            <>
              {/* Active Alerts */}
              {data.alerts.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                    <AlertCircle size={20} className="text-[var(--warning)]" />
                    Service Alerts
                  </h2>
                  <div className="space-y-3">
                    {data.alerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
                      >
                        <h3 className="text-[15px] font-semibold text-yellow-900 mb-1">
                          {alert.attributes.header}
                        </h3>
                        {alert.attributes.description && (
                          <p className="text-[13px] text-yellow-800 line-clamp-3">
                            {alert.attributes.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule */}
              <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Clock size={20} className="text-[var(--primary)]" />
                Upcoming Departures
              </h2>

              {data.schedules.length > 0 ? (
                <div className="bg-white border border-border-light rounded-xl overflow-hidden">
                  <div className="divide-y divide-border-light">
                    {data.schedules.slice(0, 15).map((schedule) => {
                      const stopName = getStopName(schedule);
                      const time = schedule.attributes.departure_time || schedule.attributes.arrival_time;
                      const direction = schedule.attributes.direction_id === 0 ? "Outbound" : "Inbound";

                      return (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between px-5 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <Train size={16} className="text-[var(--primary)] flex-shrink-0" />
                            <div>
                              <div className="text-[14px] font-medium text-text-primary">
                                {stopName || "Station"}
                              </div>
                              <div className="text-[12px] text-text-muted">
                                {direction}
                              </div>
                            </div>
                          </div>
                          <div className="text-[15px] font-semibold text-text-primary">
                            {formatTime(time)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-border-light rounded-xl p-8 text-center">
                  <p className="text-text-secondary">No upcoming departures found for today.</p>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 mt-6">
                <a
                  href={`https://www.mbta.com/schedules/${routeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[14px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors"
                >
                  Full schedule on MBTA.com
                  <ExternalLink size={14} />
                </a>
              </div>

              <p className="text-[12px] text-text-muted text-center mt-4">
                Transit data provided by the MBTA via api-v3.mbta.com
              </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
