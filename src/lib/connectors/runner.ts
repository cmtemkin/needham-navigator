/**
 * src/lib/connectors/runner.ts — Connector execution engine
 *
 * Reads source_configs from Supabase, determines which connectors are due
 * to run based on their schedule, executes them, and upserts results into
 * content_items. Handles errors gracefully so one broken connector doesn't
 * block others.
 */

import { createHash } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/embeddings";
import { createConnector } from "./registry";
import type {
  ConnectorConfig,
  ConnectorResult,
  ConnectorSchedule,
  ContentItem,
} from "./types";
import { SCHEDULE_MS as scheduleMs } from "./types";

// ---------------------------------------------------------------------------
// Determine which connectors are due to run
// ---------------------------------------------------------------------------

function isDue(
  lastFetchedAt: string | null,
  schedule: ConnectorSchedule
): boolean {
  if (!lastFetchedAt) return true; // never run before
  const elapsed = Date.now() - new Date(lastFetchedAt).getTime();
  return elapsed >= scheduleMs[schedule];
}

// ---------------------------------------------------------------------------
// Load source configs from Supabase
// ---------------------------------------------------------------------------

async function loadSourceConfigs(
  townId?: string
): Promise<ConnectorConfig[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from("source_configs")
    .select("*")
    .eq("enabled", true);

  if (townId) {
    query = query.eq("town_id", townId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load source_configs: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    connector_type: row.connector_type,
    category: row.category,
    schedule: row.schedule as ConnectorSchedule,
    config: row.config ?? {},
    enabled: row.enabled,
    shouldEmbed: row.should_embed ?? false,
    _lastFetchedAt: row.last_fetched_at as string | null,
    _townId: row.town_id as string,
  }));
}

type LoadedConfig = ConnectorConfig & {
  _lastFetchedAt: string | null;
  _townId: string;
};

// ---------------------------------------------------------------------------
// Upsert content items into Supabase
// ---------------------------------------------------------------------------

async function upsertContentItems(
  townId: string,
  items: ContentItem[],
  shouldEmbed: boolean
): Promise<{ upserted: number; skipped: number }> {
  if (items.length === 0) return { upserted: 0, skipped: 0 };

  const supabase = getSupabaseServiceClient();
  let upserted = 0;
  let skipped = 0;

  for (const item of items) {
    // Generate embedding if configured
    let embedding: number[] | null = null;
    if (shouldEmbed && item.content) {
      const textToEmbed = `${item.title}\n\n${item.summary || item.content}`.slice(
        0,
        8000
      );
      try {
        embedding = await generateEmbedding(textToEmbed);
      } catch (err) {
        console.warn(
          `[runner] Failed to embed item "${item.title}": ${err}`
        );
      }
    }

    const row = {
      town_id: townId,
      source_id: item.source_id,
      category: item.category,
      title: item.title,
      content: item.content,
      summary: item.summary ?? null,
      published_at: item.published_at.toISOString(),
      expires_at: item.expires_at?.toISOString() ?? null,
      url: item.url ?? null,
      image_url: item.image_url ?? null,
      metadata: item.metadata,
      content_hash: item.content_hash,
      embedding,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("content_items").upsert(row, {
      onConflict: "town_id,source_id,content_hash",
      ignoreDuplicates: false,
    });

    if (error) {
      // Duplicate = skip (content hasn't changed)
      if (error.code === "23505") {
        skipped++;
      } else {
        console.error(
          `[runner] Upsert error for "${item.title}": ${error.message}`
        );
        skipped++;
      }
    } else {
      upserted++;
    }
  }

  return { upserted, skipped };
}

// ---------------------------------------------------------------------------
// Update source_config after a run
// ---------------------------------------------------------------------------

async function updateSourceConfig(
  configId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const update: Record<string, unknown> = {
    last_fetched_at: new Date().toISOString(),
  };

  if (success) {
    update.error_count = 0;
    update.last_error = null;
  } else {
    update.last_error = errorMessage ?? "Unknown error";
    // Increment error_count via raw update
    const { data } = await supabase
      .from("source_configs")
      .select("error_count")
      .eq("id", configId)
      .single();
    update.error_count = ((data?.error_count as number) ?? 0) + 1;
  }

  await supabase.from("source_configs").update(update).eq("id", configId);
}

// ---------------------------------------------------------------------------
// Run all due connectors for a town (or all towns)
// ---------------------------------------------------------------------------

export interface RunOptions {
  /** Run only connectors for this town. If omitted, run all towns. */
  townId?: string;
  /** Run only connectors matching this schedule. If omitted, run all due. */
  schedule?: ConnectorSchedule;
  /** Force run even if not due. */
  force?: boolean;
}

export async function runConnectors(
  options: RunOptions = {}
): Promise<ConnectorResult[]> {
  const configs = await loadSourceConfigs(options.townId);
  const results: ConnectorResult[] = [];

  for (const config of configs as LoadedConfig[]) {
    // Check if this connector is due
    if (!options.force && !isDue(config._lastFetchedAt, config.schedule)) {
      continue;
    }

    // Filter by schedule if specified
    if (options.schedule && config.schedule !== options.schedule) {
      continue;
    }

    const startTime = Date.now();
    const townId = options.townId ?? config._townId;

    try {
      // Create and run the connector
      const connector = createConnector(townId, config);
      const rawItems = await connector.fetch();
      const normalized = connector.normalize(rawItems);

      // Upsert into Supabase
      const { upserted, skipped } = await upsertContentItems(
        townId,
        normalized,
        config.shouldEmbed
      );

      await updateSourceConfig(config.id, true);

      results.push({
        connectorId: config.id,
        itemsFound: rawItems.length,
        itemsUpserted: upserted,
        itemsSkipped: skipped,
        errors: [],
        durationMs: Date.now() - startTime,
      });

      // Logging suppressed to comply with ESLint no-console rule
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[runner] ${config.id} FAILED: ${errorMsg}`);

      await updateSourceConfig(config.id, false, errorMsg);

      results.push({
        connectorId: config.id,
        itemsFound: 0,
        itemsUpserted: 0,
        itemsSkipped: 0,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Utility: content hash generation
// ---------------------------------------------------------------------------

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
