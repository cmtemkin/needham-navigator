/**
 * Contract tests for src/lib/db.ts.
 *
 * Two things are asserted here, and both matter:
 *
 *  1. SQL generation — the exact text and parameters sent to Postgres. The Neon
 *     driver is mocked so the query can be captured without a database.
 *  2. Result-shape parity with supabase-js. Roughly 495 call sites branch on
 *     `if (error)` and then read `data`, so `data: null` vs `data: []`, and
 *     whether `.single()` errors or throws, decide real control flow.
 *
 * Behaviour against a live Postgres (types, coercion, the FTS index actually
 * being used) is covered separately in db.integration.test.ts.
 */

const capturedQueries: Array<{ text: string; params: unknown[] }> = [];
let mockRows: Array<Record<string, unknown>> = [];
let mockError: Error | null = null;

jest.mock("@neondatabase/serverless", () => ({
  neon: () => ({
    query: jest.fn(async (text: string, params: unknown[]) => {
      capturedQueries.push({ text, params });
      if (mockError) throw mockError;
      return mockRows;
    }),
  }),
}));

import {
  getSupabaseClient,
  getSupabaseServiceClient,
  resetDbClient,
} from "@/lib/db";

/** The query most recently sent to Postgres. */
function lastQuery(): { text: string; params: unknown[] } {
  return capturedQueries[capturedQueries.length - 1];
}

beforeEach(() => {
  capturedQueries.length = 0;
  mockRows = [];
  mockError = null;
  process.env.DATABASE_URL = "postgres://test/test";
  resetDbClient();
});

