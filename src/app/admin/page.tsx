"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LogIn,
  Clock,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Database,
  Layers,
  Activity,
  ChevronLeft,
  Search,
  RotateCcw,
  Eye,
  Settings,
  Save,
  Cpu,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "documents" | "analytics" | "logs" | "settings";

interface AdminDocument {
  id: string;
  url: string;
  title: string;
  source_type: string;
  status: "current" | "stale" | "error";
  is_stale: boolean;
  chunk_count: number;
  last_ingested_at: string | null;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
}

interface Analytics {
  total_documents: number;
  total_chunks: number;
  total_conversations: number;
  total_feedback: number;
  feedback_breakdown: { helpful: number; not_helpful: number; unknown: number };
  top_topics: Array<{ topic: string; count: number }>;
  avg_confidence: number | null;
  confidence_distribution: {
    high: number;
    medium: number;
    low: number;
  } | null;
}

interface IngestionLog {
  id: string;
  action: string;
  documents_processed: number;
  errors: number;
  duration_ms: number;
  details: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function statusBadge(status: "current" | "stale" | "error") {
  const config = {
    current: {
      icon: CheckCircle2,
      label: "Current",
      className: "bg-green-50 text-green-700 border-green-200",
    },
    stale: {
      icon: AlertTriangle,
      label: "Stale",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    error: {
      icon: XCircle,
      label: "Error",
      className: "bg-red-50 text-red-700 border-red-200",
    },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}
    >
      <Icon size={12} />
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Auth-gated fetch helper
// ---------------------------------------------------------------------------

async function adminFetch(path: string, password: string, options?: RequestInit) {
  return fetch(path, {
    ...options,
    headers: {
      ...options?.headers,
      "x-admin-password": password,
      "Content-Type": "application/json",
    },
  });
}

// ---------------------------------------------------------------------------
// Login screen
// ---------------------------------------------------------------------------

function LoginScreen({ onLogin }: { onLogin: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await adminFetch("/api/admin/documents", password);
    if (res.ok) {
      onLogin(password);
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-border-default shadow-sm p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-extrabold text-xl">
              N
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-text-primary mb-1">
            Admin Dashboard
          </h1>
          <p className="text-sm text-text-secondary text-center mb-6">
            Needham Navigator
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="admin-password" className="block text-sm font-medium text-text-primary mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Enter admin password"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">Invalid password. Please try again.</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document Management Tab
// ---------------------------------------------------------------------------

function DocumentsTab({ password }: { password: string }) {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "current" | "stale" | "error">("all");
  const [search, setSearch] = useState("");
  const [reingestingId, setReingestingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch("/api/admin/documents", password);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents || []);
    }
    setLoading(false);
  }, [password]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleReingest = async (doc: AdminDocument) => {
    setReingestingId(doc.id);
    await adminFetch("/api/admin/ingest", password, {
      method: "POST",
      body: JSON.stringify({ source_url: doc.url }),
    });
    setTimeout(() => {
      setReingestingId(null);
      fetchDocuments();
    }, 1500);
  };

  const filtered = documents.filter((doc) => {
    if (filter !== "all" && doc.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.url.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: documents.length,
    current: documents.filter((d) => d.status === "current").length,
    stale: documents.filter((d) => d.status === "stale").length,
    error: documents.filter((d) => d.status === "error").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "current", "stale", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === f
                ? "bg-primary text-white border-primary"
                : "bg-white text-text-secondary border-border-default hover:border-primary/40"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">No documents found.</div>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} className="bg-white border border-border-default rounded-lg p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={14} className="text-primary shrink-0" />
                    <span className="text-sm font-medium text-text-primary truncate">{doc.title}</span>
                    {statusBadge(doc.status)}
                  </div>
                  <p className="text-xs text-text-muted truncate mb-2">{doc.url}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1"><Layers size={11} />{doc.chunk_count} chunks</span>
                    <span className="inline-flex items-center gap-1"><Clock size={11} />Ingested {formatDate(doc.last_ingested_at)}</span>
                    <span className="inline-flex items-center gap-1"><Eye size={11} />Verified {formatDate(doc.last_verified_at)}</span>
                    <span className="inline-flex items-center gap-1 uppercase">{doc.source_type}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleReingest(doc)}
                  disabled={reingestingId === doc.id}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-50"
                  title="Re-ingest this document"
                >
                  <RotateCcw size={12} className={reingestingId === doc.id ? "animate-spin" : ""} />
                  Re-ingest
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics Tab
// ---------------------------------------------------------------------------

function AnalyticsTab({ password }: { password: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/analytics", password);
      if (res.ok) setAnalytics(await res.json());
      setLoading(false);
    })();
  }, [password]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center py-12 text-text-muted text-sm">Unable to load analytics.</div>;
  }

  const totalFeedback = analytics.feedback_breakdown.helpful + analytics.feedback_breakdown.not_helpful + analytics.feedback_breakdown.unknown;
  const helpfulPct = totalFeedback > 0 ? Math.round((analytics.feedback_breakdown.helpful / totalFeedback) * 100) : 0;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Database} label="Documents" value={analytics.total_documents} />
        <KpiCard icon={Layers} label="Chunks" value={analytics.total_chunks} />
        <KpiCard icon={MessageSquare} label="Conversations" value={analytics.total_conversations} />
        <KpiCard icon={ThumbsUp} label="Helpful Rate" value={totalFeedback > 0 ? `${helpfulPct}%` : "N/A"} />
      </div>

      {analytics.confidence_distribution && (
        <div className="bg-white border border-border-default rounded-lg p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Activity size={15} className="text-primary" />
            Confidence Score Distribution
          </h3>
          {analytics.avg_confidence !== null && (
            <p className="text-xs text-text-secondary mb-3">
              Average confidence: <span className="font-medium text-text-primary">{(analytics.avg_confidence * 100).toFixed(1)}%</span>
            </p>
          )}
          <div className="space-y-2">
            {(["high", "medium", "low"] as const).map((level) => {
              const dist = analytics.confidence_distribution!;
              const total = dist.high + dist.medium + dist.low;
              const colors = { high: "bg-green-500", medium: "bg-yellow-500", low: "bg-orange-500" };
              return <ConfidenceBar key={level} label={level.charAt(0).toUpperCase() + level.slice(1)} count={dist[level]} total={total} color={colors[level]} />;
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-border-default rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <ThumbsUp size={15} className="text-primary" />
          Feedback Breakdown
        </h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <ThumbsUp size={14} className="text-green-600" />
            <span className="text-text-secondary">Helpful:</span>
            <span className="font-medium">{analytics.feedback_breakdown.helpful}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThumbsDown size={14} className="text-red-500" />
            <span className="text-text-secondary">Not helpful:</span>
            <span className="font-medium">{analytics.feedback_breakdown.not_helpful}</span>
          </div>
        </div>
      </div>

      {analytics.top_topics.length > 0 && (
        <div className="bg-white border border-border-default rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-primary" />
            Popular Topics
          </h3>
          <div className="flex flex-wrap gap-2">
            {analytics.top_topics.map((t) => (
              <span key={t.topic} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 text-primary rounded-full text-xs font-medium">
                {t.topic}
                <span className="text-primary/60">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function KpiCard({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: string | number }) {
  return (
    <div className="bg-white border border-border-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-primary" />
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
    </div>
  );
}

function ConfidenceBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-16">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-secondary w-16 text-right">{count} ({Math.round(pct)}%)</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingestion Logs Tab
// ---------------------------------------------------------------------------

function LogsTab({ password }: { password: string }) {
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/logs", password);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
      setLoading(false);
    })();
  }, [password]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <div className="text-center py-12 text-text-muted text-sm">No ingestion logs yet.</div>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const hasErrors = log.errors > 0;
        return (
          <div key={log.id} className="bg-white border border-border-default rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                    log.action === "monitor"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : log.action === "crawl"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {log.action}
                </span>
                {hasErrors ? (
                  <span className="inline-flex items-center gap-1 text-xs text-red-600">
                    <XCircle size={12} />
                    {log.errors} error{log.errors !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 size={12} />
                    Success
                  </span>
                )}
              </div>
              <span className="text-xs text-text-muted">{formatDate(log.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span>{log.documents_processed} doc{log.documents_processed !== 1 ? "s" : ""} processed</span>
              <span>{formatDuration(log.duration_ms)}</span>
              {typeof log.details?.mode === "string" && (
                <span className="text-text-muted">Mode: {log.details.mode}</span>
              )}
              {typeof log.details?.source_url === "string" && (
                <span className="text-text-muted truncate max-w-[300px]">URL: {log.details.source_url}</span>
              )}
              {Array.isArray(log.details?.changed_urls) && (
                <span className="text-text-muted">{(log.details.changed_urls as string[]).length} changed</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

interface AvailableModel {
  id: string;
  label: string;
  inputPrice: number;
  outputPrice: number;
}

function SettingsTab({ password }: { password: string }) {
  const [chatModel, setChatModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/settings", password);
      if (res.ok) {
        const data = await res.json();
        setChatModel(data.chat_model || "");
        setAvailableModels(data.available_models || []);
      }
      setLoading(false);
    })();
  }, [password]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await adminFetch("/api/admin/settings", password, {
      method: "PUT",
      body: JSON.stringify({ chat_model: chatModel }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save settings");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const selectedModel = availableModels.find((m) => m.id === chatModel);

  return (
    <div>
      <div className="bg-white border border-border-default rounded-lg p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
          <Cpu size={15} className="text-primary" />
          Chat Model
        </h3>
        <p className="text-xs text-text-muted mb-4">
          Select the OpenAI model used for chat responses. Changes take effect immediately.
        </p>

        <div className="space-y-2 mb-4">
          {availableModels.map((model) => (
            <label
              key={model.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                chatModel === model.id
                  ? "border-primary bg-primary/5"
                  : "border-border-default hover:border-primary/30"
              }`}
            >
              <input
                type="radio"
                name="chatModel"
                value={model.id}
                checked={chatModel === model.id}
                onChange={() => setChatModel(model.id)}
                className="accent-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{model.label}</span>
                  <code className="text-[11px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{model.id}</code>
                </div>
                <span className="text-xs text-text-secondary">
                  ${model.inputPrice.toFixed(2)}/M input &middot; ${model.outputPrice.toFixed(2)}/M output
                </span>
              </div>
            </label>
          ))}
        </div>

        {selectedModel && (
          <div className="text-xs text-text-muted mb-4 p-3 bg-surface rounded-lg">
            Estimated cost per chat: ~$0.000{Math.round(selectedModel.inputPrice * 2 + selectedModel.outputPrice * 0.5).toString().padStart(2, "0")} (based on ~2K input + ~500 output tokens)
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 size={14} />
              Saved
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1 text-sm text-red-600">
              <XCircle size={14} />
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Dashboard
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const router = useRouter();
  const [password, setPassword] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("documents");

  if (!password) {
    return <LoginScreen onLogin={setPassword} />;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: "documents", label: "Documents", icon: FileText },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "logs", label: "Ingestion Logs", icon: Activity },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-border-default">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors">
              <ChevronLeft size={16} />
              Home
            </button>
            <div className="w-px h-5 bg-border-default" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold text-xs">N</div>
              <span className="text-sm font-semibold text-text-primary">Admin Dashboard</span>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-border-default">
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex gap-0" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {activeTab === "documents" && <DocumentsTab password={password} />}
        {activeTab === "analytics" && <AnalyticsTab password={password} />}
        {activeTab === "logs" && <LogsTab password={password} />}
        {activeTab === "settings" && <SettingsTab password={password} />}
      </main>
    </div>
  );
}
