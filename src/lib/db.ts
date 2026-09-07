/**
 * src/lib/db.ts — Postgres data layer (Neon), PostgREST-compatible.
 *
 * Replaces @supabase/supabase-js. Needham Navigator moved off Supabase because the
 * free plan caps active projects at 2 and auto-pauses idle ones, which took the site
 * down silently for three months. Neon auto-resumes transparently instead.
 *
 * This module reimplements the subset of the PostgREST query builder the app actually
 * uses, so the ~495 existing call sites keep working unchanged. That is deliberate:
 * the call sites are where regression risk lives, and a compatible client confines the
 * risk to this one file, which is unit-tested against a real Postgres.
 *
 * Contract notes (must match supabase-js exactly — call sites branch on these):
 *   - Every terminal call resolves to { data, error }; it NEVER throws.
 *   - A successful multi-row select returns data: [] (not null) when empty.
 *   - .single() returns an ERROR (code PGRST116) when the row count is not exactly 1.
 *   - .maybeSingle() returns data: null for zero rows, and errors only on >1.
 *   - insert/update/delete return data: null unless .select() is chained.
 *
 * Tenant scoping: the old Supabase RLS policies depended on request_town_id(), which
 * reads a header only PostgREST injects. Those policies are gone. getSupabaseClient
 * ({ townId }) now injects the equivalent predicate here, in one auditable place —
 * see TOWN_SCOPED_TABLES.
 *
 * The function names still say "Supabase" so that no call site had to change. They are
 * historical; this module talks only to Neon.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let sqlClient: NeonQueryFunction<false, false> | null = null;

/**
 * Executes one parameterized statement. Production uses Neon's HTTP driver.
 *
 * Tests may substitute a plain Postgres client via setQueryExecutor(): the Neon
 * HTTP driver only speaks to Neon endpoints, so integration tests would
 * otherwise need a live Neon branch to verify that the SQL this module builds is
 * actually valid. The seam keeps that verification runnable anywhere.
 */
export type QueryExecutor = (text: string, params: unknown[]) => Promise<Row[]>;

let executorOverride: QueryExecutor | null = null;

/** Substitute the query executor. Tests only; pass null to restore Neon. */
export function setQueryExecutor(executor: QueryExecutor | null): void {
  executorOverride = executor;
}

function getExecutor(): QueryExecutor {
  if (executorOverride) return executorOverride;
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Missing environment variable: DATABASE_URL");
    }
    sqlClient = neon(url);
  }
  const client = sqlClient;
  return (text, params) => client.query(text, params) as Promise<Row[]>;
}

/** Reset the cached connection. Tests only. */
export function resetDbClient(): void {
  sqlClient = null;
}

// ---------------------------------------------------------------------------
// Tenant scoping
// ---------------------------------------------------------------------------

/**
 * Tables the old RLS policies scoped by town, and the column each used.
 *
 * Faithful to supabase/migrations/20240102000000_town_scoped_rls.sql and
 * 20240104000000_content_platform.sql. Two deliberate omissions:
 *   - `feedback` was scoped by an EXISTS join on conversations, not a column, and
 *     its public policy allowed inserts regardless. Not expressible here.
 *   - `articles` was scoped by status = 'published', not by town. Every article
 *     route already applies .eq('status','published') itself, so dropping the
 *     policy changes no behavior.
 *
 * Tables absent from this map are never auto-filtered — injecting town_id into a
 * table that lacks the column would turn a working query into a SQL error.
 */
const TOWN_SCOPED_TABLES: Record<string, string> = {
  towns: "id",
  documents: "town_id",
  document_chunks: "town_id",
  departments: "town_id",
  conversations: "town_id",
  content_items: "town_id",
  source_configs: "town_id",
  generated_content: "town_id",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

/**
 * Result envelope.
 *
 * `data` is intentionally `any`. The app never generated Supabase `Database`
 * types, so the previous client resolved to `any` at every call site. Typing it
 * more tightly here would force changes across ~495 callers — exactly what the
 * shim exists to avoid. Narrowing the schema is a separate, later change.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbResult<T = any> =
  | { data: T; error: null; count?: number | null }
  | { data: null; error: DbError; count?: number | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

type Op = "select" | "insert" | "update" | "upsert" | "delete";

interface Condition {
  /** Rendered at build time so identifier validation surfaces as an error, not a throw. */
  sql: () => string;
  values: unknown[];
}

function toError(error: unknown, code = "DB_ERROR"): DbError {
  const message = error instanceof Error ? error.message : String(error);
  return { message, details: message, hint: "", code };
}

