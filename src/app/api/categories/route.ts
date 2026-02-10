import { DEFAULT_TOWN_ID } from "@/lib/rag";
import { getSupabaseClient } from "@/lib/supabase";

type CategoryCount = {
  name: string;
  document_type: string;
  count: number;
};

const CATEGORY_NAMES: Record<string, string> = {
  regulation: "Zoning & Land Use",
  procedure: "Building Permits",
  meeting: "Town Government",
  budget: "Town Finance",
  informational: "Community Information",
  financial_data: "Town Finance",
  procedure_step: "Permits & Procedures",
};

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getDocumentType(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "informational";
  }

  const value = (metadata as Record<string, unknown>).document_type;
  if (typeof value !== "string" || value.trim().length === 0) {
    return "informational";
  }

  return value.trim();
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;
  try {
    const supabase = getSupabaseClient();
    const pageSize = 1000;
    let start = 0;
    const countsByType = new Map<string, number>();

    while (true) {
      const { data, error } = await supabase
        .from("document_chunks")
        .select("metadata")
        .eq("town_id", townId)
        .range(start, start + pageSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const row of data as Array<{ metadata: unknown }>) {
        const documentType = getDocumentType(row.metadata);
        countsByType.set(documentType, (countsByType.get(documentType) ?? 0) + 1);
      }

      if (data.length < pageSize) {
        break;
      }

      start += pageSize;
    }

    const categories: CategoryCount[] = Array.from(countsByType.entries())
      .map(([document_type, count]) => ({
        name: CATEGORY_NAMES[document_type] ?? toTitleCase(document_type),
        document_type,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return Response.json({ categories });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected categories API error.";

    return Response.json(
      {
        error: "Unable to load document categories right now.",
        details,
      },
      { status: 500 }
    );
  }
}
