import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/**
 * Supabase client using the anon key (respects RLS policies).
 * Use this for public-facing reads.
 */
let anonClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(
      getEnvVar("SUPABASE_URL"),
      getEnvVar("SUPABASE_ANON_KEY")
    );
  }
  return anonClient;
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
