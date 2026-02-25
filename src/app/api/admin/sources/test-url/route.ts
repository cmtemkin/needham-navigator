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
      // Re-parse URL to ensure it's well-formed after allowlist validation
      const safeUrl = new URL(url);
      // codeql[js/request-forgery] — URL validated against domain allowlist above (lines 32-42)
      // nosemgrep: js/request-forgery
      const res = await fetch(safeUrl.href, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "manual", // Prevent following redirects to non-allowlisted domains (SSRF mitigation)
      });

      clearTimeout(timeout);

      // Treat 3xx redirects as accessible (URL is valid, just redirects)
      const accessible = res.ok || (res.status >= 300 && res.status < 400);

      return Response.json({
        accessible,
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type") || "unknown",
        redirected: res.status >= 300 && res.status < 400,
        redirectUrl: res.headers.get("location") || undefined,
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
