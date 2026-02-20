import { getSupabaseServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Model pricing (USD per 1M tokens) — update when prices change
// ---------------------------------------------------------------------------

export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Chat models
  "gpt-5-nano":                { input: 0.10, output: 0.40 },
  "gpt-5-mini":                { input: 0.30, output: 1.20 },
  "gpt-4o-mini":               { input: 0.15, output: 0.60 },
  "gpt-4.1-mini":              { input: 0.40, output: 1.60 },
  // Embedding models
  "text-embedding-3-small":    { input: 0.02, output: 0 },
  "text-embedding-3-large":    { input: 0.13, output: 0 },
};

// ---------------------------------------------------------------------------
// Calculate cost from token counts
// ---------------------------------------------------------------------------

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_COSTS[model];
  if (!pricing) return 0;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Log a single API cost to the database (fire-and-forget)
// ---------------------------------------------------------------------------

export interface TrackCostParams {
  townId?: string;
  endpoint: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  metadata?: Record<string, unknown>;
}

export async function trackCost(params: TrackCostParams): Promise<void> {
  // Sample embedding cost tracking at 5% to reduce write IO
  // Chat/search costs are less frequent and always logged
  if (params.endpoint === 'embedding' && Math.random() > 0.05) return;

  const estimatedCost = calculateCost(params.model, params.promptTokens, params.completionTokens);
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.from("api_costs").insert({
    town_id: params.townId ?? "needham",
    endpoint: params.endpoint,
    model: params.model,
    prompt_tokens: params.promptTokens,
    completion_tokens: params.completionTokens,
    total_tokens: params.totalTokens,
    estimated_cost_usd: estimatedCost,
    metadata: params.metadata ?? null,
  });

  if (error) {
    console.error("[cost-tracker] Failed to log cost:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Cost summary for the admin dashboard
// ---------------------------------------------------------------------------

export interface PeriodSummary {
  total_cost: number;
  total_requests: number;
  total_tokens: number;
}

export interface DailyBreakdown {
  date: string;
  cost: number;
  requests: number;
  tokens: number;
}

export interface ModelBreakdown {
  model: string;
  cost: number;
  requests: number;
}

export interface CostSummary {
  today: PeriodSummary;
  week: PeriodSummary;
  month: PeriodSummary;
  daily: DailyBreakdown[];
  by_model: ModelBreakdown[];
}

export async function getCostSummary(townId: string = "needham"): Promise<CostSummary> {
  const supabase = getSupabaseServiceClient();

  // Fetch last 30 days of cost data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: rows, error } = await supabase
    .from("api_costs")
    .select("estimated_cost_usd, total_tokens, model, created_at")
    .eq("town_id", townId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    // Table may not exist yet (migration not run) — return empty data
    // so the UI shows the friendly "no data yet" state instead of an error.
    if (error.code === "42P01" || error.message.includes("api_costs")) {
      const empty: PeriodSummary = { total_cost: 0, total_requests: 0, total_tokens: 0 };
      return { today: { ...empty }, week: { ...empty }, month: { ...empty }, daily: [], by_model: [] };
    }
    throw new Error(`Failed to fetch cost data: ${error.message}`);
  }

  const allRows = (rows ?? []) as Array<{
    estimated_cost_usd: number;
    total_tokens: number;
    model: string;
    created_at: string;
  }>;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const today: PeriodSummary = { total_cost: 0, total_requests: 0, total_tokens: 0 };
  const week: PeriodSummary = { total_cost: 0, total_requests: 0, total_tokens: 0 };
  const month: PeriodSummary = { total_cost: 0, total_requests: 0, total_tokens: 0 };

  const dailyMap = new Map<string, { cost: number; requests: number; tokens: number }>();
  const modelMap = new Map<string, { cost: number; requests: number }>();

  for (const row of allRows) {
    const cost = Number(row.estimated_cost_usd);
    const tokens = row.total_tokens;
    const date = new Date(row.created_at);
    const dateStr = date.toISOString().slice(0, 10);

    // Daily aggregation
    const daily = dailyMap.get(dateStr) ?? { cost: 0, requests: 0, tokens: 0 };
    daily.cost += cost;
    daily.requests += 1;
    daily.tokens += tokens;
    dailyMap.set(dateStr, daily);

    // Model aggregation
    const model = modelMap.get(row.model) ?? { cost: 0, requests: 0 };
    model.cost += cost;
    model.requests += 1;
    modelMap.set(row.model, model);

    // Period aggregation
    if (dateStr === todayStr) {
      today.total_cost += cost;
      today.total_requests += 1;
      today.total_tokens += tokens;
    }
    if (date >= startOfWeek) {
      week.total_cost += cost;
      week.total_requests += 1;
      week.total_tokens += tokens;
    }
    if (date >= startOfMonth) {
      month.total_cost += cost;
      month.total_requests += 1;
      month.total_tokens += tokens;
    }
  }

  const daily: DailyBreakdown[] = Array.from(dailyMap.entries())
    .map(([date, d]) => ({ date, cost: d.cost, requests: d.requests, tokens: d.tokens }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const by_model: ModelBreakdown[] = Array.from(modelMap.entries())
    .map(([model, m]) => ({ model, cost: m.cost, requests: m.requests }))
    .sort((a, b) => b.cost - a.cost);

  return { today, week, month, daily, by_model };
}
