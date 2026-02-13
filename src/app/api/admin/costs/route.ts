import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";
import { getCostSummary } from "@/lib/cost-tracker";

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) return unauthorizedAdminResponse();

  const { searchParams } = new URL(request.url);
  const townId = searchParams.get("town")?.trim() || "needham";

  try {
    const summary = await getCostSummary(townId);
    return Response.json(summary);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unexpected cost API error.";
    return Response.json({ error: "Unable to load cost data.", details }, { status: 500 });
  }
}
