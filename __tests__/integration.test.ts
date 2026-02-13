/**
 * Integration tests for Needham Navigator API routes and core libraries.
 *
 * Tests 1-7 call Next.js route handler functions directly with constructed
 * Request objects (no running server required). Tests 8-10 exercise core
 * library functions for confidence scoring, source citations, and the legal
 * disclaimer.
 */

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that depend on them
// ---------------------------------------------------------------------------

// Mock Supabase at the module level — bypass the caching in supabase.ts
const mockRpc = jest.fn().mockResolvedValue({ data: [], error: null });
const mockInsert = jest.fn().mockReturnValue({ data: null, error: null });

function makeMockQueryBuilder() {
    const builder: Record<string, jest.Mock> = {};
    const proxy: unknown = new Proxy(builder, {
        get: (_target, prop: string) => {
            if (prop === "then") {
                return (resolve: (v: unknown) => void) =>
                    resolve({ data: [], error: null });
            }
            if (prop === "data") return [];
            if (prop === "error") return null;
            if (prop === "insert") return mockInsert;
            if (!builder[prop]) {
                builder[prop] = jest.fn().mockReturnValue(proxy);
            }
            return builder[prop];
        },
    });
    return proxy;
}

const mockSupabaseClient = {
    from: jest.fn().mockImplementation(() => makeMockQueryBuilder()),
    rpc: mockRpc,
};

jest.mock("@/lib/supabase", () => ({
    getSupabaseClient: jest.fn(() => mockSupabaseClient),
    getSupabaseServiceClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock("@ai-sdk/openai", () => ({
    openai: jest.fn(() => "mock-model"),
}));

type MockWriter = {
    write: jest.Mock;
    merge: jest.Mock;
};

jest.mock("ai", () => ({
    streamText: jest.fn(() => ({
        toUIMessageStream: jest.fn(() => new ReadableStream()),
    })),
    createUIMessageStream: jest.fn(
        ({ execute }: { execute: (ctx: { writer: MockWriter }) => void }) => {
            const writer: MockWriter = {
                write: jest.fn(),
                merge: jest.fn(),
            };
            execute({ writer });
            return new ReadableStream();
        },
    ),
    createUIMessageStreamResponse: jest.fn(
        ({ status }: { stream: ReadableStream; status?: number }) =>
            new Response(null, { status: status ?? 200 }),
    ),
}));

jest.mock("@/lib/embeddings", () => ({
    generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
}));

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = process.env;

beforeAll(() => {
    process.env = {
        ...ORIGINAL_ENV,
        SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_KEY: "test-service-key",
        OPENAI_API_KEY: "test-openai-key",
        ADMIN_PASSWORD: "test-admin-pw",
    };
});

afterAll(() => {
    process.env = ORIGINAL_ENV;
});

beforeEach(() => {
    // Reset mocks before each test
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockInsert.mockReturnValue({ data: null, error: null });
    mockSupabaseClient.from.mockImplementation(() => makeMockQueryBuilder());
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, init?: RequestInit): Request {
    return new Request(`http://localhost:3000${url}`, init);
}

/**
 * Configure the mock Supabase from() chain to return specific data.
 */
function mockFromData(data: unknown[]) {
    const builder: Record<string, jest.Mock> = {};
    const proxy: unknown = new Proxy(builder, {
        get: (_target, prop: string) => {
            if (prop === "then") {
                return (resolve: (v: unknown) => void) =>
                    resolve({ data, error: null });
            }
            if (prop === "data") return data;
            if (prop === "error") return null;
            if (prop === "insert") return mockInsert;
            if (!builder[prop]) {
                builder[prop] = jest.fn().mockReturnValue(proxy);
            }
            return builder[prop];
        },
    });
    mockSupabaseClient.from.mockReturnValue(proxy);
}

// ---------------------------------------------------------------------------
// Imports — after mocks are declared
// ---------------------------------------------------------------------------

import { GET as getDepartments } from "@/app/api/departments/route";
import { GET as getCategories } from "@/app/api/categories/route";
import { POST as postChat } from "@/app/api/chat/route";
import { GET as getSearch } from "@/app/api/search/route";
import { POST as postFeedback } from "@/app/api/feedback/route";
import { GET as getAdminAnalytics } from "@/app/api/admin/analytics/route";
import {
    scoreConfidence,
    scoreConfidenceFromChunks,
} from "@/lib/confidence";
import { dedupeSources, buildContextDocuments } from "@/lib/rag";
import {
    buildChatSystemPrompt,
    getFirstMessageDisclaimer,
} from "@/lib/prompts";

// ===========================================================================
// TEST 1 — API Health: GET /api/departments returns 200 and non-empty array
// ===========================================================================

describe("Test 1 — API Health: Departments", () => {
    it("returns 200 and a non-empty departments array", async () => {
        mockFromData([
            {
                id: "1",
                name: "Building",
                phone: "555-0001",
                email: "b@t.gov",
                address: "1 Main",
                hours: "9-5",
                description: "Permits",
            },
        ]);

        const res = await getDepartments(makeRequest("/api/departments"));
        expect(res.status).toBe(200);

        const json = (await res.json()) as { departments: unknown[] };
        expect(Array.isArray(json.departments)).toBe(true);
        expect(json.departments.length).toBeGreaterThan(0);
    });
});

// ===========================================================================
// TEST 2 — API Health: GET /api/categories returns 200 and categories array
// ===========================================================================

describe("Test 2 — API Health: Categories", () => {
    it("returns 200 and a categories array", async () => {
        mockFromData([
            { metadata: { document_type: "regulation" } },
            { metadata: { document_type: "procedure" } },
        ]);

        const res = await getCategories(makeRequest("/api/categories"));
        expect(res.status).toBe(200);

        const json = (await res.json()) as { categories: unknown[] };
        expect(Array.isArray(json.categories)).toBe(true);
    });
});

// ===========================================================================
// TEST 3 — Chat Endpoint: POST /api/chat returns 200 with streaming response
// ===========================================================================

describe("Test 3 — Chat Endpoint", () => {
    it("returns 200 for a valid chat message", async () => {
        // rpc returns empty (no matched documents) → static "no info" response
        mockRpc.mockResolvedValue({ data: [], error: null });

        const res = await postChat(
            makeRequest("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: "What is Needham Navigator?" }],
                }),
            }),
        );

        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
    });
});

// ===========================================================================
// TEST 4 — Search Endpoint: GET /api/search?q=zoning returns 200
// ===========================================================================

describe("Test 4 — Search Endpoint", () => {
    it("returns 200 for a search query", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        const res = await getSearch(makeRequest("/api/search?q=zoning"));
        expect(res.status).toBe(200);

        const json = (await res.json()) as { results: unknown[] };
        expect(json).toHaveProperty("results");
    });
});

