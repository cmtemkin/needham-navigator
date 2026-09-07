/**
 * One-shot porting tool: supabase/migrations/*.sql -> db/migrations/*.sql
 *
 * Strips constructs that only exist inside Supabase (PostgREST + GoTrue) and
 * have no meaning on plain Postgres:
 *
 *   - ENABLE ROW LEVEL SECURITY / CREATE POLICY / DROP POLICY
 *     Tenant scoping now lives in src/lib/db.ts, which injects `town_id = $x`
 *     for town-scoped clients. The old policies depended on request_town_id(),
 *     which reads a setting only PostgREST injects — on Neon it returns NULL
 *     and every policy would deny every row.
 *   - GRANT ... TO service_role / anon / authenticated
 *     Those roles are created by Supabase and do not exist on Neon.
 *
 * NOTE on pgvector: the `vector` extension is deliberately KEPT. Embeddings live
 * in Upstash and the final schema has no vector columns, but the migration
 * sequence still creates vector(1536) columns and match_* functions before
 * 20260221000002_drop_embeddings.sql removes them. Replaying the history without
 * the extension fails with "type vector does not exist". Neon supports pgvector,
 * and the extension is left installed but unused — the same end state Supabase
 * was in.
 *
 * Run once: npx tsx scripts/port-migrations-to-neon.ts
 * The generated files are committed; this script is kept for auditability.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";

const SRC = resolve(__dirname, "../supabase/migrations");
const OUT = resolve(__dirname, "../db/migrations");

/** Files dropped wholesale, with the reason recorded for review. */
const SKIP_FILES: Record<string, string> = {
  "20240102000000_town_scoped_rls.sql":
    "entirely RLS — the request_town_id() function and its policies. Replaced by town scoping in src/lib/db.ts.",
  "20260214000000_cached_answers 2.sql":
    "accidental macOS duplicate of 20260214000000_cached_answers.sql.",
};

/**
 * Split SQL into statements, respecting $$-quoted function bodies so that
 * semicolons inside a function body do not split it.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let inDollar = false;
  let i = 0;

  while (i < sql.length) {
    if (sql.startsWith("$$", i)) {
      inDollar = !inDollar;
      buf += "$$";
      i += 2;
      continue;
    }
    const ch = sql[i];
    if (ch === ";" && !inDollar) {
      buf += ch;
      statements.push(buf);
      buf = "";
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (buf.trim()) statements.push(buf);
  return statements;
}

/** True when a statement is Supabase-only and must not be applied to Neon. */
function isSupabaseOnly(statement: string): boolean {
  // Strip comments before matching so a comment mentioning "policy" is not a hit.
  const code = statement
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();

  if (!code) return false;

  return (
    /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(code) ||
    /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(code) ||
    /^\s*CREATE\s+(OR\s+REPLACE\s+)?POLICY\b/i.test(code) ||
    /^\s*DROP\s+POLICY\b/i.test(code) ||
    /^\s*GRANT\b/i.test(code) ||
    /^\s*REVOKE\b/i.test(code) ||
    /\bservice_role\b/i.test(code) ||
    /\brequest_town_id\b/i.test(code)
  );
}

function port(): void {
  mkdirSync(OUT, { recursive: true });

  const files = readdirSync(SRC)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let totalStripped = 0;

  for (const file of files) {
    const name = basename(file);
    if (SKIP_FILES[name]) {
      console.log(`SKIP  ${name}\n      ${SKIP_FILES[name]}`);
      continue;
    }

    const sql = readFileSync(resolve(SRC, file), "utf8");
    const statements = splitStatements(sql);
    const kept: string[] = [];
    let stripped = 0;

    for (const statement of statements) {
      if (isSupabaseOnly(statement)) {
        stripped += 1;
        continue;
      }
      kept.push(statement);
    }

    totalStripped += stripped;

    const header =
      `-- Ported from supabase/migrations/${name} for Neon.\n` +
      (stripped > 0
        ? `-- ${stripped} Supabase-only statement(s) removed (RLS / policies / grants).\n`
        : `-- No changes required.\n`) +
      `-- Regenerate with: npx tsx scripts/port-migrations-to-neon.ts\n\n`;

    const body = kept.join("").trim() + "\n";
    writeFileSync(resolve(OUT, name), header + body);
    console.log(`PORT  ${name}${stripped ? `  (-${stripped} statements)` : ""}`);
  }

  console.log(`\nDone. ${totalStripped} Supabase-only statements removed in total.`);
}

port();
