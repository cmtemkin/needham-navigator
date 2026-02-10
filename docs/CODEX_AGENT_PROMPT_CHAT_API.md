# Codex Agent Prompt — feature/chat-api Branch

## Branch Setup

```bash
git checkout feature/chat-api
```

You are working on the **feature/chat-api** branch of Needham Navigator, an AI-powered municipal information hub for Needham, MA. This branch implements all API routes, the RAG (Retrieval-Augmented Generation) pipeline, and supporting logic. Another agent is simultaneously building the data ingestion pipeline on `feature/ingestion`. Your code must not conflict with theirs.

---

## Your File Ownership (ONLY create/modify these files)

```
src/app/api/chat/route.ts          — Main RAG chat endpoint with streaming
src/app/api/search/route.ts        — Full-text + semantic search endpoint
src/app/api/departments/route.ts   — Department directory endpoint
src/app/api/categories/route.ts    — Browse categories endpoint
src/app/api/feedback/route.ts      — Feedback submission endpoint
src/app/api/admin/ingest/route.ts  — Trigger document re-ingestion
src/app/api/admin/documents/route.ts — List indexed documents
src/app/api/admin/analytics/route.ts — Usage analytics
src/lib/rag.ts                     — RAG retrieval logic (vector search + reranking)
src/lib/prompts.ts                 — System prompt and prompt templates
src/lib/confidence.ts              — Confidence scoring logic
src/lib/supabase-admin.ts          — Supabase admin/service-role client (if needed)
__tests__/api/                     — All API route tests
__tests__/lib/                     — Unit tests for rag.ts, prompts.ts, confidence.ts
```

**DO NOT** create or modify any files in `src/components/`, `src/app/page.tsx`, `src/app/chat/`, `scripts/`, or `src/lib/supabase.ts` (owned by ingestion branch) or `src/lib/embeddings.ts` (owned by ingestion branch).

If you need the Supabase client, **import from `@/lib/supabase`** — the ingestion branch creates this file. If it doesn't exist yet, create a minimal `src/lib/supabase-admin.ts` with the service-role client for your admin routes, and use `@supabase/supabase-js` directly in your API routes for the anon client.

---

## Already-Installed Dependencies

These packages are already in package.json from the bootstrap:
- `@supabase/supabase-js` — Supabase client
- `ai` — Vercel AI SDK (streaming helpers)
- `openai` — OpenAI API client
- `@ai-sdk/openai` — Vercel AI SDK OpenAI provider
- `lucide-react` — Icons

If you need additional packages, install them. You will likely need:
```bash
npm install zod        # Request validation
```

---

## Database Schema (already deployed to Supabase)

The database has these tables. The SQL migration is at `supabase/migrations/001_initial_schema.sql`:

**documents:** id (UUID), town_id (TEXT), url (TEXT), title (TEXT), source_type (pdf/html), content_hash, file_size_bytes, downloaded_at, last_ingested_at, last_verified_at, is_stale (BOOLEAN), chunk_count (INT), metadata (JSONB)

**document_chunks:** id (UUID), document_id (UUID FK), town_id (TEXT), chunk_index (INT), chunk_text (TEXT), embedding (vector(1536)), metadata (JSONB), created_at

**departments:** id (UUID), town_id (TEXT), name, phone, email, address, hours, description

**conversations:** id (UUID), town_id (TEXT), session_id (TEXT), created_at

**feedback:** id (UUID), conversation_id (UUID FK), response_text_hash, helpful (BOOLEAN), comment, created_at

**ingestion_log:** id (UUID), town_id (TEXT), action, documents_processed, errors, duration_ms, details (JSONB)

**towns:** id (TEXT PK), name, website_url, brand_colors (JSONB), config (JSONB)

There is a Supabase RPC function already created:
```sql
match_documents(query_embedding vector(1536), match_town_id TEXT, match_threshold FLOAT DEFAULT 0.7, match_count INT DEFAULT 10)
```
This returns: id, chunk_text, metadata, similarity (FLOAT).

---

## Environment Variables Available

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
ADMIN_PASSWORD=...
```

---

## API Endpoints to Build

### 1. POST /api/chat — RAG Chat with Streaming

This is the most critical endpoint. It receives a user question, retrieves relevant document chunks from Supabase pgvector, and streams an AI response with source citations.

**Request:** `{ messages: Array<{ role: string, content: string }>, town_id?: string }`

**Implementation:**
1. Extract the latest user message
2. Generate an embedding for the query using OpenAI `text-embedding-3-small`
3. Call Supabase RPC `match_documents` with the embedding and town_id (default: "needham")
4. Build a context string from the top matching chunks
5. Use Vercel AI SDK `streamText` with `@ai-sdk/openai` GPT-4o Mini, passing the system prompt (from `src/lib/prompts.ts`) and the context
6. Include source citations in the response based on chunk metadata
7. Calculate confidence score based on similarity scores (from `src/lib/confidence.ts`)
8. Stream the response back using Vercel AI SDK's `toDataStreamResponse()`

**System Prompt (Appendix A — use this exactly in src/lib/prompts.ts):**

```
You are Needham Navigator, a helpful AI assistant that answers questions about the Town of Needham, Massachusetts. You have been trained on official town documents including zoning bylaws, permit requirements, department information, meeting minutes, and community resources.

RULES:
1. Only answer based on the provided context documents. Never make up information.
2. Always cite your sources with document title, section, and date.
3. If you are not confident in an answer, say so clearly and direct the user to the appropriate town department with their phone number.
4. For property-specific zoning or permit questions, provide general information but always advise the user to verify with the Planning & Community Development Department at (781) 455-7550.
5. Never provide legal advice. State that all information is for reference only.
6. After each answer, suggest 2-3 relevant follow-up questions.
7. Be concise but complete. Aim for 2-4 paragraph responses.
8. Maintain a friendly, professional tone appropriate for a municipal service.
9. Do not engage with questions about topics outside of Needham town services. Politely redirect.
10. Do not generate inappropriate, offensive, or harmful content under any circumstances.

