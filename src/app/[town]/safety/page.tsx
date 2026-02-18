"use client";

import { useState, useEffect } from "react";
import { Shield, Phone, ExternalLink, AlertTriangle, Flame, BadgeAlert } from "lucide-react";
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

const ITEMS_PER_PAGE = 20;
const FETCH_TIMEOUT_MS = 10000;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SafetyPage() {
  const town = useTown();
  const { openChat } = useChatWidget();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  // Find police and fire departments from config
  const policeDept = town.departments.find((d) =>
    d.name.toLowerCase().includes("police")
  );
  const fireDept = town.departments.find((d) =>
    d.name.toLowerCase().includes("fire")
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    async function fetchSafety() {
      setLoading(true);
      setError(false);

      try {
        const params = new URLSearchParams({
          town: town.town_id,
          category: "safety",
          limit: ITEMS_PER_PAGE.toString(),
          offset: "0",
        });

        const res = await fetch(`/api/content?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch safety info");

        const data = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Error fetching safety:", err);
          setError(true);
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    void fetchSafety();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [town.town_id, retryCount]);

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">Safety</span>
            </h1>
            <p className="text-lg text-white/90">
              Emergency contacts, public safety updates, and resources
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {/* Emergency Banner */}
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 text-red-800 font-bold text-lg mb-3">
              <AlertTriangle size={20} />
              Emergency: Call 911
            </div>
            <p className="text-[14px] text-red-700">
              For life-threatening emergencies, fires, or crimes in progress, always call 911 first.
            </p>
          </div>

          {/* Quick Contacts */}
          <h2 className="text-xl font-bold text-text-primary mb-4">Quick Contacts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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

            {!policeDept && !fireDept && (
              <div className="bg-white border border-border-light rounded-xl p-5 col-span-full">
                <p className="text-[14px] text-text-secondary">
                  Contact your local police and fire departments for non-emergency assistance.
                </p>
              </div>
            )}
          </div>

          {/* Safety Updates from content_items */}
          <h2 className="text-xl font-bold text-text-primary mb-4">Safety Updates</h2>

          {loading && (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white border border-border-light rounded-xl p-5 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12">
              <p className="text-text-secondary mb-4">Unable to load safety updates.</p>
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-5 py-2.5 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white border border-border-light rounded-xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <Shield size={18} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                        {item.title}
                      </h3>
                      {item.published_at && (
                        <p className="text-[12px] text-text-muted mb-2">
                          {formatDate(item.published_at)}
                        </p>
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
                          Read more
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🛡️</div>
              <h3 className="text-lg font-bold text-text-primary mb-2">No recent safety updates</h3>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Safety alerts and updates will appear here. Ask Navigator about public safety resources.
              </p>
              <button
                onClick={() => openChat(`What public safety resources are available in ${shortTownName}?`)}
                className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                Ask About Safety
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
