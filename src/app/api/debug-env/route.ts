/**
 * Temporary diagnostic endpoint — reveals which env vars are set and their
 * first/last 4 chars (to compare against local values without exposing secrets).
 * DELETE THIS ROUTE after diagnosis.
 */
export async function GET(): Promise<Response> {
  function mask(val: string | undefined): string {
    if (!val) return "NOT_SET";
    if (val.length <= 10) return `SET (${val.length} chars)`;
    return `${val.slice(0, 4)}...${val.slice(-4)} (${val.length} chars)`;
  }

  return Response.json({
    SUPABASE_URL: mask(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: mask(process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_KEY: mask(process.env.SUPABASE_SERVICE_KEY),
    OPENAI_API_KEY: mask(process.env.OPENAI_API_KEY),
    ADMIN_PASSWORD: mask(process.env.ADMIN_PASSWORD),
  });
}
