import { DEFAULT_TOWN_ID, hybridSearch } from "@/lib/rag";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const townId = searchParams.get("town")?.trim() || DEFAULT_TOWN_ID;

  if (!query) {
    return Response.json(
      { error: "Query parameter 'q' is required." },
      { status: 400 }
    );
  }

  try {
    const results = await hybridSearch(query, { townId, limit: 15 });

    return Response.json({
      results: results.map((result) => ({
        id: result.id,
        chunk_text: result.chunk_text,
        document_title: result.source.documentTitle,
        document_url: result.source.documentUrl,
        section: result.source.section,
        similarity: result.similarity,
        highlight: result.highlight,
        score: result.score,
      })),
      total: results.length,
    });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Unexpected search API error.";

    return Response.json(
      {
        error: "Search is temporarily unavailable. Please try again shortly.",
        details,
      },
      { status: 500 }
    );
  }
}
