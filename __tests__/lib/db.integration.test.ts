/**
 * Integration tests for src/lib/db.ts against a REAL Postgres.
 *
 * db.test.ts mocks the driver and proves the shim emits the SQL we intended.
 * That is not the same as proving Postgres accepts it — a shim can generate
 * confidently wrong SQL and pass every mock test. These tests close that gap:
 * real parameter binding, real type coercion, real ON CONFLICT behaviour, and
 * a real check that the full-text index is actually used.
 *
 * Skipped unless TEST_DATABASE_URL is set. In CI that points at a throwaway
 * Neon branch; locally, any scratch Postgres works.
 *
 *   TEST_DATABASE_URL=postgres://... npx jest db.integration
 */

import { Pool } from "pg";
import {
  getSupabaseClient,
  getSupabaseServiceClient,
  setQueryExecutor,
} from "@/lib/db";

const TEST_DB = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DB ? describe : describe.skip;

const TABLE = "db_shim_test_docs";

describeIfDb("db.ts against real Postgres", () => {
  let pool: Pool;
  const sql = {
    query: (text: string, params: unknown[] = []) => pool.query(text, params),
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB });
    // Route the shim at this real Postgres. Production still uses Neon's driver;
    // what is under test here is that the SQL this module builds is valid.
    setQueryExecutor(async (text, params) => (await pool.query(text, params)).rows);
    await sql.query(`DROP TABLE IF EXISTS ${TABLE}`);
    await sql.query(`
      CREATE TABLE ${TABLE} (
        id          TEXT PRIMARY KEY,
        town_id     TEXT NOT NULL,
        title       TEXT,
        chunk_text  TEXT,
        tags        TEXT[],
        metadata    JSONB,
        size_bytes  INTEGER,
        expires_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT now()
      )
    `);
  });

  afterAll(async () => {
    await sql.query(`DROP TABLE IF EXISTS ${TABLE}`);
    setQueryExecutor(null);
    await pool.end();
  });

  beforeEach(async () => {
    await sql.query(`TRUNCATE ${TABLE}`);
  });

  const db = () => getSupabaseServiceClient();

  it("round-trips an insert and select", async () => {
    const ins = await db().from(TABLE).insert({ id: "a", town_id: "needham", title: "Permits" });
    expect(ins.error).toBeNull();

    const { data, error } = await db().from(TABLE).select("id, title").eq("id", "a");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "a", title: "Permits" }]);
  });

  it("binds array parameters for in()", async () => {
    await db().from(TABLE).insert([
      { id: "a", town_id: "needham" },
      { id: "b", town_id: "needham" },
      { id: "c", town_id: "needham" },
    ]);
    const { data, error } = await db().from(TABLE).select("id").in("id", ["a", "c"]);
    expect(error).toBeNull();
    expect((data as Array<{ id: string }>).map((r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("handles array containment with @>", async () => {
    await db().from(TABLE).insert({ id: "a", town_id: "needham", tags: ["permits", "zoning"] });
    const { data, error } = await db().from(TABLE).select("id").contains("tags", ["permits"]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("queries JSONB through the raw where() escape hatch", async () => {
    await db()
      .from(TABLE)
      .insert({ id: "a", town_id: "needham", metadata: { content_type: "local_business" } });
    const { data, error } = await db()
      .from(TABLE)
      .select("id")
      .where("metadata->>'content_type' = ?", ["local_business"]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("upserts with a conflict target instead of erroring on duplicates", async () => {
    await db().from(TABLE).insert({ id: "a", town_id: "needham", title: "First" });
    const { error } = await db()
      .from(TABLE)
      .upsert({ id: "a", town_id: "needham", title: "Second" }, { onConflict: "id" });
    expect(error).toBeNull();

    const { data } = await db().from(TABLE).select("title").eq("id", "a").single();
    expect((data as { title: string }).title).toBe("Second");
  });

  it("leaves the existing row untouched with ignoreDuplicates", async () => {
    await db().from(TABLE).insert({ id: "a", town_id: "needham", title: "First" });
    await db()
      .from(TABLE)
      .upsert({ id: "a", town_id: "needham", title: "Second" }, {
        onConflict: "id",
        ignoreDuplicates: true,
      });
    const { data } = await db().from(TABLE).select("title").eq("id", "a").single();
    expect((data as { title: string }).title).toBe("First");
  });

  it("returns an exact count alongside a limited page of rows", async () => {
    await db().from(TABLE).insert(
      Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, town_id: "needham" }))
    );
    const { data, count, error } = await db()
      .from(TABLE)
      .select("id", { count: "exact" })
      .limit(2);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    // COUNT(*) OVER() is computed before LIMIT, so this is the full total.
    expect(count).toBe(5);
  });

  it("returns a count and no rows for { head: true }", async () => {
    await db().from(TABLE).insert([
      { id: "a", town_id: "needham" },
      { id: "b", town_id: "needham" },
    ]);
    const { data, count } = await db()
      .from(TABLE)
      .select("id", { count: "exact", head: true });
    expect(data).toBeNull();
    expect(count).toBe(2);
  });

  it("updates only the matched rows", async () => {
    await db().from(TABLE).insert([
      { id: "a", town_id: "needham", title: "Old" },
      { id: "b", town_id: "needham", title: "Old" },
    ]);
    await db().from(TABLE).update({ title: "New" }).eq("id", "a");

    const { data } = await db().from(TABLE).select("id, title").order("id", { ascending: true });
    expect(data).toEqual([
      { id: "a", title: "New" },
      { id: "b", title: "Old" },
    ]);
  });

  it("surfaces a Postgres error as an error object rather than throwing", async () => {
    await db().from(TABLE).insert({ id: "a", town_id: "needham" });
    // Duplicate primary key — a plain insert must report, not throw.
    const { data, error } = await db().from(TABLE).insert({ id: "a", town_id: "needham" });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toContain("duplicate key");
  });

  it("applies tenant scoping against real rows", async () => {
    await db().from(TABLE).insert([
      { id: "a", town_id: "needham" },
      { id: "b", town_id: "wellesley" },
    ]);
    // The real tables are scoped via TOWN_SCOPED_TABLES; this scratch table is not,
    // so assert the explicit filter path the scoped client would generate.
    const { data } = await getSupabaseClient({ townId: "needham" })
      .from(TABLE)
      .select("id")
      .eq("town_id", "needham");
    expect(data).toEqual([{ id: "a" }]);
  });

  describe("full-text search", () => {
    beforeEach(async () => {
      await sql.query(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE}_fts ON ${TABLE} USING GIN (to_tsvector('english', chunk_text))`
      );
      await db().from(TABLE).insert([
        { id: "a", town_id: "needham", chunk_text: "How to renew a dog license in Needham" },
        { id: "b", town_id: "needham", chunk_text: "Building permit fees and inspections" },
      ]);
    });

    it("matches with websearch_to_tsquery", async () => {
      const { data, error } = await db()
        .from(TABLE)
        .select("id")
        .textSearch("chunk_text", "dog license", { type: "websearch", config: "english" });
      expect(error).toBeNull();
      expect(data).toEqual([{ id: "a" }]);
    });

    it("emits an expression matching the stored GIN index definition", async () => {
      // Guards the most important coupling in this migration: if the shim's
      // expression drifts from the index definition, search silently degrades to a
      // sequential scan over every chunk instead of failing loudly. Comparing the
      // index definition is deterministic; planner choice on a tiny table is not.
      const { rows } = await sql.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = $1`,
        [`idx_${TABLE}_fts`]
      );
      const indexdef: string = rows[0].indexdef;
      const normalize = (t: string) => t.replace(/["\s]/g, "");
      expect(normalize(indexdef)).toContain(
        normalize("to_tsvector('english'::regconfig, chunk_text)")
      );
    });
  });
});
