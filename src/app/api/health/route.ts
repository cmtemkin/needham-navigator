import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/health — Lightweight health check that also warms up
 * the serverless function so the search/chat API routes stay responsive.
 *
 * Called by Vercel cron to prevent cold starts, and also used by
 * CI health-check workflows.
 */
export async function GET(): Promise<Response> {
  const start = performance.now();

  try {
    // Warm up the Supabase connection (shared across API routes)
    const supabase = getSupabaseClient({});
    const { count, error } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true });

    const durationMs = Math.round(performance.now() - start);

    if (error) {
      return NextResponse.json(
        { status: "degraded", error: error.message, duration_ms: durationMs },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      chunk_count: count,
      duration_ms: durationMs,
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        duration_ms: durationMs,
      },
      { status: 500 }
    );
  }
}
