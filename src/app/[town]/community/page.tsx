"use client";

import { useState, useEffect } from "react";
import {
  Shield, Phone, ExternalLink, AlertTriangle, Flame, BadgeAlert,
  Calendar, MapPin, Clock, UtensilsCrossed, Star,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";

type ContentItem = {
  id: string;
  title: string;
  content: string | null;
  summary: string | null;
  published_at: string | null;
  url: string | null;
  metadata: Record<string, string> | null;
  category: string;
};

const FETCH_TIMEOUT_MS = 10000;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CommunityPage() {
  const town = useTown();
  const { openChat } = useChatWidget();

  const [safetyItems, setSafetyItems] = useState<ContentItem[]>([]);
  const [safetyLoading, setSafetyLoading] = useState(true);

  const [eventItems, setEventItems] = useState<ContentItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [diningItems, setDiningItems] = useState<ContentItem[]>([]);
  const [diningLoading, setDiningLoading] = useState(true);

  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  // Find police and fire departments from config
  const policeDept = town.departments.find((d) =>
    d.name.toLowerCase().includes("police")
  );
  const fireDept = town.departments.find((d) =>
    d.name.toLowerCase().includes("fire")
  );

  // Fetch safety updates
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchSafety() {
      try {
        const params = new URLSearchParams({
          town: town.town_id,
          category: "safety",
          limit: "10",
          offset: "0",
        });
        const res = await fetch(`/api/content?${params}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setSafetyItems(data.items ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching safety:", err);
        }
      } finally {
        clearTimeout(timeout);
        setSafetyLoading(false);
      }
    }

    fetchSafety().catch(() => {});
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id]);

  // Fetch events
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchEvents() {
      try {
        const params = new URLSearchParams({
          town: town.town_id,
          category: "events",
          limit: "10",
          offset: "0",
        });
        const res = await fetch(`/api/content?${params}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setEventItems(data.items ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching events:", err);
        }
      } finally {
        clearTimeout(timeout);
        setEventsLoading(false);
      }
    }

    fetchEvents().catch(() => {});
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id]);

  // Fetch dining
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchDining() {
      try {
        const params = new URLSearchParams({
          town: town.town_id,
          category: "dining",
          limit: "10",
          offset: "0",
        });
        const res = await fetch(`/api/content?${params}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setDiningItems(data.items ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching dining:", err);
        }
      } finally {
        clearTimeout(timeout);
        setDiningLoading(false);
      }
    }

    fetchDining().catch(() => {});
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id]);

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        {/* Hero Banner */}
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">Community</span>
            </h1>
            <p className="text-lg text-white/90">
              Local resources, events, dining, and safety information
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Section 1: Emergency & Safety */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <section id="safety" className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Shield size={22} className="text-[var(--primary)]" />
              <h2 className="text-2xl font-bold text-text-primary">Emergency & Safety</h2>
            </div>

            {/* Emergency Banner */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 text-red-800 font-bold text-lg mb-2">
                <AlertTriangle size={20} />
                Emergency: Call 911
              </div>
              <p className="text-[14px] text-red-700">
                For life-threatening emergencies, fires, or crimes in progress, always call 911 first.
              </p>
            </div>

            {/* Quick Contacts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {policeDept && (
                <div className="bg-white border border-border-light rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <BadgeAlert size={20} className="text-blue-700" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-text-primary">{policeDept.name}</h3>
                      <p className="text-[13px] text-text-muted">Non-emergency</p>
                    </div>
                  </div>
                  <a
                    href={`tel:${policeDept.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-2 text-[15px] text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors"
                  >
                    <Phone size={16} />
                    {policeDept.phone}
                  </a>
                </div>
              )}

              {fireDept && (
                <div className="bg-white border border-border-light rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Flame size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-text-primary">{fireDept.name}</h3>
                      <p className="text-[13px] text-text-muted">Non-emergency</p>
                    </div>
                  </div>
                  <a
                    href={`tel:${fireDept.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-2 text-[15px] text-[var(--primary)] font-semibold hover:text-[var(--primary-dark)] transition-colors"
                  >
                    <Phone size={16} />
                    {fireDept.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Safety Updates */}
            <h3 className="text-lg font-semibold text-text-primary mb-3">Safety Updates</h3>
            {safetyLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={`safety-skeleton-${i}`} className="bg-white border border-border-light rounded-xl p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                ))}
              </div>
            )}

            {!safetyLoading && safetyItems.length > 0 && (
              <div className="space-y-3">
                {safetyItems.map((item) => (
                  <div key={item.id} className="bg-white border border-border-light rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <Shield size={18} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-semibold text-text-primary mb-1">{item.title}</h4>
                        {item.published_at && (
                          <p className="text-[12px] text-text-muted mb-2">{formatDate(item.published_at)}</p>
                        )}
                        {(item.summary || item.content) && (
                          <p className="text-[14px] text-text-secondary line-clamp-3">
                            {item.summary || item.content}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[13px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium mt-2 transition-colors"
                          >
                            Read more <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!safetyLoading && safetyItems.length === 0 && (
              <div className="bg-white border border-border-light rounded-xl p-6 text-center">
                <p className="text-text-secondary text-[14px] mb-3">No recent safety updates.</p>
                <button
                  onClick={() => openChat(`What public safety resources are available in ${shortTownName}?`)}
                  className="px-5 py-2.5 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors text-sm"
                >
                  Ask About Safety
                </button>
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Section 2: Events */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <section id="events" className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Calendar size={22} className="text-[var(--primary)]" />
              <h2 className="text-2xl font-bold text-text-primary">Events</h2>
            </div>

            {eventsLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={`events-skeleton-${i}`} className="bg-white border border-border-light rounded-xl p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                ))}
              </div>
            )}

            {!eventsLoading && eventItems.length > 0 && (
              <div className="space-y-3">
                {eventItems.map((item) => (
                  <div key={item.id} className="bg-white border border-border-light rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-semibold text-text-primary mb-2">{item.title}</h4>
                        <div className="flex flex-wrap gap-3 text-[13px] text-text-secondary mb-2">
                          {item.published_at && (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} className="text-[var(--primary)]" />
                              {formatEventDate(item.published_at)}
                            </span>
                          )}
                          {item.published_at && (
                            <span className="flex items-center gap-1">
                              <Clock size={14} className="text-[var(--primary)]" />
                              {formatEventTime(item.published_at)}
                            </span>
                          )}
                          {item.metadata?.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} className="text-[var(--primary)]" />
                              {item.metadata.location}
                            </span>
                          )}
                        </div>
                        {(item.summary || item.content) && (
                          <p className="text-[14px] text-text-secondary line-clamp-2">
                            {item.summary || item.content}
                          </p>
                        )}
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1 text-[13px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors"
                        >
                          Details <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!eventsLoading && eventItems.length === 0 && (
              <div className="bg-white border border-border-light rounded-xl p-6 text-center">
                <p className="text-text-secondary text-[14px] mb-3">No events listed yet. Check back soon!</p>
                <button
                  onClick={() => openChat(`What events are coming up in ${shortTownName}?`)}
                  className="px-5 py-2.5 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors text-sm"
                >
                  Ask About Events
                </button>
              </div>
            )}
          </section>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Section 3: Local Dining */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <section id="dining" className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <UtensilsCrossed size={22} className="text-[var(--primary)]" />
              <h2 className="text-2xl font-bold text-text-primary">Local Dining</h2>
            </div>

            {diningLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={`dining-skeleton-${i}`} className="bg-white border border-border-light rounded-xl p-5 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!diningLoading && diningItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {diningItems.map((item) => (
                  <div key={item.id} className="bg-white border border-border-light rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
                        <UtensilsCrossed size={18} className="text-[var(--primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[15px] font-semibold text-text-primary mb-1">{item.title}</h4>
                        <div className="flex flex-wrap gap-2 text-[13px] text-text-secondary mb-2">
                          {item.metadata?.address && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {item.metadata.address}
                            </span>
                          )}
                          {item.metadata?.hours && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> {item.metadata.hours}
                            </span>
                          )}
                          {item.metadata?.rating && (
                            <span className="flex items-center gap-1">
                              <Star size={12} className="text-yellow-500" /> {item.metadata.rating}
                            </span>
                          )}
                        </div>
                        {(item.summary || item.content) && (
                          <p className="text-[13px] text-text-secondary line-clamp-2">
                            {item.summary || item.content}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[13px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium mt-2 transition-colors"
                          >
                            Visit <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!diningLoading && diningItems.length === 0 && (
              <div className="bg-white border border-border-light rounded-xl p-6 text-center">
                <p className="text-text-secondary text-[14px] mb-3">Local dining listings coming soon.</p>
                <button
                  onClick={() => openChat(`What are some good restaurants in ${shortTownName}?`)}
                  className="px-5 py-2.5 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors text-sm"
                >
                  Ask About Dining
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
