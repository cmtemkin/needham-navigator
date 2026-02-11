import { getSupabaseClient, getSupabaseServiceClient } from "@/lib/supabase";

// Mock @supabase/supabase-js
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    rpc: jest.fn(),
  })),
}));

describe("supabase client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_KEY: "test-service-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    // Re-import to get fresh module
    jest.isolateModules(() => {
      const { getSupabaseClient } = require("@/lib/supabase");
      expect(() => getSupabaseClient()).toThrow("Missing environment variable: SUPABASE_URL");
    });
  });

  it("throws if SUPABASE_ANON_KEY is missing", () => {
    delete process.env.SUPABASE_ANON_KEY;
    jest.isolateModules(() => {
      const { getSupabaseClient } = require("@/lib/supabase");
      expect(() => getSupabaseClient()).toThrow("Missing environment variable: SUPABASE_ANON_KEY");
    });
  });

  it("throws if SUPABASE_SERVICE_KEY is missing", () => {
    delete process.env.SUPABASE_SERVICE_KEY;
    jest.isolateModules(() => {
      const { getSupabaseServiceClient } = require("@/lib/supabase");
      expect(() => getSupabaseServiceClient()).toThrow(
        "Missing environment variable: SUPABASE_SERVICE_KEY"
      );
    });
  });

  it("creates anon client with correct params", () => {
    jest.isolateModules(() => {
      const { createClient } = require("@supabase/supabase-js");
      const { getSupabaseClient } = require("@/lib/supabase");
      getSupabaseClient();
      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
        { global: undefined }
      );
    });
  });

  it("sends x-town-id header for tenant-scoped anon clients", () => {
    jest.isolateModules(() => {
      const { createClient } = require("@supabase/supabase-js");
      const { getSupabaseClient } = require("@/lib/supabase");
      getSupabaseClient({ townId: "needham" });
      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-anon-key",
        { global: { headers: { "x-town-id": "needham" } } }
      );
    });
  });

  it("creates service client with correct params", () => {
    jest.isolateModules(() => {
      const { createClient } = require("@supabase/supabase-js");
      const { getSupabaseServiceClient } = require("@/lib/supabase");
      getSupabaseServiceClient();
      expect(createClient).toHaveBeenCalledWith(
        "https://test.supabase.co",
        "test-service-key"
      );
    });
  });

  it("returns singleton (same instance on repeated calls)", () => {
    jest.isolateModules(() => {
      const { getSupabaseClient } = require("@/lib/supabase");
      const client1 = getSupabaseClient();
      const client2 = getSupabaseClient();
      expect(client1).toBe(client2);
    });
  });

  it("returns distinct clients for different towns", () => {
    jest.isolateModules(() => {
      const { getSupabaseClient } = require("@/lib/supabase");
      const needhamClient = getSupabaseClient({ townId: "needham" });
      const mockTownClient = getSupabaseClient({ townId: "mock-town" });
      expect(needhamClient).not.toBe(mockTownClient);
    });
  });
});
