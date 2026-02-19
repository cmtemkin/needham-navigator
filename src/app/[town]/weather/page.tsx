"use client";

import { useState, useEffect } from "react";
import { Thermometer, Droplets, Wind, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";

type ForecastPeriod = {
  number: number;
  name: string;
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
  relativeHumidity?: { value: number };
  dewpoint?: { value: number };
};

type WeatherData = {
  periods: ForecastPeriod[];
  updatedAt: string;
};

const FETCH_TIMEOUT_MS = 10000;

export default function WeatherPage() {
  const town = useTown();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchWeather() {
      setLoading(true);
      setError(null);

      try {
        // NWS API: first get the grid point for our coordinates
        const pointRes = await fetch(
          `https://api.weather.gov/points/${town.location.lat},${town.location.lng}`,
          {
            signal: controller.signal,
            headers: { "User-Agent": "TownNavigator/1.0" },
          }
        );

        if (!pointRes.ok) throw new Error("Unable to get weather location");

        const pointData = await pointRes.json();
        const forecastUrl = pointData.properties?.forecast;

        if (!forecastUrl) throw new Error("No forecast URL available");

        const forecastRes = await fetch(forecastUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "TownNavigator/1.0" },
        });

        if (!forecastRes.ok) throw new Error("Unable to fetch forecast");

        const forecastData = await forecastRes.json();
        const periods = forecastData.properties?.periods ?? [];

        setWeather({
          periods,
          updatedAt: forecastData.properties?.updateTime ?? new Date().toISOString(),
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Weather fetch error:", err);
          setError("Unable to load weather data. Please try again.");
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    fetchWeather().catch(() => {});
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.location.lat, town.location.lng]);

  const currentPeriod = weather?.periods[0] ?? null;

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-8 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-3xl font-bold mb-2">
              {shortTownName} <span className="text-[var(--accent)]">Weather</span>
            </h1>
            <p className="text-base text-white/90">
              Current conditions and forecast from the National Weather Service
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {loading && (
            <div className="space-y-4">
              <div className="bg-white border border-border-light rounded-xl p-8 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
                <div className="h-16 bg-gray-100 rounded w-1/4 mb-4" />
                <div className="h-5 bg-gray-100 rounded w-2/3" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={`skeleton-${i}`} className="bg-white border border-border-light rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                    <div className="h-6 bg-gray-100 rounded w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🌧️</div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Weather Unavailable</h2>
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

          {!loading && !error && weather && currentPeriod && (
            <>
              {/* Current Conditions */}
              <div className="bg-white border border-border-light rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary mb-1">
                      {currentPeriod.name}
                    </h2>
                    <p className="text-sm text-text-muted">
                      Updated {new Date(weather.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {currentPeriod.icon && (
                    <img
                      src={currentPeriod.icon}
                      alt={currentPeriod.shortForecast}
                      className="w-16 h-16 rounded-lg"
                    />
                  )}
                </div>

                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-5xl font-bold text-text-primary">
                    {currentPeriod.temperature}°{currentPeriod.temperatureUnit}
                  </span>
                  <span className="text-lg text-text-secondary">
                    {currentPeriod.shortForecast}
                  </span>
                </div>

                <p className="text-[14px] text-text-secondary leading-relaxed">
                  {currentPeriod.detailedForecast}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-border-light">
                  <div className="flex items-center gap-2">
                    <Wind size={16} className="text-[var(--primary)]" />
                    <div>
                      <div className="text-[12px] text-text-muted">Wind</div>
                      <div className="text-[14px] font-medium text-text-primary">
                        {currentPeriod.windSpeed} {currentPeriod.windDirection}
                      </div>
                    </div>
                  </div>
                  {currentPeriod.relativeHumidity && (
                    <div className="flex items-center gap-2">
                      <Droplets size={16} className="text-[var(--primary)]" />
                      <div>
                        <div className="text-[12px] text-text-muted">Humidity</div>
                        <div className="text-[14px] font-medium text-text-primary">
                          {currentPeriod.relativeHumidity.value}%
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Thermometer size={16} className="text-[var(--primary)]" />
                    <div>
                      <div className="text-[12px] text-text-muted">Feels Like</div>
                      <div className="text-[14px] font-medium text-text-primary">
                        {currentPeriod.temperature}°{currentPeriod.temperatureUnit}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7-Day Forecast */}
              <h2 className="text-xl font-bold text-text-primary mb-4">Extended Forecast</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {weather.periods.slice(1, 14).map((period) => (
                  <div
                    key={period.number}
                    className="bg-white border border-border-light rounded-xl p-4 flex items-center gap-4"
                  >
                    {period.icon && (
                      <img
                        src={period.icon}
                        alt={period.shortForecast}
                        className="w-12 h-12 rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-[15px] font-semibold text-text-primary">
                          {period.name}
                        </h3>
                        <span className="text-[15px] font-bold text-text-primary flex-shrink-0">
                          {period.temperature}°{period.temperatureUnit}
                        </span>
                      </div>
                      <p className="text-[13px] text-text-secondary mt-0.5">
                        {period.shortForecast} · Wind {period.windSpeed} {period.windDirection}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[12px] text-text-muted text-center mt-6">
                Weather data provided by the National Weather Service (weather.gov)
              </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
