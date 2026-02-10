import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase";

type DocumentRow = {
  id: string;
  town_id: string;
  url: string;
  title: string | null;
  source_type: string | null;
  is_stale: boolean | null;
  chunk_count: number | null;
  last_ingested_at: string | null;
  last_verified_at: string | null;
  metadata: unknown;
};

type DocumentStatus = "current" | "stale" | "error";

function deriveDocumentStatus(row: DocumentRow): DocumentStatus {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  const hasError =
    typeof metadata.ingest_error === "string" ||
    typeof metadata.error === "string" ||
    metadata.status === "error";

  if (hasError) {
    return "error";
  }

  if (row.is_stale) {
    return "stale";
  }

  return "current";
}

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, town_id, url, title, source_type, is_stale, chunk_count, last_ingested_at, last_verified_at, metadata"
      )
      .eq("town_id", townId)
      .order("last_ingested_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const documents = ((data ?? []) as DocumentRow[]).map((row) => ({
      id: row.id,
      town_id: row.town_id,
      url: row.url,
      title: row.title ?? "Untitled document",
      source_type: row.source_type ?? "unknown",
      status: deriveDocumentStatus(row),
      is_stale: Boolean(row.is_stale),
      chunk_count: row.chunk_count ?? 0,
      last_ingested_at: row.last_ingested_at,
      last_verified_at: row.last_verified_at,
      metadata: row.metadata ?? {},
    }));

    return Response.json({ documents, total: documents.length });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected admin documents error.";
    return Response.json(
      { error: "Unable to load indexed documents.", details },
      { status: 500 }
    );
  }
}
