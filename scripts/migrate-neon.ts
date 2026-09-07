/**
 * Migration runner for Neon.
 *
 * Applies db/migrations/*.sql in filename order, recording each one in a
 * schema_migrations table so re-runs are idempotent. Replaces the four
 * exec_sql RPC scripts that existed only because Supabase had no runner.
 *
 *   npx tsx scripts/migrate-neon.ts          # apply pending migrations
 *   npx tsx scripts/migrate-neon.ts --status # list applied vs pending
 *
 * Requires DATABASE_URL. Each migration runs inside a transaction, so a failing
 * migration rolls back rather than leaving the schema half-applied.
 *
 * Uses node-postgres rather than Neon's serverless driver: this runs from CI and
 * the CLI over a normal TCP connection, needs real transactions, and must also
 * work against a plain Postgres (the container used by the migration tests).
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const MIGRATIONS_DIR = resolve(__dirname, "../db/migrations");

// Load .env.local for local runs (CI provides DATABASE_URL directly).
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Set it in .env.local (local) or as a secret (CI/Vercel)."
    );
  }
  return url;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Apply one migration in a transaction, retrying once on a dropped connection.
 * Neon suspends idle computes, so the first statement after a pause can fail
 * with a terminated connection even though nothing is wrong with the SQL.
 */
async function applyMigration(
  pool: Pool,
  file: string,
  sql: string,
  attempt = 1
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is already gone; nothing to roll back.
    }
    const message = error instanceof Error ? error.message : String(error);
    const droppedConnection =
      /Connection terminated|socket hang up|ECONNRESET|server closed the connection/i.test(
        message
      );
    if (droppedConnection && attempt === 1) {
      console.warn(`[migrate] connection dropped on ${file}; retrying once`);
      client.release();
      return applyMigration(pool, file, sql, 2);
    }
    console.error(`✗ ${file}`);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes("--status");
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    // Neon requires TLS and will drop a connection whose compute suspends
    // mid-run. Without a handler, that surfaces as an unhandled 'error' event
    // that kills the process partway through the migration set.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 0,
  });
  pool.on("error", (err) => {
    console.warn(`[migrate] pool error (will retry): ${err.message}`);
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.name));
    const files = migrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (statusOnly) {
      console.log(`Applied (${applied.size}):`);
      for (const f of files.filter((f) => applied.has(f))) console.log(`  ✓ ${f}`);
      console.log(`\nPending (${pending.length}):`);
      for (const f of pending) console.log(`  · ${f}`);
      return;
    }

    if (pending.length === 0) {
      console.log("No pending migrations — schema is up to date.");
      return;
    }

    for (const file of pending) {
      const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      await applyMigration(pool, file, sql);
      console.log(`✓ ${file}`);
    }

    console.log(`\nApplied ${pending.length} migration(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
