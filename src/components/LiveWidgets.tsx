"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cloud, Train, Shield, ChevronRight, AlertTriangle } from "lucide-react";
import { useTown, useTownHref } from "@/lib/town-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type WeatherWidgetData = {
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  windSpeed: string;
  windDirection: string;
  icon: string;
  highTemp?: number;
  lowTemp?: number;
};

type TransitWidgetData = {
  nextDeparture: string | null;
  direction: string;
  stopName: string;
  alertCount: number;
  alertHeader?: string;
};

// ─── Weather Widget ───────────────────────────────────────────────────────────

function WeatherWidget() {
  const town = useTown();
  const weatherHref = useTownHref("/weather");
  const [data, setData] = useState<WeatherWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchWeather() {
      try {
        const pointRes = await fetch(
          `https://api.weather.gov/points/${town.location.lat},${town.location.lng}`,
          { signal: controller.signal, headers: { "User-Agent": "TownNavigator/1.0" } }
        );
        if (!pointRes.ok) throw new Error("point failed");

        const pointData = await pointRes.json();
        const forecastUrl = pointData.properties?.forecast;
        if (!forecastUrl) throw new Error("no forecast URL");

        const forecastRes = await fetch(forecastUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "TownNavigator/1.0" },
        });
        if (!forecastRes.ok) throw new Error("forecast failed");

        const forecastData = await forecastRes.json();
        const periods = forecastData.properties?.periods ?? [];
        const current = periods[0];
        if (!current) throw new Error("no periods");

        // Find high and low from first two periods (day/night pair)
        const dayPeriod = periods.find((p: { isDaytime: boolean }) => p.isDaytime);
        const nightPeriod = periods.find((p: { isDaytime: boolean }) => !p.isDaytime);

        setData({
          temperature: current.temperature,
          temperatureUnit: current.temperatureUnit,
          shortForecast: current.shortForecast,
          windSpeed: current.windSpeed,
          windDirection: current.windDirection,
          icon: current.icon,
          highTemp: dayPeriod?.temperature,
          lowTemp: nightPeriod?.temperature,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather().catch(() => {});
    return () => controller.abort();
  }, [town.location.lat, town.location.lng]);

  if (loading) return <WidgetSkeleton />;
  if (error || !data) {
    return (
      <WidgetFallback
        href={weatherHref}
        icon={<Cloud size={20} className="text-blue-500" />}
        title="Weather"
        message="Unable to load weather"
      />
    );
  }

  return (
    <Link href={weatherHref} className="group block bg-white border border-border-default rounded-xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
            <Cloud size={18} className="text-blue-500" />
          </div>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Weather</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-50 text-green-700 uppercase tracking-wider">Live</span>
      </div>
      <div className="text-3xl font-bold text-text-primary leading-none mb-1">
        {data.temperature}°{data.temperatureUnit}
      </div>
      <div className="text-sm text-text-secondary mb-1">{data.shortForecast}</div>
      <div className="text-xs text-text-muted">
        {data.highTemp != null && data.lowTemp != null && (
          <>H: {data.highTemp}° &nbsp; L: {data.lowTemp}° &nbsp;· &nbsp;</>
        )}
        Wind {data.windSpeed} {data.windDirection}
      </div>
      <div className="mt-3 pt-3 border-t border-border-light text-xs font-semibold text-[var(--primary)] flex items-center gap-1 group-hover:gap-2 transition-all">
        View full forecast <ChevronRight size={14} />
      </div>
    </Link>
  );
}

// ─── Transit Widget ───────────────────────────────────────────────────────────

