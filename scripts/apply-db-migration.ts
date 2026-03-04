/**
 * Apply missing database migration to production Supabase
 * Ensures the documents table has last_crawled and last_changed columns
 * Required by scripts/monitor.ts
 */

import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
  );
  process.exit(1);
}

// Extract project reference from SUPABASE_URL
// URL format: https://[PROJECT_REF].supabase.co
const projectMatch = SUPABASE_URL.match(
  /https:\/\/([a-z0-9]+)\.supabase\.co/
);
if (!projectMatch) {
  console.error("Invalid SUPABASE_URL format:", SUPABASE_URL);
  process.exit(1);
}
const projectRef = projectMatch[1];

// Construct database connection string
// Format: postgres://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const dbUrl = `postgres://postgres:${encodeURIComponent(SUPABASE_SERVICE_KEY)}@db.${projectRef}.supabase.co:5432/postgres`;

async function applyMigration() {
  const sql = postgres(dbUrl, {
    ssl: "require",
    max: 1,
  });

  try {
    // Read the migration file
    const migrationFile = path.join(
      __dirname,
      "..",
      "supabase/migrations/20240103000000_enhance_metadata_tracking.sql"
    );

    if (!fs.existsSync(migrationFile)) {
      console.error(`Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationFile, "utf-8");

    console.log("Applying migration: 20240103000000_enhance_metadata_tracking");
    console.log("Adding last_crawled and last_changed columns to documents table");

    // Execute the migration - the SQL file has multiple statements separated by ;
    // postgres.js handles this automatically
    await sql.unsafe(migrationSql);

    console.log("✓ Migration applied successfully");
    console.log("  - Added last_crawled TIMESTAMPTZ column (if not exists)");
    console.log("  - Added last_changed TIMESTAMPTZ column (if not exists)");
    console.log("  - Added performance indexes");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // These errors indicate the migration already succeeded or is idempotent
    if (
      message.includes("already exists") ||
      message.includes("duplicate key value")
    ) {
      console.log(
        "✓ Database schema is up-to-date (columns already exist or index already created)"
      );
    } else {
      console.error("✗ Migration failed:", message);
      process.exit(1);
    }
  } finally {
    await sql.end();
  }
}

applyMigration();
