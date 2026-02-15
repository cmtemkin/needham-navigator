/**
 * scripts/apply-enrichment-migration.ts — Apply AI enrichment migration to Supabase
 *
 * Applies the 20260215000000_add_ai_enrichment_columns.sql migration.
 * Run: npx tsx scripts/apply-enrichment-migration.ts
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const migrationFile = path.join(
    __dirname,
    "../supabase/migrations/20260215000000_add_ai_enrichment_columns.sql"
  );

  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, "utf-8");

  // Split into individual statements
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("COMMENT"));

  console.log(`Applying migration: 20260215000000_add_ai_enrichment_columns.sql`);
  console.log(`Found ${statements.length} SQL statements\n`);

  const supabase = getSupabaseServiceClient();

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    const preview = stmt.split("\n")[0].slice(0, 80);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}...`);

    try {
      // Execute via supabase.rpc if available, otherwise via raw SQL
      const { error } = await supabase.rpc("exec_sql" as any, { sql_text: stmt }) as any;

      if (error) {
        // Try alternative approach - some Supabase setups don't have exec_sql RPC
        throw error;
      }

      console.log(" ✓");
    } catch (err: any) {
      const msg = err?.message || String(err);

      // If column already exists, that's fine
      if (msg.includes("already exists") || msg.includes("42701") || msg.includes("42P07")) {
        console.log(" (already exists, skipping)");
      } else {
        console.log(" ✗");
        console.error(`    Error: ${msg}`);
        console.error("\n  Note: If this fails, apply the migration manually via the Supabase SQL Editor.");
        console.error(`  File: supabase/migrations/20260215000000_add_ai_enrichment_columns.sql\n`);
        process.exit(1);
      }
    }
  }

  console.log("\n✓ Migration complete! AI enrichment columns added to documents table.");
  console.log("\nNew columns:");
  console.log("  - ai_summary (TEXT) — AI-generated 2-3 sentence summary");
  console.log("  - ai_title (TEXT) — Cleaned document title");
  console.log("  - ai_tags (TEXT[]) — Searchable topic tags");
  console.log("  - content_type (TEXT) — Document category");
  console.log("  - last_enriched (TIMESTAMPTZ) — Last enrichment timestamp");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