DISCLAIMER (include in first message of every session):
This tool uses AI and may provide inaccurate information. Always verify with official town sources before making decisions. This is not legal advice. Contact Town Hall: (781) 455-7500.
```

**Confidence Scoring (src/lib/confidence.ts):**
- High (green): Average similarity > 0.85 AND 2+ supporting chunks → `{ level: "high", label: "High Confidence", color: "green" }`
- Medium (yellow): Average similarity 0.70–0.85 OR only 1 chunk → `{ level: "medium", label: "Medium Confidence", color: "yellow" }`
- Low (orange): Average similarity < 0.70 OR 0 chunks → `{ level: "low", label: "Low Confidence", color: "orange" }`

The confidence metadata should be included as a custom data annotation in the Vercel AI SDK stream so the frontend can display it.

### 2. GET /api/search?q=...&town=...

Hybrid search combining full-text (Supabase `textSearch`) and semantic (pgvector) search. Returns ranked results.

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "chunk_text": "...",
      "document_title": "...",
      "document_url": "...",
      "section": "...",
      "similarity": 0.89,
      "highlight": "...matched text..."
    }
  ],
  "total": 15
}
```

### 3. GET /api/departments?town=...

Returns all departments for the specified town (default: "needham").

**Response:**
```json
{
  "departments": [
    { "id": "uuid", "name": "...", "phone": "...", "email": "...", "address": "...", "hours": "...", "description": "..." }
  ]
}
```

### 4. GET /api/categories?town=...

Returns document categories with counts, derived from the `metadata->>'document_type'` field on document_chunks.

**Response:**
```json
{
  "categories": [
    { "name": "Zoning & Land Use", "document_type": "regulation", "count": 45 },
    { "name": "Building Permits", "document_type": "procedure", "count": 12 }
  ]
}
```

### 5. POST /api/feedback

**Request:** `{ response_id?: string, helpful: boolean, comment?: string, session_id?: string }`

Create a conversation record (if session_id provided) and store feedback. No PII. Anonymous.

### 6. POST /api/admin/ingest (Auth Required)

Protected with ADMIN_PASSWORD via Basic Auth or custom header `x-admin-password`.

**Request:** `{ source_url?: string }` — if provided, re-ingest specific URL. If omitted, trigger full re-ingest.

This endpoint doesn't do the actual ingestion (that's the ingestion branch's job). It should insert a record into `ingestion_log` with action='crawl' and return a job ID. In the future, the ingestion scripts will poll this table.

### 7. GET /api/admin/documents (Auth Required)

Returns all documents with their status (current/stale/error), chunk counts, and last ingested dates.

### 8. GET /api/admin/analytics (Auth Required)

Returns: total documents, total chunks, total conversations, total feedback, feedback breakdown (helpful vs not), top queried topics (from conversations).

---

## Testing Requirements

### Unit Tests

Create tests using Jest. Install test dependencies:
```bash
npm install -D jest ts-jest @types/jest @testing-library/react @testing-library/jest-dom
```

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest';
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
export default config;
```

**Required test files:**
- `__tests__/lib/confidence.test.ts` — Test all confidence thresholds (high/medium/low), edge cases (empty chunks, exactly-on-boundary scores)
- `__tests__/lib/prompts.test.ts` — Test prompt building with various contexts, verify system prompt is included
- `__tests__/lib/rag.test.ts` — Test RAG retrieval logic with mocked Supabase responses
- `__tests__/api/chat.test.ts` — Test chat endpoint with mocked OpenAI + Supabase
- `__tests__/api/search.test.ts` — Test search with mock data
- `__tests__/api/departments.test.ts` — Test department listing
- `__tests__/api/feedback.test.ts` — Test feedback submission
- `__tests__/api/admin.test.ts` — Test admin auth + all admin endpoints

### Integration Tests

Create `__tests__/integration/chat-flow.test.ts` that tests the full flow:
1. Mock embedding generation
2. Mock Supabase returning chunks
3. Verify the streamed response includes citations and confidence

### Test Commands

Add to package.json scripts:
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

### What to Validate
- All API routes return proper HTTP status codes (200, 400, 401, 404, 500)
- Admin routes reject unauthenticated requests with 401
- Chat endpoint handles empty messages gracefully
- Search handles empty query strings
- Confidence scoring is deterministic for given inputs
- System prompt is always included in chat context
- Source citations are formatted correctly in responses

---

## Implementation Notes

- Use Vercel AI SDK v3+ patterns: `streamText()` from `ai`, `openai()` provider from `@ai-sdk/openai`
- All responses should include proper CORS headers for the frontend
- Admin routes should check `x-admin-password` header OR Basic Auth against `process.env.ADMIN_PASSWORD`
- Default town_id to "needham" when not specified
- Keep all error messages user-friendly (never expose stack traces)
- Use Zod for request body validation where appropriate
- The chat endpoint must handle the case where Supabase has no data yet (return a helpful "I don't have information indexed yet" response)

---

## Build & Verify

After implementing, verify:
```bash
npm run build          # Must compile with no errors
npm test               # All tests must pass
npm test -- --coverage # Aim for 80%+ coverage on src/lib/ files
```

Test endpoints manually:
```bash
# Chat (will work once ingestion populates data)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What are the transfer station hours?"}]}'

# Departments
curl http://localhost:3000/api/departments?town=needham

# Admin (with auth)
curl http://localhost:3000/api/admin/documents \
  -H "x-admin-password: $ADMIN_PASSWORD"
```
