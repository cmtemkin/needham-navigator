import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

type SupabaseClientOptions = {
  townId?: string;
};

/**
 * Supabase client using the anon key (respects RLS policies).
 * The optional x-town-id header lets Postgres policies enforce tenant isolation.
 */
const anonClients = new Map<string, SupabaseClient>();

export function getSupabaseClient(options?: SupabaseClientOptions): SupabaseClient {
  const normalizedTownId = options?.townId?.trim() ?? "";
  const cacheKey = normalizedTownId || "__default__";

  const existing = anonClients.get(cacheKey);
  if (existing) {
    return existing;
  }

  const headers = normalizedTownId ? { "x-town-id": normalizedTownId } : undefined;
  const client = createClient(getEnvVar("SUPABASE_URL"), getEnvVar("SUPABASE_ANON_KEY"), {
    global: headers ? { headers } : undefined,
  });
  anonClients.set(cacheKey, client);
  return client;
}

/**
 * Supabase client using the service role key (bypasses RLS).
 * Use this for ingestion scripts and admin operations.
 */
let serviceClient: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      getEnvVar("SUPABASE_URL"),
      getEnvVar("SUPABASE_SERVICE_KEY")
    );
  }
  return serviceClient;
}
