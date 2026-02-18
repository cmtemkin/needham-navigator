import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { DEFAULT_TOWN_ID } from "@/../config/towns";

interface CsvRow {
  url: string;
  name: string;
  category?: string;
  priority?: string;
  update_frequency?: string;
  document_type?: string;
  max_depth?: string;
  max_pages?: string;
  is_active?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const { csv, town_id: townId = DEFAULT_TOWN_ID } = (await request.json()) as {
      csv?: string;
      town_id?: string;
    };

    if (!csv) {
      return Response.json({ error: "csv field is required" }, { status: 400 });
    }

    const lines = csv.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      return Response.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
    }

    const headerLine = parseCsvLine(lines[0]);
    const headerMap = new Map(headerLine.map((h, i) => [h.toLowerCase().trim(), i]));

    const getCol = (row: string[], col: string): string | undefined => {
      const idx = headerMap.get(col);
      return idx !== undefined ? row[idx] : undefined;
    };

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const url = getCol(cols, "url");
      const name = getCol(cols, "name");
      if (!url || !name) continue;
      rows.push({
        url,
        name,
        category: getCol(cols, "category"),
        priority: getCol(cols, "priority"),
        update_frequency: getCol(cols, "update_frequency") || getCol(cols, "frequency"),
        document_type: getCol(cols, "document_type") || getCol(cols, "type"),
        max_depth: getCol(cols, "max_depth"),
        max_pages: getCol(cols, "max_pages"),
        is_active: getCol(cols, "is_active"),
      });
    }

    if (rows.length === 0) {
      return Response.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const upsertData = rows.map((r) => ({
      town_id: townId,
      url: r.url,
      name: r.name,
      category: r.category || "general",
      priority: Math.min(5, Math.max(1, parseInt(r.priority || "3", 10) || 3)),
      update_frequency: r.update_frequency || "weekly",
      document_type: r.document_type || "html",
      max_depth: parseInt(r.max_depth || "2", 10) || 2,
      max_pages: parseInt(r.max_pages || "10", 10) || 10,
      is_active: r.is_active !== "false",
    }));

    const { data, error } = await supabase
      .from("sources")
      .upsert(upsertData, { onConflict: "town_id,url" })
      .select("id");

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      imported: data?.length ?? 0,
      total_rows: rows.length,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to import sources", details: String(err) },
      { status: 500 }
    );
  }
}