// ===========================================================================
// TEST 5 — Feedback Endpoint: POST /api/feedback returns 200/201
// ===========================================================================

describe("Test 5 — Feedback Endpoint", () => {
    it("returns 201 for valid feedback submission", async () => {
        mockInsert.mockReturnValue({ data: null, error: null });

        const res = await postFeedback(
            makeRequest("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    helpful: true,
                    response_id: "test-response-id",
                    comment: "Great answer!",
                }),
            }),
        );

        // The feedback endpoint returns 201 on success
        expect([200, 201]).toContain(res.status);
    });
});

// ===========================================================================
// TEST 6 — Admin Auth: GET /api/admin/analytics without password returns 401
// ===========================================================================

describe("Test 6 — Admin Auth", () => {
    it("returns 401 when no admin password is provided", async () => {
        const res = await getAdminAnalytics(
            makeRequest("/api/admin/analytics"),
        );

        expect(res.status).toBe(401);
        const json = (await res.json()) as { error: string };
        expect(json.error).toBe("Unauthorized");
    });
});

// ===========================================================================
// TEST 7 — Graceful Empty DB: Chat responds helpfully with no documents
// ===========================================================================

describe("Test 7 — Graceful Empty DB", () => {
    it("returns a helpful response when no documents match", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        const res = await postChat(
            makeRequest("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: "Tell me about zoning" }],
                }),
            }),
        );

        // Should return 200, not crash — the chat handler returns a static
        // "no info" streaming response when zero chunks match.
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
    });
});

// ===========================================================================
// TEST 8 — Confidence Scoring: returns high, medium, or low
// ===========================================================================

