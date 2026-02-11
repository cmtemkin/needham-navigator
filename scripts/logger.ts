/**
 * scripts/logger.ts — Structured logging for ingestion pipeline
 *
 * Provides a consistent logging interface that:
 * 1. Logs to console with structured formatting
 * 2. Persists ingestion run summaries to the Supabase ingestion_log table
 * 3. Tracks success/failure counts per pipeline stage
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageResult {
  stage: string;
  success: number;
  failed: number;
  skipped: number;
  durationMs: number;
  details?: Record<string, unknown>;
}

export interface IngestionRunSummary {
  townId: string;
  action: string;
  stages: StageResult[];
  totalDocumentsProcessed: number;
  totalErrors: number;
  totalDurationMs: number;
  triggeredBy: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Stage timer
// ---------------------------------------------------------------------------

export class StageTimer {
  private startTime: number;
  readonly stage: string;
  success = 0;
  failed = 0;
  skipped = 0;
  private extras: Record<string, unknown> = {};

  constructor(stage: string) {
    this.stage = stage;
    this.startTime = Date.now();
    console.log(`\n--- [${stage}] Starting ---`);
  }

  recordSuccess(count = 1): void { this.success += count; }

  recordFailure(count = 1, reason?: string): void {
    this.failed += count;
    if (reason) console.error(`  [${this.stage}] FAILURE: ${reason}`);
  }

  recordSkip(count = 1, reason?: string): void {
    this.skipped += count;
    if (reason) console.log(`  [${this.stage}] SKIP: ${reason}`);
  }

  addDetail(key: string, value: unknown): void { this.extras[key] = value; }

  finish(): StageResult {
    const durationMs = Date.now() - this.startTime;
    const result: StageResult = {
      stage: this.stage,
      success: this.success,
      failed: this.failed,
      skipped: this.skipped,
      durationMs,
      details: Object.keys(this.extras).length > 0 ? this.extras : undefined,
    };
    console.log(
      `--- [${this.stage}] Complete: ${this.success} succeeded, ${this.failed} failed, ${this.skipped} skipped (${formatDuration(durationMs)}) ---`
    );
    return result;
  }
}

// ---------------------------------------------------------------------------
// Run logger
// ---------------------------------------------------------------------------

export class IngestionLogger {
  private startTime: number;
  private stages: StageResult[] = [];
  private readonly townId: string;
  private readonly action: string;
  private readonly triggeredBy: string;

  constructor(options: { townId?: string; action: string; triggeredBy?: string }) {
    this.townId = options.townId || "needham";
    this.action = options.action;
    this.triggeredBy = options.triggeredBy || "cli";
    this.startTime = Date.now();

    console.log("=".repeat(60));
    console.log(`[${this.action}] Starting ingestion run for town: ${this.townId}`);
    console.log(`  Triggered by: ${this.triggeredBy}`);
    console.log(`  Time: ${new Date().toISOString()}`);
    console.log("=".repeat(60));
  }

  startStage(name: string): StageTimer { return new StageTimer(name); }
  addStageResult(result: StageResult): void { this.stages.push(result); }

  async finish(extraDetails?: Record<string, unknown>): Promise<IngestionRunSummary> {
    const totalDurationMs = Date.now() - this.startTime;
    const totalDocumentsProcessed = this.stages.reduce((s, r) => s + r.success, 0);
    const totalErrors = this.stages.reduce((s, r) => s + r.failed, 0);

    const summary: IngestionRunSummary = {
      townId: this.townId,
      action: this.action,
      stages: this.stages,
      totalDocumentsProcessed,
      totalErrors,
      totalDurationMs,
      triggeredBy: this.triggeredBy,
      details: extraDetails,
    };

    console.log("\n" + "=".repeat(60));
    console.log(`[${this.action}] INGESTION RUN COMPLETE`);
    console.log("-".repeat(40));
    for (const stage of this.stages) {
      console.log(`  ${stage.stage}: ${stage.success} ok / ${stage.failed} err / ${stage.skipped} skip (${formatDuration(stage.durationMs)})`);
    }
    console.log("-".repeat(40));
    console.log(`  Total processed: ${totalDocumentsProcessed}`);
    console.log(`  Total errors:    ${totalErrors}`);
    console.log(`  Duration:        ${formatDuration(totalDurationMs)}`);
    console.log("=".repeat(60));

    try {
      const supabase = getSupabaseServiceClient();
      await supabase.from("ingestion_log").insert({
        town_id: this.townId,
        action: this.action,
        documents_processed: totalDocumentsProcessed,
        errors: totalErrors,
        duration_ms: totalDurationMs,
        details: { stages: this.stages, triggered_by: this.triggeredBy, completed_at: new Date().toISOString(), ...extraDetails },
      });
    } catch (err) {
      console.error("[logger] Failed to persist ingestion log:", err);
    }

    return summary;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
