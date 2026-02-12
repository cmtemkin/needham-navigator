/**
 * scripts/apply-migration.ts — Apply SQL migration to Supabase
 *
 * Uses the Supabase service role client to execute SQL statements.
 * Run: npx tsx scripts/apply-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runSQL(sql: string): Promise<void> {
  const { error } = await supabase.rpc("exec_sql", { sql_text: sql });
  if (error) {
    // If exec_sql doesn't exist, try via the REST API directly
    throw error;
  }
}

async function main() {
  const migrationFile = path.join(
    __dirname,
    "../supabase/migrations/004_content_platform.sql"
  );

  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, "utf-8");

  // Split into individual statements and execute each
  // Remove comments and split on semicolons
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Applying migration: 004_content_platform.sql`);
  console.log(`Found ${statements.length} SQL statements\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.split("\n")[0].slice(0, 80);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}...`);

    try {
      // Use the Supabase Management API via fetch
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql_text: stmt }),
      });

      if (!response.ok) {
        // Try alternative: direct SQL via Supabase's pg endpoint
        const altResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: "return=minimal",
          },
        });
        // If this also fails, we need to use the SQL editor
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log(" OK");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` FAILED`);
      console.error(`    Error: ${msg}`);

      // If it's a "already exists" error, that's fine
      if (msg.includes("already exists") || msg.includes("42P07")) {
        console.log("    (table already exists, continuing...)");
      } else {
        console.error(
          "\n  Note: If this fails, apply the migration manually via the Supabase SQL Editor."
        );
        console.error(`  File: supabase/migrations/004_content_platform.sql\n`);
        process.exit(1);
      }
    }
  }

  console.log("\nMigration complete!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