/**
 * Quote an SQL identifier, rejecting anything that is not a plain identifier.
 * Table and column names come from source code rather than user input, but this
 * closes the path entirely rather than relying on that staying true.
 */
function ident(name: string): string {
  const parts = name.split(".");
  for (const part of parts) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) {
      throw new Error(`Invalid SQL identifier: ${name}`);
    }
  }
  return parts.map((p) => `"${p}"`).join(".");
}

/**
 * Render a select list. Accepts "*", a comma-separated column list, or column
 * aliases. Rejects PostgREST embedded-resource syntax, which this app does not
 * use and which this shim deliberately does not implement.
 */
function selectList(columns: string): string {
  const trimmed = columns.trim();
  if (trimmed === "" || trimmed === "*") return "*";
  if (trimmed.includes("(")) {
    throw new Error(
      `Embedded resource selects are not supported by src/lib/db.ts: "${columns}"`
    );
  }
  return trimmed
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => ident(c))
    .join(", ");
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class QueryBuilder<T = any[]> implements PromiseLike<DbResult<T>> {
  private conditions: Condition[] = [];
  private orderParts: Array<() => string> = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private selectColumns = "*";
  private wantCount = false;
  private headOnly = false;
  private returning = false;
  private rowMode: "many" | "single" | "maybe" = "many";
  private payload: Row[] = [];
  private conflictTarget: string | null = null;
  private ignoreDuplicates = false;

  constructor(
    private readonly table: string,
    private readonly townId: string | null,
    private op: Op = "select"
  ) {}

  // --- terminal-ish operations ------------------------------------------------

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    if (options?.head) this.headOnly = true;
    if (this.op === "select") {
      this.selectColumns = columns;
    } else {
      // .insert(...).select() — return the affected rows
      this.returning = true;
      this.selectColumns = columns;
    }
    if (options?.count === "exact") this.wantCount = true;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.op = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Row | Row[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ): this {
    this.op = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.conflictTarget = options?.onConflict ?? null;
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    return this;
  }

  update(values: Row): this {
    this.op = "update";
    this.payload = [values];
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  // --- filters ----------------------------------------------------------------

  private addCondition(sql: () => string, values: unknown[] = []): this {
    this.conditions.push({ sql, values });
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.addCondition(() => `${ident(column)} = ?`, [value]);
  }

  neq(column: string, value: unknown): this {
    return this.addCondition(() => `${ident(column)} <> ?`, [value]);
  }

  gt(column: string, value: unknown): this {
    return this.addCondition(() => `${ident(column)} > ?`, [value]);
  }

  gte(column: string, value: unknown): this {
    return this.addCondition(() => `${ident(column)} >= ?`, [value]);
  }

  lt(column: string, value: unknown): this {
    return this.addCondition(() => `${ident(column)} < ?`, [value]);
  }

  lte(column: string, value: unknown): this {
    return this.addCondition(() => `${ident(column)} <= ?`, [value]);
  }

  like(column: string, pattern: string): this {
    return this.addCondition(() => `${ident(column)} LIKE ?`, [pattern]);
  }

  ilike(column: string, pattern: string): this {
    return this.addCondition(() => `${ident(column)} ILIKE ?`, [pattern]);
  }

  in(column: string, values: unknown[]): this {
    if (values.length === 0) {
      // PostgREST yields an empty result for in.() rather than a SQL error.
      return this.addCondition(() => "FALSE", []);
    }
    return this.addCondition(() => `${ident(column)} = ANY(?)`, [values]);
  }

  is(column: string, value: null | boolean): this {
    if (value === null) return this.addCondition(() => `${ident(column)} IS NULL`, []);
    return this.addCondition(() => `${ident(column)} IS ${value ? "TRUE" : "FALSE"}`, []);
  }

  not(column: string, operator: string, value: unknown): this {
    if (operator === "is" && value === null) {
      return this.addCondition(() => `${ident(column)} IS NOT NULL`, []);
    }
    const sqlOp = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[
      operator
    ];
    if (!sqlOp) throw new Error(`Unsupported not() operator: ${operator}`);
    return this.addCondition(() => `NOT (${ident(column)} ${sqlOp} ?)`, [value]);
  }

  match(criteria: Row): this {
    for (const [column, value] of Object.entries(criteria)) this.eq(column, value);
    return this;
  }

  /** Array / JSONB containment — maps to the @> operator. */
  contains(column: string, value: unknown[] | Row): this {
    return this.addCondition(() => `${ident(column)} @> ?`, [value]);
  }

  /**
   * Full-text search. The expression MUST stay byte-identical to the index in
   * db/migrations/20260907000000_fulltext_search_index.sql, or the planner falls
   * back to a sequential scan over every chunk.
   */
  textSearch(
    column: string,
    query: string,
    options?: { type?: "websearch" | "plain"; config?: string }
  ): this {
    const config = options?.config ?? "english";
    if (!/^[a-z_]+$/.test(config)) throw new Error(`Invalid text search config: ${config}`);
    const fn = options?.type === "plain" ? "plainto_tsquery" : "websearch_to_tsquery";
    return this.addCondition(
      () => `to_tsvector('${config}', ${ident(column)}) @@ ${fn}('${config}', ?)`,
      [query]
    );
  }

  /**
   * Escape hatch for predicates the builder cannot express (the handful of former
   * PostgREST .or() call sites). Placeholders are `?`; values stay parameterized.
   */
  where(sql: string, values: unknown[] = []): this {
    return this.addCondition(() => `(${sql})`, values);
  }

  // --- modifiers --------------------------------------------------------------

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const dir = options?.ascending === false ? "DESC" : "ASC";
    const nulls =
      options?.nullsFirst === undefined
        ? ""
        : options.nullsFirst
          ? " NULLS FIRST"
          : " NULLS LAST";
    this.orderParts.push(() => `${ident(column)} ${dir}${nulls}`);
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  /**
   * Terminal: resolves to a single object rather than a list. Returning a
   * PromiseLike (not `this`) is what lets callers read fields off `data`
   * without the list type getting in the way — matching supabase-js.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single(): PromiseLike<DbResult<any>> {
    this.rowMode = "single";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as unknown as PromiseLike<DbResult<any>>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle(): PromiseLike<DbResult<any>> {
    this.rowMode = "maybe";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this as unknown as PromiseLike<DbResult<any>>;
  }

  // --- SQL construction -------------------------------------------------------

  /** Apply the tenant predicate for town-scoped clients. */
  private effectiveConditions(): Condition[] {
    const column = this.townId ? TOWN_SCOPED_TABLES[this.table] : undefined;
    if (!column) return this.conditions;
    const prefix = `${ident(column)} =`;
    const alreadyFiltered = this.conditions.some((c) => c.sql().startsWith(prefix));
    if (alreadyFiltered) return this.conditions;
    return [...this.conditions, { sql: () => `${ident(column)} = ?`, values: [this.townId] }];
  }

  /** Replace ? placeholders with $1..$n and collect ordered values. */
  private materialize(sql: string, values: unknown[]): { text: string; params: unknown[] } {
    let index = 0;
    const text = sql.replace(/\?/g, () => `$${++index}`);
    return { text, params: values };
  }

  private build(): { text: string; params: unknown[] } {
    const table = ident(this.table);
    const conditions = this.effectiveConditions();
    const whereValues = conditions.flatMap((c) => c.values);
    const whereSql = conditions.length
      ? ` WHERE ${conditions.map((c) => c.sql()).join(" AND ")}`
      : "";

    if (this.op === "select") {
      if (this.headOnly) {
        // { head: true } asks for the count only; PostgREST returns no rows.
        const text = `SELECT COUNT(*)::int AS "__count" FROM ${table}${whereSql}`;
        return this.materialize(text, whereValues);
      }
      const countCol = this.wantCount ? ', COUNT(*) OVER() AS "__count"' : "";
      let text = `SELECT ${selectList(this.selectColumns)}${countCol} FROM ${table}${whereSql}`;
      if (this.orderParts.length) text += ` ORDER BY ${this.orderParts.map((o) => o()).join(", ")}`;
      if (this.limitValue !== null) text += ` LIMIT ${Number(this.limitValue)}`;
      if (this.offsetValue !== null) text += ` OFFSET ${Number(this.offsetValue)}`;
      return this.materialize(text, whereValues);
    }

    if (this.op === "insert" || this.op === "upsert") {
      if (this.payload.length === 0) throw new Error("insert() requires at least one row");
      const columns = Array.from(new Set(this.payload.flatMap((r) => Object.keys(r))));
      const params: unknown[] = [];
      const tuples = this.payload.map((row) => {
        const placeholders = columns.map((c) => {
          params.push(row[c] ?? null);
          return "?";
        });
        return `(${placeholders.join(", ")})`;
      });
      let text =
        `INSERT INTO ${table} (${columns.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`;
      if (this.op === "upsert") {
        const target = this.conflictTarget
          ? this.conflictTarget.split(",").map((c) => ident(c.trim())).join(", ")
          : null;
        if (!target || this.ignoreDuplicates) {
          text += target ? ` ON CONFLICT (${target}) DO NOTHING` : " ON CONFLICT DO NOTHING";
        } else {
          text += ` ON CONFLICT (${target}) DO UPDATE SET ${columns
            .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`)
            .join(", ")}`;
        }
      }
      if (this.returning) text += ` RETURNING ${selectList(this.selectColumns)}`;
      return this.materialize(text, params);
    }

    if (this.op === "update") {
      const row = this.payload[0] ?? {};
      const params: unknown[] = [];
      const assignments = Object.entries(row).map(([column, value]) => {
        params.push(value);
        return `${ident(column)} = ?`;
      });
      if (!assignments.length) throw new Error("update() requires at least one column");
      let text = `UPDATE ${table} SET ${assignments.join(", ")}${whereSql}`;
      params.push(...whereValues);
      if (this.returning) text += ` RETURNING ${selectList(this.selectColumns)}`;
      return this.materialize(text, params);
    }

    // delete
    let text = `DELETE FROM ${table}${whereSql}`;
    if (this.returning) text += ` RETURNING ${selectList(this.selectColumns)}`;
    return this.materialize(text, whereValues);
  }

  // --- execution --------------------------------------------------------------

  private async run(): Promise<DbResult<T>> {
    let text: string;
    let params: unknown[];
    try {
      ({ text, params } = this.build());
    } catch (error) {
      return { data: null, error: toError(error, "DB_BUILD_ERROR"), count: null };
    }

    let rows: Row[];
    try {
      rows = await getExecutor()(text, params);
    } catch (error) {
      return { data: null, error: toError(error), count: null };
    }

    if (this.headOnly) {
      const total = rows.length > 0 ? Number(rows[0].__count) : 0;
      // Success with no rows: { head: true } asks for a count only. The generic
      // cannot express "T is null here", so the cast is localized.
      return { data: null as T, error: null, count: total };
    }

    let count: number | null = null;
    if (this.wantCount) {
      count = rows.length > 0 ? Number(rows[0].__count) : 0;
      rows = rows.map(({ __count, ...rest }) => rest as Row);
    }

    // Write operations without .select() report no rows, matching PostgREST.
    if (this.op !== "select" && !this.returning) {
      // Writes report no rows unless .select() was chained — matches PostgREST.
      return { data: null as T, error: null, count };
    }

    if (this.rowMode === "single") {
      if (rows.length !== 1) {
        return {
          data: null,
          // PostgREST's code for "JSON object requested, multiple (or no) rows returned".
          error: {
            message: `JSON object requested, multiple (or no) rows returned (got ${rows.length})`,
            details: `Results contain ${rows.length} rows`,
            hint: "",
            code: "PGRST116",
          },
          count,
        };
      }
      return { data: rows[0] as T, error: null, count };
    }

    if (this.rowMode === "maybe") {
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            message: "JSON object requested, multiple rows returned",
            details: `Results contain ${rows.length} rows`,
            hint: "",
            code: "PGRST116",
          },
          count,
        };
      }
      // maybeSingle(): zero rows is a success with null data, not an error.
      return { data: (rows[0] ?? null) as T, error: null, count };
    }

    return { data: rows as unknown as T, error: null, count };
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class DbClient {
  constructor(private readonly townId: string | null = null) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from<T = any[]>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table, this.townId);
  }

  /** Call a Postgres function, e.g. cleanup_old_data or increment_article_feedback. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpc<T = any>(fn: string, args: Row = {}): Promise<DbResult<T>> {
    try {
      const names = Object.keys(args);
      const placeholders = names.map((n, i) => `${ident(n)} => $${i + 1}`);
      const text = `SELECT * FROM ${ident(fn)}(${placeholders.join(", ")})`;
      const rows = await getExecutor()(text, Object.values(args));
      return { data: rows as unknown as T, error: null };
    } catch (error) {
      return { data: null, error: toError(error) };
    }
  }
}

type DbClientOptions = { townId?: string };

const townClients = new Map<string, DbClient>();

/**
 * Client scoped to a town. Queries against tables in TOWN_SCOPED_TABLES are
 * automatically filtered, replacing the RLS policies Supabase used to enforce.
 */
export function getSupabaseClient(options?: DbClientOptions): DbClient {
  const townId = options?.townId?.trim() ?? "";
  const cacheKey = townId || "__default__";
  const existing = townClients.get(cacheKey);
  if (existing) return existing;

  const client = new DbClient(townId || null);
  townClients.set(cacheKey, client);
  return client;
}

let serviceClient: DbClient | null = null;

/** Unscoped client for ingestion scripts and admin operations. */
export function getSupabaseServiceClient(): DbClient {
  if (!serviceClient) serviceClient = new DbClient(null);
  return serviceClient;
}
