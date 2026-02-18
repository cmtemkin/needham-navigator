import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url) {
      return Response.json({ error: "url is required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeout);

      return Response.json({
        accessible: res.ok,
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type") || "unknown",
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      return Response.json({
        accessible: false,
        status: 0,
        statusText: String(fetchErr),
        contentType: "unknown",
      });
    }
  } catch (err) {
    return Response.json(
      { error: "Failed to test URL", details: String(err) },
      { status: 500 }
    );
  }
}