function TransitWidget() {
  const town = useTown();
  const transitHref = useTownHref("/transit");
  const [data, setData] = useState<TransitWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const routeId = town.transit_route ?? null;

  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchTransit() {
      try {
        const now = new Date().toISOString();
        const minTime = now.split("T")[1]?.slice(0, 5) ?? "00:00";

        const [alertsRes, schedulesRes] = await Promise.all([
          fetch(
            `https://api-v3.mbta.com/alerts?filter[route]=${routeId}&sort=-updated_at`,
            { signal: controller.signal }
          ),
          fetch(
            `https://api-v3.mbta.com/schedules?filter[route]=${routeId}&filter[min_time]=${minTime}&sort=departure_time&page[limit]=5&include=stop`,
            { signal: controller.signal }
          ),
        ]);

        const alertsData = await alertsRes.json();
        const schedulesData = await schedulesRes.json();

        const alerts = alertsData.data ?? [];
        const schedules = schedulesData.data ?? [];
        const stops = schedulesData.included?.filter((i: { type: string }) => i.type === "stop") ?? [];

        const firstSchedule = schedules[0];
        const departureTime = firstSchedule?.attributes?.departure_time || firstSchedule?.attributes?.arrival_time || null;
        const stopId = firstSchedule?.relationships?.stop?.data?.id;
        const stopName = stops.find((s: { id: string }) => s.id === stopId)?.attributes?.name ?? "Station";
        const direction = firstSchedule?.attributes?.direction_id === 0 ? "Outbound" : "Inbound";

        setData({
          nextDeparture: departureTime,
          direction,
          stopName,
          alertCount: alerts.length,
          alertHeader: alerts[0]?.attributes?.header,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchTransit().catch(() => {});
    return () => controller.abort();
  }, [routeId]);

  if (!routeId) return null;
  if (loading) return <WidgetSkeleton />;
  if (error || !data) {
    return (
      <WidgetFallback
        href={transitHref}
        icon={<Train size={20} className="text-green-600" />}
        title="Commuter Rail"
        message="Unable to load transit data"
      />
    );
  }

  const formattedTime = data.nextDeparture
    ? new Date(data.nextDeparture).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "No departures";

  return (
    <Link href={transitHref} className="group block bg-white border border-border-default rounded-xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-50">
            <Train size={18} className="text-green-600" />
          </div>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Commuter Rail</span>
        </div>
        {data.alertCount > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 uppercase tracking-wider">
            {data.alertCount} Alert{data.alertCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-50 text-green-700 uppercase tracking-wider">On Time</span>
        )}
      </div>
      <div className="text-3xl font-bold text-text-primary leading-none mb-1">
        {formattedTime}
      </div>
      <div className="text-sm text-text-secondary mb-1">
        Next train · {data.stopName}
      </div>
      {data.alertCount > 0 && data.alertHeader && (
        <div className="text-xs text-amber-700 flex items-start gap-1 mt-1">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span className="line-clamp-1">{data.alertHeader}</span>
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-border-light text-xs font-semibold text-[var(--primary)] flex items-center gap-1 group-hover:gap-2 transition-all">
        View full schedule <ChevronRight size={14} />
      </div>
    </Link>
  );
}

// ─── Community Widget ─────────────────────────────────────────────────────────

function CommunityWidget() {
  const town = useTown();
  const communityHref = useTownHref("/community");
  const hasCommunity = town.feature_flags.enableEvents || town.feature_flags.enableSafety;

  if (!hasCommunity) return null;

  return (
    <Link href={communityHref} className="group block bg-white border border-border-default rounded-xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50">
            <Shield size={18} className="text-amber-600" />
          </div>
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Community</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-50 text-green-700 uppercase tracking-wider">All Clear</span>
      </div>
      <div className="text-2xl font-bold text-text-primary leading-tight mb-1">
        No Active Alerts
      </div>
      <div className="text-sm text-text-secondary mb-1">
        Needham public safety status
      </div>
      <div className="text-xs text-text-muted">
        Emergency: 911 · Non-emergency: (781) 455-7570
      </div>
      <div className="mt-3 pt-3 border-t border-border-light text-xs font-semibold text-[var(--primary)] flex items-center gap-1 group-hover:gap-2 transition-all">
        View community hub <ChevronRight size={14} />
      </div>
    </Link>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="bg-white border border-border-default rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 bg-gray-100 rounded-lg" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-20 mb-2" />
      <div className="h-4 bg-gray-100 rounded w-32 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-40" />
    </div>
  );
}

function WidgetFallback({ href, icon, title, message }: Readonly<{ href: string; icon: React.ReactNode; title: string; message: string }>) {
  return (
    <Link href={href} className="group block bg-white border border-border-default rounded-xl p-5 hover:border-[var(--primary)] hover:shadow-md transition-all">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-50">
          {icon}
        </div>
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">{title}</span>
      </div>
      <div className="text-sm text-text-muted mb-2">{message}</div>
      <div className="text-xs font-semibold text-[var(--primary)] flex items-center gap-1 group-hover:gap-2 transition-all">
        View details <ChevronRight size={14} />
      </div>
    </Link>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function LiveWidgets() {
  const town = useTown();
  const hasWeather = town.feature_flags.enableWeather;
  const hasTransit = town.feature_flags.enableTransit && !!town.transit_route;
  const hasCommunity = town.feature_flags.enableEvents || town.feature_flags.enableSafety;

  if (!hasWeather && !hasTransit && !hasCommunity) return null;

  return (
    <section className="mt-8 mb-4">
      <h2 className="text-2xl font-bold text-text-primary mb-5">
        Right Now in Needham
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hasWeather && <WeatherWidget />}
        {hasTransit && <TransitWidget />}
        {hasCommunity && <CommunityWidget />}
      </div>
    </section>
  );
}
