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
  DollarSign,
  Globe,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit3,
  ExternalLink,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "documents" | "analytics" | "costs" | "logs" | "settings" | "sources";

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

interface CostPeriodSummary {
  total_cost: number;
  total_requests: number;
  total_tokens: number;
}

interface CostSummaryData {
  today: CostPeriodSummary;
  week: CostPeriodSummary;
  month: CostPeriodSummary;
  daily: Array<{ date: string; cost: number; requests: number; tokens: number }>;
  by_model: Array<{ model: string; cost: number; requests: number }>;
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
// Costs Tab
// ---------------------------------------------------------------------------

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function CostsTab({ password }: { password: string }) {
  const [costs, setCosts] = useState<CostSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await adminFetch("/api/admin/costs", password);
      if (res.ok) setCosts(await res.json());
      else setError(true);
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

  if (error || !costs) {
    return <div className="text-center py-12 text-text-muted text-sm">Unable to load cost data.</div>;
  }

  const hasData = costs.month.total_requests > 0;

  if (!hasData) {
    return (
      <div className="text-center py-16">
        <DollarSign size={40} className="mx-auto text-text-muted mb-3 opacity-40" />
        <p className="text-sm text-text-muted">No cost data yet</p>
        <p className="text-xs text-text-muted mt-1">
          Costs will appear here after users start asking questions.
        </p>
      </div>
    );
  }

  const avgCostPerQuery = costs.month.total_requests > 0
    ? costs.month.total_cost / costs.month.total_requests
    : 0;

  const daysInMonth = new Date().getDate();
  const dailyAvg = daysInMonth > 0 ? costs.month.total_cost / daysInMonth : 0;
  const daysRemaining = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projectedMonthly = dailyAvg * daysRemaining;

  const maxDailyCost = Math.max(...costs.daily.map((d) => d.cost), 0.0001);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={DollarSign} label="Today" value={formatUsd(costs.today.total_cost)} />
        <KpiCard icon={DollarSign} label="This Week" value={formatUsd(costs.week.total_cost)} />
        <KpiCard icon={DollarSign} label="This Month" value={formatUsd(costs.month.total_cost)} />
        <KpiCard icon={TrendingUp} label="Projected Monthly" value={formatUsd(projectedMonthly)} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-border-default rounded-lg p-4">
          <span className="text-xs text-text-secondary">Avg Cost / Query</span>
          <div className="text-lg font-bold text-text-primary mt-1">{formatUsd(avgCostPerQuery)}</div>
        </div>
        <div className="bg-white border border-border-default rounded-lg p-4">
          <span className="text-xs text-text-secondary">Month Requests</span>
          <div className="text-lg font-bold text-text-primary mt-1">{costs.month.total_requests.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-border-default rounded-lg p-4">
          <span className="text-xs text-text-secondary">Month Tokens</span>
          <div className="text-lg font-bold text-text-primary mt-1">{costs.month.total_tokens.toLocaleString()}</div>
        </div>
      </div>

      {/* Daily Cost Chart (CSS bars) */}
      {costs.daily.length > 0 && (
        <div className="bg-white border border-border-default rounded-lg p-5 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <BarChart3 size={15} className="text-primary" />
            Daily Cost (Last 30 Days)
          </h3>
          <div className="flex items-end gap-[3px] h-32">
            {costs.daily.map((day) => {
              const pct = (day.cost / maxDailyCost) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 bg-primary/70 hover:bg-primary rounded-t transition-colors min-w-[4px] group relative"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                  title={`${day.date}: ${formatUsd(day.cost)} (${day.requests} req)`}
                >
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                    {day.date.slice(5)}: {formatUsd(day.cost)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-text-muted">
            <span>{costs.daily[0]?.date.slice(5)}</span>
            <span>{costs.daily[costs.daily.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Cost by Model */}
      {costs.by_model.length > 0 && (
        <div className="bg-white border border-border-default rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Cpu size={15} className="text-primary" />
            Cost by Model
          </h3>
          <div className="space-y-2">
            {costs.by_model.map((m) => {
              const pct = costs.month.total_cost > 0 ? (m.cost / costs.month.total_cost) * 100 : 0;
              return (
                <div key={m.model} className="flex items-center gap-3">
                  <code className="text-xs text-text-secondary w-40 truncate">{m.model}</code>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-text-secondary w-24 text-right">
                    {formatUsd(m.cost)} ({m.requests})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
// Source type
// ---------------------------------------------------------------------------

interface AdminSource {
  id: string;
  town_id: string;
  url: string;
  name: string;
  category: string;
  priority: number;
  update_frequency: string;
  document_type: string;
  max_depth: number;
  max_pages: number;
  is_active: boolean;
  last_scraped_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
}

const SOURCE_CATEGORIES = [
  "general", "government", "zoning", "permits", "public_works", "schools",
  "recreation", "public_safety", "health", "transportation", "property",
  "community", "news", "utilities", "regional", "social_media", "business_reviews",
];

// ---------------------------------------------------------------------------
// Sources Tab
// ---------------------------------------------------------------------------

function SourcesTab({ password }: { password: string }) {
  const [sources, setSources] = useState<AdminSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingSource, setEditingSource] = useState<AdminSource | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testResult, setTestResult] = useState<{ accessible: boolean; status: number } | null>(null);
  const [testingUrl, setTestingUrl] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formPriority, setFormPriority] = useState(3);
  const [formFrequency, setFormFrequency] = useState("weekly");
  const [formDocType, setFormDocType] = useState("html");
  const [formMaxDepth, setFormMaxDepth] = useState(2);
  const [formMaxPages, setFormMaxPages] = useState(10);
  const [formActive, setFormActive] = useState(true);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await adminFetch(`/api/admin/sources?${params}`, password);
    if (res.ok) {
      const data = await res.json();
      setSources(data.sources || []);
    }
    setLoading(false);
  }, [password, search, categoryFilter]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const resetForm = () => {
    setFormUrl("");
    setFormName("");
    setFormCategory("general");
    setFormPriority(3);
    setFormFrequency("weekly");
    setFormDocType("html");
    setFormMaxDepth(2);
    setFormMaxPages(10);
    setFormActive(true);
    setTestResult(null);
  };

  const populateForm = (source: AdminSource) => {
    setFormUrl(source.url);
    setFormName(source.name);
    setFormCategory(source.category);
    setFormPriority(source.priority);
    setFormFrequency(source.update_frequency);
    setFormDocType(source.document_type);
    setFormMaxDepth(source.max_depth);
    setFormMaxPages(source.max_pages);
    setFormActive(source.is_active);
    setTestResult(null);
  };

  const handleTestUrl = async () => {
    if (!formUrl) return;
    setTestingUrl(true);
    setTestResult(null);
    const res = await adminFetch("/api/admin/sources/test-url", password, {
      method: "POST",
      body: JSON.stringify({ url: formUrl }),
    });
    if (res.ok) {
      setTestResult(await res.json());
    }
    setTestingUrl(false);
  };

  const handleSave = async () => {
    if (!formUrl || !formName) return;
    const body = {
      url: formUrl,
      name: formName,
      category: formCategory,
      priority: formPriority,
      update_frequency: formFrequency,
      document_type: formDocType,
      max_depth: formMaxDepth,
      max_pages: formMaxPages,
      is_active: formActive,
    };

    if (editingSource) {
      await adminFetch(`/api/admin/sources/${editingSource.id}`, password, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      await adminFetch("/api/admin/sources", password, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    setEditingSource(null);
    setShowAddForm(false);
    resetForm();
    fetchSources();
  };

  const handleDelete = async (id: string) => {
    await adminFetch(`/api/admin/sources/${id}`, password, { method: "DELETE" });
    fetchSources();
  };

  const handleBulkToggle = async (active: boolean) => {
    for (const id of selectedIds) {
      await adminFetch(`/api/admin/sources/${id}`, password, {
        method: "PUT",
        body: JSON.stringify({ is_active: active }),
      });
    }
    setSelectedIds(new Set());
    fetchSources();
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await adminFetch(`/api/admin/sources/${id}`, password, { method: "DELETE" });
    }
    setSelectedIds(new Set());
    fetchSources();
  };

  const handleExport = async () => {
    const res = await adminFetch("/api/admin/sources/export", password);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sources.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    setImportResult(null);
    const res = await adminFetch("/api/admin/sources/import", password, {
      method: "POST",
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    if (res.ok) {
      setImportResult(`Imported ${data.imported} sources`);
      setCsvText("");
      setShowImport(false);
      fetchSources();
    } else {
      setImportResult(`Error: ${data.error}`);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Render add/edit form
  if (showAddForm || editingSource) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">
            {editingSource ? "Edit Source" : "Add Source"}
          </h2>
          <button
            onClick={() => { setShowAddForm(false); setEditingSource(null); resetForm(); }}
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-white rounded-lg border border-border-default p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">URL *</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://www.needhamma.gov/..."
                className="flex-1 px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleTestUrl}
                disabled={!formUrl || testingUrl}
                className="px-3 py-2 bg-gray-100 border border-border-default rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {testingUrl ? <RefreshCw size={14} className="animate-spin" /> : "Test URL"}
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 text-sm flex items-center gap-1 ${testResult.accessible ? "text-green-600" : "text-red-600"}`}>
                {testResult.accessible ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {testResult.accessible ? `Accessible (${testResult.status})` : `Not accessible (${testResult.status})`}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Town Homepage"
              className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {SOURCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Priority (1-5)</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {[1, 2, 3, 4, 5].map((p) => (
                  <option key={p} value={p}>{p} {"★".repeat(p)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Update Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {["hourly", "daily", "weekly", "monthly"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Document Type</label>
              <select
                value={formDocType}
                onChange={(e) => setFormDocType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {["html", "pdf", "rss"].map((t) => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Max Depth</label>
              <input
                type="number"
                value={formMaxDepth}
                onChange={(e) => setFormMaxDepth(Number(e.target.value))}
                min={0}
                max={10}
                className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Max Pages</label>
              <input
                type="number"
                value={formMaxPages}
                onChange={(e) => setFormMaxPages(Number(e.target.value))}
                min={1}
                max={100}
                className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="source-active"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="source-active" className="text-sm font-medium text-text-primary">Active</label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-light">
            <button
              onClick={handleSave}
              disabled={!formUrl || !formName}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {editingSource ? "Update Source" : "Add Source"}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setEditingSource(null); resetForm(); }}
              className="px-4 py-2 bg-white border border-border-default rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render import form
  if (showImport) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">Import Sources (CSV)</h2>
          <button onClick={() => { setShowImport(false); setCsvText(""); setImportResult(null); }} className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="bg-white rounded-lg border border-border-default p-6 space-y-4">
          <p className="text-sm text-text-secondary">
            Paste CSV with columns: url, name, category, priority, update_frequency, document_type, max_depth, max_pages
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 rounded-lg border border-border-default text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="url,name,category,priority,update_frequency,document_type,max_depth,max_pages&#10;https://example.com,Example,general,3,weekly,html,2,10"
          />
          {importResult && (
            <p className={`text-sm ${importResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {importResult}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={!csvText.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              Import
            </button>
            <button
              onClick={() => { setShowImport(false); setCsvText(""); setImportResult(null); }}
              className="px-4 py-2 bg-white border border-border-default rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Categories present in the data
  const categories = [...new Set(sources.map((s) => s.category))].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sources..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-default text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </select>

        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus size={14} /> Add Source
        </button>

        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border-default rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
        >
          <Upload size={14} /> Import CSV
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border-default rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} selected</span>
          <button onClick={() => handleBulkToggle(true)} className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200">
            Activate
          </button>
          <button onClick={() => handleBulkToggle(false)} className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200">
            Deactivate
          </button>
          <button onClick={handleBulkDelete} className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200">
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-600 hover:text-blue-800">
            Clear selection
          </button>
        </div>
      )}

      {/* Source count */}
      <div className="text-sm text-text-muted mb-3">
        {sources.length} source{sources.length !== 1 ? "s" : ""}
        {categoryFilter ? ` in ${categoryFilter.replace(/_/g, " ")}` : ""}
      </div>

      {/* Source table */}
      <div className="bg-white rounded-lg border border-border-default overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border-default">
            <tr>
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === sources.length && sources.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(sources.map((s) => s.id)));
                    else setSelectedIds(new Set());
                  }}
                  className="rounded"
                />
              </th>
              <th className="text-left px-3 py-3 font-medium text-text-secondary">Name</th>
              <th className="text-left px-3 py-3 font-medium text-text-secondary">Category</th>
              <th className="text-center px-3 py-3 font-medium text-text-secondary">Priority</th>
              <th className="text-left px-3 py-3 font-medium text-text-secondary">Frequency</th>
              <th className="text-center px-3 py-3 font-medium text-text-secondary">Status</th>
              <th className="text-right px-3 py-3 font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {sources.map((source) => {
              let hostname: string;
              try {
                hostname = new URL(source.url).hostname.replace(/^www\./, "");
              } catch {
                hostname = source.url;
              }

              return (
                <tr key={source.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(source.id)}
                      onChange={() => toggleSelection(source.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-text-primary">{source.name}</div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-muted hover:text-primary flex items-center gap-1"
                    >
                      {hostname}
                      <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {source.category.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-yellow-500 text-xs">
                      {"★".repeat(source.priority)}{"☆".repeat(5 - source.priority)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{source.update_frequency}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      source.is_active
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                    }`}>
                      {source.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { populateForm(source); setEditingSource(source); }}
                        className="p-1.5 rounded hover:bg-gray-100 text-text-muted hover:text-primary transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sources.length === 0 && (
          <div className="text-center py-12 text-text-secondary">
            <Globe size={32} className="mx-auto mb-3 text-text-muted" />
            <p>No sources found. Add your first source above.</p>
          </div>
        )}
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
    { id: "costs", label: "Costs", icon: DollarSign },
    { id: "logs", label: "Ingestion Logs", icon: Activity },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "sources", label: "Sources", icon: Globe },
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
        {activeTab === "costs" && <CostsTab password={password} />}
        {activeTab === "logs" && <LogsTab password={password} />}
        {activeTab === "settings" && <SettingsTab password={password} />}
        {activeTab === "sources" && <SourcesTab password={password} />}
      </main>
    </div>
  );
}
