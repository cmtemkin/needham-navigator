import { timingSafeEqual } from "crypto";

function safeCompare(secret: string, candidate: string): boolean {
  const secretBuffer = Buffer.from(secret);
  const candidateBuffer = Buffer.from(candidate);

  if (secretBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(secretBuffer, candidateBuffer);
}

function parseBasicAuthHeader(headerValue: string): {
  username: string;
  password: string;
} | null {
  if (!headerValue.startsWith("Basic ")) {
    return null;
  }

  const encoded = headerValue.slice(6).trim();
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function isAdminAuthorized(request: Request): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return false;
  }

  const headerPassword = request.headers.get("x-admin-password");
  if (headerPassword && safeCompare(adminPassword, headerPassword)) {
    return true;
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return false;
  }

  const parsed = parseBasicAuthHeader(authorization);
  if (!parsed) {
    return false;
  }

  return safeCompare(adminPassword, parsed.password);
}

export function unauthorizedAdminResponse(): Response {
  return Response.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Navigator Admin"' },
    }
  );
}
