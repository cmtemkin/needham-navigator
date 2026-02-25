import { isAdminAuthorized, unauthorizedAdminResponse } from "@/lib/admin-auth";

/** Allowlisted hostnames for URL testing (prevents SSRF to internal services) */
const ALLOWED_HOST_PATTERNS = [
  /\.gov$/,
  /\.edu$/,
  /\.org$/,
  /patch\.com$/,
  /wickedlocal\.com$/,
  /needhamlocal\.org$/,
  /needhamchannel\.org$/,
  /needhamobserver\.com$/,
];

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
    return unauthorizedAdminResponse();
  }

  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url) {
      return Response.json({ error: "url is required" }, { status: 400 });
    }

    if (!isAllowedUrl(url)) {
      return Response.json(
        { error: "URL not allowed — only public .gov, .edu, .org, and approved news domains are permitted" },
        { status: 403 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, { // nosemgrep: js/request-forgery — URL is validated against allowlist above
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
