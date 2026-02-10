import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase";

type IngestRequestBody = {
  source_url?: unknown;
  town_id?: unknown;
};

type IngestionLogRow = {
  id: string;
  created_at: string;
};

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  let body: IngestRequestBody = {};
  try {
    body = (await request.json()) as IngestRequestBody;
  } catch {
    body = {};
  }

  const sourceUrl =
    typeof body.source_url === "string" ? body.source_url.trim() : "";
  const townId =
    (typeof body.town_id === "string" && body.town_id.trim()) || DEFAULT_TOWN_ID;

  if (sourceUrl && !isValidUrl(sourceUrl)) {
    return Response.json(
      { error: "Field 'source_url' must be a valid URL." },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("ingestion_log")
      .insert({
        town_id: townId,
        action: "crawl",
        documents_processed: sourceUrl ? 1 : 0,
        errors: 0,
        duration_ms: 0,
        details: {
          mode: sourceUrl ? "single-source" : "full-refresh",
          source_url: sourceUrl || null,
          triggered_by: "admin-api",
          queued_at: new Date().toISOString(),
        },
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create ingestion job.");
    }

    const row = data as IngestionLogRow;
    return Response.json(
      {
        job_id: row.id,
        status: "queued",
        created_at: row.created_at,
        source_url: sourceUrl || null,
      },
      { status: 202 }
    );
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected admin ingest error.";
    return Response.json(
      { error: "Unable to queue ingestion job.", details },
      { status: 500 }
    );
  }
}