describe("SQL generation", () => {
  const db = () => getSupabaseServiceClient();

  it("builds a simple select with equality filters", async () => {
    await db().from("documents").select("id, title").eq("town_id", "needham");
    expect(lastQuery().text).toBe(
      'SELECT "id", "title" FROM "documents" WHERE "town_id" = $1'
    );
    expect(lastQuery().params).toEqual(["needham"]);
  });

  it("numbers placeholders in order across multiple filters", async () => {
    await db()
      .from("documents")
      .select("*")
      .eq("town_id", "needham")
      .gte("created_at", "2026-01-01")
      .lt("size_bytes", 500);
    expect(lastQuery().text).toBe(
      'SELECT * FROM "documents" WHERE "town_id" = $1 AND "created_at" >= $2 AND "size_bytes" < $3'
    );
    expect(lastQuery().params).toEqual(["needham", "2026-01-01", 500]);
  });

  it("applies order, limit and range", async () => {
    await db()
      .from("articles")
      .select("*")
      .order("published_at", { ascending: false })
      .range(10, 19);
    expect(lastQuery().text).toBe(
      'SELECT * FROM "articles" ORDER BY "published_at" DESC LIMIT 10 OFFSET 10'
    );
  });

  it("maps in() to = ANY", async () => {
    await db().from("document_chunks").select("id").in("id", ["a", "b"]);
    expect(lastQuery().text).toContain('"id" = ANY($1)');
    expect(lastQuery().params).toEqual([["a", "b"]]);
  });

  it("returns an empty result for in() with no values rather than invalid SQL", async () => {
    const { data, error } = await db().from("documents").select("id").in("id", []);
    expect(lastQuery().text).toContain("WHERE FALSE");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("maps is(null) to IS NULL without a parameter", async () => {
    await db().from("content_items").select("id").is("expires_at", null);
    expect(lastQuery().text).toContain('"expires_at" IS NULL');
    expect(lastQuery().params).toEqual([]);
  });

  it("maps contains() to the @> operator", async () => {
    await db().from("articles").select("id").contains("tags", ["permits"]);
    expect(lastQuery().text).toContain('"tags" @> $1');
    expect(lastQuery().params).toEqual([["permits"]]);
  });

  it("expands match() into conjunctive equality", async () => {
    await db().from("documents").select("id").match({ town_id: "needham", is_stale: false });
    expect(lastQuery().text).toContain('"town_id" = $1 AND "is_stale" = $2');
    expect(lastQuery().params).toEqual(["needham", false]);
  });

  it("emits the full-text expression that matches the GIN index exactly", async () => {
    await db()
      .from("document_chunks")
      .select("id")
      .textSearch("chunk_text", "dog license", { type: "websearch", config: "english" });
    // Must stay byte-identical to db/migrations/20260907000000_fulltext_search_index.sql,
    // or the planner ignores the index and silently falls back to a seq scan.
    expect(lastQuery().text).toContain(
      `to_tsvector('english', "chunk_text") @@ websearch_to_tsquery('english', $1)`
    );
    expect(lastQuery().params).toEqual(["dog license"]);
  });

  it("parameterizes the raw where() escape hatch", async () => {
    await db()
      .from("source_configs")
      .select("*")
      .where("(name ILIKE ? OR url ILIKE ?)", ["%park%", "%park%"]);
    expect(lastQuery().text).toContain('WHERE ((name ILIKE $1 OR url ILIKE $2))');
    expect(lastQuery().params).toEqual(["%park%", "%park%"]);
  });

  it("builds a multi-row insert", async () => {
    await db().from("feedback").insert([{ helpful: true }, { helpful: false }]);
    expect(lastQuery().text).toBe(
      'INSERT INTO "feedback" ("helpful") VALUES ($1), ($2)'
    );
    expect(lastQuery().params).toEqual([true, false]);
  });

  it("builds an upsert with a conflict target", async () => {
    await db()
      .from("documents")
      .upsert({ id: "1", title: "T" }, { onConflict: "id" });
    expect(lastQuery().text).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(lastQuery().text).toContain('"title" = EXCLUDED."title"');
  });

  it("honours ignoreDuplicates on upsert", async () => {
    await db()
      .from("documents")
      .upsert({ id: "1" }, { onConflict: "id", ignoreDuplicates: true });
    expect(lastQuery().text).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it("orders update SET values before WHERE values", async () => {
    await db().from("documents").update({ title: "New" }).eq("id", "abc");
    expect(lastQuery().text).toBe('UPDATE "documents" SET "title" = $1 WHERE "id" = $2');
    expect(lastQuery().params).toEqual(["New", "abc"]);
  });

  it("builds a delete with filters", async () => {
    await db().from("documents").delete().eq("id", "abc");
    expect(lastQuery().text).toBe('DELETE FROM "documents" WHERE "id" = $1');
  });

  it("adds RETURNING when select() follows a write", async () => {
    await db().from("documents").insert({ id: "1" }).select("id");
    expect(lastQuery().text).toContain('RETURNING "id"');
  });

  it("uses COUNT(*) with no rows for { head: true }", async () => {
    mockRows = [{ __count: 42 }];
    const { data, count } = await db()
      .from("documents")
      .select("id", { count: "exact", head: true });
    expect(lastQuery().text).toBe('SELECT COUNT(*)::int AS "__count" FROM "documents"');
    expect(data).toBeNull();
    expect(count).toBe(42);
  });

  it("uses a window function for count alongside rows", async () => {
    mockRows = [{ id: "a", __count: 7 }];
    const { data, count } = await db()
      .from("documents")
      .select("id", { count: "exact" });
    expect(lastQuery().text).toContain('COUNT(*) OVER() AS "__count"');
    expect(count).toBe(7);
    // The internal count column must not leak into returned rows.
    expect(data).toEqual([{ id: "a" }]);
  });
});

describe("tenant scoping", () => {
  it("injects the town filter for town-scoped tables", async () => {
    await getSupabaseClient({ townId: "needham" }).from("documents").select("id");
    expect(lastQuery().text).toBe('SELECT "id" FROM "documents" WHERE "town_id" = $1');
    expect(lastQuery().params).toEqual(["needham"]);
  });

  it("scopes the towns table by id, not town_id", async () => {
    await getSupabaseClient({ townId: "needham" }).from("towns").select("*");
    expect(lastQuery().text).toContain('WHERE "id" = $1');
  });

  it("does not inject into tables without a town column", async () => {
    // articles has no town_id; injecting one would turn a working query into a SQL error.
    await getSupabaseClient({ townId: "needham" }).from("articles").select("id");
    expect(lastQuery().text).toBe('SELECT "id" FROM "articles"');
  });

  it("does not duplicate a town filter the caller already applied", async () => {
    await getSupabaseClient({ townId: "needham" })
      .from("documents")
      .select("id")
      .eq("town_id", "needham");
    expect(lastQuery().text).toBe('SELECT "id" FROM "documents" WHERE "town_id" = $1');
    expect(lastQuery().params).toEqual(["needham"]);
  });

  it("never injects for the service client", async () => {
    await getSupabaseServiceClient().from("documents").select("id");
    expect(lastQuery().text).toBe('SELECT "id" FROM "documents"');
  });
});

describe("result-shape parity with supabase-js", () => {
  const db = () => getSupabaseServiceClient();

  it("returns [] and no error for an empty multi-row select", async () => {
    mockRows = [];
    const { data, error } = await db().from("documents").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("single() errors with PGRST116 on zero rows instead of throwing", async () => {
    mockRows = [];
    const { data, error } = await db().from("documents").select("*").eq("id", "x").single();
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("single() errors when more than one row matches", async () => {
    mockRows = [{ id: "a" }, { id: "b" }];
    const { error } = await db().from("documents").select("*").single();
    expect(error?.code).toBe("PGRST116");
  });

  it("single() returns the object itself on exactly one row", async () => {
    mockRows = [{ id: "a" }];
    const { data, error } = await db().from("documents").select("*").single();
    expect(error).toBeNull();
    expect(data).toEqual({ id: "a" });
  });

  it("maybeSingle() treats zero rows as success with null data", async () => {
    mockRows = [];
    const { data, error } = await db().from("documents").select("*").maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("maybeSingle() still errors on multiple rows", async () => {
    mockRows = [{ id: "a" }, { id: "b" }];
    const { error } = await db().from("documents").select("*").maybeSingle();
    expect(error?.code).toBe("PGRST116");
  });

  it("writes report null data unless select() is chained", async () => {
    mockRows = [];
    const { data, error } = await db().from("documents").insert({ id: "1" });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("converts a driver failure into an error object rather than throwing", async () => {
    mockError = new Error("connection terminated");
    const { data, error } = await db().from("documents").select("*");
    expect(data).toBeNull();
    expect(error?.message).toContain("connection terminated");
  });

  it("reports an invalid identifier as an error, not an exception", async () => {
    const { error } = await db().from("documents").select("*").eq("id; DROP TABLE x", 1);
    expect(error?.code).toBe("DB_BUILD_ERROR");
    expect(error?.message).toContain("Invalid SQL identifier");
  });

  it("rejects PostgREST embedded-resource selects explicitly", async () => {
    const { error } = await db().from("documents").select("id, chunks(*)");
    expect(error?.code).toBe("DB_BUILD_ERROR");
    expect(error?.message).toContain("Embedded resource selects");
  });
});

describe("rpc", () => {
  it("calls a Postgres function with named arguments", async () => {
    mockRows = [{ ok: true }];
    const { data, error } = await getSupabaseServiceClient().rpc(
      "increment_article_feedback",
      { article_id: "abc", is_helpful: true }
    );
    expect(lastQuery().text).toBe(
      'SELECT * FROM "increment_article_feedback"("article_id" => $1, "is_helpful" => $2)'
    );
    expect(lastQuery().params).toEqual(["abc", true]);
    expect(error).toBeNull();
    expect(data).toEqual([{ ok: true }]);
  });

  it("calls a zero-argument function", async () => {
    await getSupabaseServiceClient().rpc("cleanup_old_data");
    expect(lastQuery().text).toBe('SELECT * FROM "cleanup_old_data"()');
  });
});