describe("Test 8 — Confidence Scoring", () => {
    it("returns 'low' when no similarities are provided", () => {
        const result = scoreConfidence([]);
        expect(["high", "medium", "low"]).toContain(result.level);
        expect(result.level).toBe("low");
    });

    it("returns 'high' for strong similarities with official sources", () => {
        const officialChunks = [
            { metadata: { document_type: "regulation" } },
            { metadata: { document_type: "regulation" } },
            { metadata: { document_type: "regulation" } },
        ];
        const result = scoreConfidence([0.92, 0.88, 0.90]);
        expect(result.level).toBe("high");
    });

    it("returns 'medium' for mid-range similarities", () => {
        const result = scoreConfidence([0.50, 0.45]);
        expect(result.level).toBe("medium");
    });

    it("scoreConfidenceFromChunks works with chunk objects", () => {
        const chunks = [
            { similarity: 0.5, metadata: {} },
            { similarity: 0.4, metadata: {} },
        ];
        const result = scoreConfidenceFromChunks(chunks);
        expect(["high", "medium", "low"]).toContain(result.level);
    });
});

// ===========================================================================
// TEST 9 — Source Citations: dedupeSources and buildContextDocuments work
// ===========================================================================

describe("Test 9 — Source Citations", () => {
    const mockChunks = [
        {
            id: "c1",
            chunkText: "Zoning bylaws specify setback requirements...",
            similarity: 0.9,
            metadata: {
                document_title: "Zoning Bylaws",
                document_type: "regulation",
            },
            source: {
                sourceId: "S1",
                citation: "[Zoning Bylaws, Section 4.1 (2024)]",
                documentTitle: "Zoning Bylaws",
                documentUrl: "https://needham.gov/zoning",
                section: "4.1",
                date: "2024",
            },
        },
        {
            id: "c2",
            chunkText: "Building permits require an application...",
            similarity: 0.85,
            metadata: {
                document_title: "Permit Guide",
                document_type: "procedure",
            },
            source: {
                sourceId: "S2",
                citation: "[Permit Guide, Application (2023)]",
                documentTitle: "Permit Guide",
                documentUrl: "https://needham.gov/permits",
                section: "Application",
                date: "2023",
            },
        },
        {
            id: "c3",
            chunkText: "Additional zoning bylaw information...",
            similarity: 0.8,
            metadata: {
                document_title: "Zoning Bylaws",
                document_type: "regulation",
            },
            source: {
                sourceId: "S3",
                citation: "[Zoning Bylaws, Section 4.1 (2024)]",
                documentTitle: "Zoning Bylaws",
                documentUrl: "https://needham.gov/zoning",
                section: "4.1",
                date: "2024",
            },
        },
    ];

    it("dedupeSources returns unique sources", () => {
        const sources = dedupeSources(mockChunks);
        expect(Array.isArray(sources)).toBe(true);
        // Two unique sources (Zoning Bylaws and Permit Guide)
        expect(sources.length).toBe(2);
        expect(sources[0].documentTitle).toBe("Zoning Bylaws");
        expect(sources[1].documentTitle).toBe("Permit Guide");
    });

    it("buildContextDocuments returns properly formatted context docs", () => {
        const docs = buildContextDocuments(mockChunks);
        expect(Array.isArray(docs)).toBe(true);
        expect(docs.length).toBe(3);
        expect(docs[0]).toHaveProperty("sourceId");
        expect(docs[0]).toHaveProperty("citation");
        expect(docs[0]).toHaveProperty("excerpt");
    });
});

// ===========================================================================
// TEST 10 — Legal Disclaimer: First-session chat prompt includes disclaimer
// ===========================================================================

describe("Test 10 — Legal Disclaimer", () => {
    it("includes the Appendix B disclaimer in the first-session system prompt", () => {
        const prompt = buildChatSystemPrompt({
            contextDocuments: [],
            includeDisclaimer: true,
            townName: "Needham, MA",
            townHallPhone: "(781) 455-7500",
        });

        // The disclaimer should be generated dynamically with the town phone
        expect(prompt).toContain(getFirstMessageDisclaimer("(781) 455-7500"));
        expect(prompt).toContain(
            "This tool uses AI and may provide inaccurate information",
        );
        expect(prompt).toContain("(781) 455-7500");
    });

    it("omits the disclaimer when includeDisclaimer is false", () => {
        const prompt = buildChatSystemPrompt({
            contextDocuments: [],
            includeDisclaimer: false,
            townName: "Needham, MA",
            townHallPhone: "(781) 455-7500",
        });

        expect(prompt).not.toContain("FIRST-MESSAGE DISCLAIMER");
    });
});
