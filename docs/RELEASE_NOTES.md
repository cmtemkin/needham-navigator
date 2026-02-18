# Release Notes

---

## v0.10.0 — 2026-02-18

**RSS/External News Integration — Unified Community Platform**

### New Features
- **External news ingestion** — Needham Patch, Needham Observer, and Needham Local are scraped every 4 hours via the connector framework; content stored in `content_items` with vector embeddings
- **AI article summaries** — `summarizeExternalArticle()` generates reader-friendly AI summaries from external news; inserted as `ai_summary` articles with source attribution
- **Automated article generation cron** (`/api/cron/generate`) — daily cron at 10 AM UTC generates articles from new documents + summarizes external news + creates daily brief
- **Content items in RAG search** — `vectorSearchContentItems()` searches `content_items` in parallel with `document_chunks`; external news surfaces in both search and chat with a 0.95x ranking penalty so official content ranks higher
- **Ingest cron** — `/api/cron/ingest` runs every 4 hours on Vercel to keep external sources fresh
- **Patch RSS source config** — added `needham:patch-rss` (disabled — feed returns 404; scrape connector handles Patch)

### Data
- 40 external content items ingested (15 Patch, 15 Observer, 10 Needham Local)
- 20 AI Summary articles generated from external news

---

## v0.9.1 — 2026-02-17

**Real Article Generation — Nuke Fake Seed Data**

### Bug Fixes
- **Deleted all fake seed articles** from production — fabricated articles about events that never happened, people that don't exist, and 404 source URLs are gone
- **Removed `scripts/seed-articles.ts`** — the script that created fake data is deleted from the repo
- **Fixed feedback API bug** — article detail page was sending `POST` with `{ feedback }` but API expects `PATCH` with `{ type }`; frontend now correctly sends `PATCH { type }`

### New Features
- **Real article generation** (`src/lib/article-generator.ts` rewritten) — generates articles exclusively from ingested documents in the Supabase `documents` table; every article has a real source URL; low-confidence results are discarded
- **Nightly GitHub Action** (`.github/workflows/generate-articles.yml`) — runs `generate-articles.ts` at 5 AM ET every day; can also be triggered manually from GitHub Actions UI
- **Admin API** (`POST /api/articles/generate`) — admin-authenticated endpoint to trigger article generation on demand; accepts `{ type: 'meeting_minutes' | 'public_record' | 'external' | 'daily_brief' | 'all' }`
- **CLI generation script** (`scripts/generate-articles.ts`) — standalone script for manual runs or CI; exits 0 on success, 1 on any errors
- **Delete-seed script** (`scripts/delete-seed-articles.ts`) — permanently removes all articles from the database; used once to purge fake data

### UI Improvements
- **Daily brief page** — empty state now says "Today's brief hasn't been generated yet. Check back after 5 AM." and a Sources section with clickable links is shown below each brief when sources exist
- **Homepage articles section** — entire "Latest Articles" section (header + grid) is now hidden when no articles exist, instead of showing a floating orphan header
- **Articles page** — empty state updated to: "Articles are generated daily from Needham's public records, meeting minutes, and local news. Check back soon!"
- **Article detail page** — source_type badge displayed alongside the "Sources (N)" count header; source links now have `break-all` for long URLs

---

## v0.9.0 — 2026-02-17

**AI Articles Hub Frontend**

### New Features
- **Articles list page** (`/<town>/articles`) — Browse all AI-generated articles and summaries with category and content-type filters, 12-per-page load-more, and an empty state
- **Article detail page** (`/<town>/articles/[id]`) — Full article view with proper markdown rendering (react-markdown), AI disclaimer banner, collapsible sources, thumbs up/down feedback, "Ask about this" button that pre-populates chat, and related articles sidebar
- **Daily Brief page** (`/<town>/daily-brief`) — Today's digest rendered as formatted markdown, with 7-day accordion history of previous briefs
- **Homepage articles section** — Below the search hero, the home page now shows a Daily Brief Banner (when a brief exists for today) and a "Latest Articles" grid of 6 featured articles, with a "View all articles" link
- **Header nav** — Added "Articles" link (gated behind `enableNews` feature flag) pointing to `/articles`

### Components Added
- `ArticleCard` — Card component with content-type badge, category tag, title, summary, source, and relative timestamp; supports `grid` and `list` variants
- `DailyBriefBanner` — Gradient banner for the homepage showing today's brief summary with bullet points and a link to the full brief
- `ArticleFilters` — Category dropdown + content-type pill filters for the articles list page
- `ArticleSkeleton` / `DailyBriefSkeleton` — Animated loading placeholders

### Technical
- Installed `react-markdown` and `@tailwindcss/typography` for proper markdown rendering with prose styles
- `scripts/seed-articles.ts` — Dev seed script for 8 realistic sample articles (run with `npx tsx --env-file=.env.local scripts/seed-articles.ts`)

---

## v0.8.9 — 2026-02-14

**Search-First UI Skin with Floating Chat**

### New Features
- **Search-first UI mode** — Alternative interface optimized for document discovery and quick lookup
  - Large search hero with instant results from `/api/search` endpoint
  - AI answers load asynchronously above search results
  - Cached answers display instantly with green "Instant" badge
  - Browse by topic cards and popular questions for discovery
- **Floating chat panel** — Persistent bottom-right chat bubble that opens to a side panel
  - "Ask about this" buttons on search results pre-populate the chat
  - "Ask follow-up" buttons on AI answers open chat with context
  - Suggestion chips before first message
  - Full conversation history maintained while panel is open
- **UI mode toggle** — Controlled via `uiMode: 'classic' | 'search'` flag in town config
  - Classic mode (default): Chat-first interface (existing HomePage)
  - Search mode: Search-first interface (new SearchHomePage)
  - Skin router in `[town]/page.tsx` selects appropriate component

### Components Added
- `SearchHomePage` — Main search-first homepage with hero, topic cards, results
- `SearchResultCard` — Individual search result with similarity score, "Ask about this" button
- `AIAnswerCard` — Four states: loading, cached (instant), loaded (streamed), prompt (opt-in)
- `FloatingChat` — Bottom-right FAB + slide-up chat panel with streaming responses
- `src/types/search.ts` — Shared TypeScript interfaces for search API
- `src/lib/stream-parser.ts` — Reusable SSE stream parser utility

### Improvements
- **Refactored TownChatPage** to use new `parseStreamResponse()` utility (cleaner, more maintainable)
- Search results show department tags, dates, and similarity percentages
- Mobile-responsive floating chat (full-width with margins on small screens)
- Graceful fallback if `/api/search` endpoint doesn't exist yet

### Technical
- Skin routing logic in `src/app/[town]/page.tsx` checks `townConfig.feature_flags.uiMode`
- SSE parsing logic extracted from TownChatPage into reusable utility
- Both skins share ChatBubble, SourceChip, and other components
- No changes to existing classic skin (HomePage) — fully backward compatible

---

## v0.8.8 — 2026-02-14

**Remove AI Disclaimer Preamble from Chat Responses**

### Improvements
- **Chat responses no longer start with an AI accuracy disclaimer** — the UI already displays a verification badge and disclaimer footer, so the redundant LLM-generated preamble ("This tool uses AI and may provide inaccurate information...") has been removed
- System prompt now explicitly instructs the LLM to jump straight into answering the question

### Technical
- Removed `FIRST-MESSAGE DISCLAIMER` section from system prompt in `src/lib/prompts.ts`
- Removed `getFirstMessageDisclaimer()` usage from `buildChatSystemPrompt()`
- Added rule 7: "Do NOT start your response with a disclaimer or preamble"
- Updated integration tests to verify new behavior

---

## v0.8.7 — 2026-02-14

**SEO Fundamentals & Branded 404 Page**

### New Features
- **robots.txt**: Allows all crawlers, blocks `/admin` and `/api/` paths, points to sitemap
- **Dynamic sitemap.xml**: Auto-generates URLs from town configs — adding a new town to `config/towns.ts` automatically adds its routes to the sitemap. Feature-flagged routes (e.g., news) included only when enabled.
- **Open Graph & Twitter meta tags**: Social media sharing now shows title, description, and site name instead of blank previews
- **Branded 404 page**: Clean "Page not found" page with the Navigator logo and a link back to the homepage

### Technical
- `src/app/robots.ts` — Next.js Metadata API robots file
- `src/app/sitemap.ts` — Dynamic sitemap from `TOWN_CONFIGS`, skips test towns
- `src/app/layout.tsx` — Enhanced metadata with `metadataBase`, OG, Twitter, and robots tags
- `src/app/not-found.tsx` — Styled 404 page matching site design language

---

## v0.8.6 — 2026-02-13

**Multi-Tenant System Prompt — Remove Hardcoded Needham Data**

### Bug Fixes
- **System prompt no longer hardcodes Needham-specific facts** (Transfer Station address, MBTA stations, sticker prices, Town Hall phone). All town-specific facts now come from RAG retrieval, making the prompt fully multi-tenant.
- **Fallback "call Town Hall" message** now uses the correct phone number from the town's config instead of a hardcoded `(781) 455-7500`
- **Synonym expansions** no longer embed factual data (addresses, dates) — only genuine informal→formal query mappings remain

### Technical
- `buildChatSystemPrompt()` now accepts `townName` and `townHallPhone` parameters
- `FIRST_MESSAGE_DISCLAIMER` constant replaced with `getFirstMessageDisclaimer(townHallPhone)` function
- Chat route looks up town config via `getTownById()` and passes dynamic values to prompt builder
- Removed `"1421 Central Avenue"` and `"first Monday in May"` from synonym expansions in `synonyms.ts`

---

## v0.8.5 — 2026-02-13

**OpenAI Cost Tracking & Admin Dashboard**

### New Features
- **Automatic cost logging**: Every chat API call now logs token usage (input/output tokens) and estimated USD cost to the `api_costs` table — fully async, does not slow down responses
- **Cost monitor dashboard**: New "Costs" tab in `/admin` with:
  - Today / This Week / This Month summary cards
  - Projected monthly cost (extrapolated from daily average)
  - Average cost per query, total requests, total tokens
  - Daily cost bar chart (last 30 days) with hover tooltips
  - Cost-by-model breakdown with progress bars
  - Friendly empty state when no data exists yet
- **Cost API endpoint**: `GET /api/admin/costs` returns cost summary JSON (admin-protected)
- **Model pricing constants**: `MODEL_COSTS` in `src/lib/cost-tracker.ts` maps all supported models to per-token pricing for easy updates

### Database
- **Migration:** `002_cost_tracking.sql` — creates `api_costs` table with indexes on `created_at`, `endpoint`, and `town_id`

### Technical
- Uses Vercel AI SDK v6 `result.usage` promise for non-blocking token tracking
- Gracefully handles missing `api_costs` table (shows empty state, no errors)
- Fire-and-forget logging pattern — cost tracking failures never affect chat responses

---

## v0.8.4 — 2026-02-12

**Embedding Model Migration: text-embedding-3-small → text-embedding-3-large**

### Bug Fixes
- **Fixed broken RAG retrieval**: OpenAI changed `text-embedding-3-small` to return 384 dimensions instead of 1536 after a service incident, causing "different vector dimensions" errors in pgvector search
- **Switched to `text-embedding-3-large`** (with `dimensions: 1536`) which correctly respects the dimensions parameter — same vector size, more capable model
- **Re-embedded all 2,068 chunks** in Supabase with the new model — full RAG pipeline restored with high-confidence answers and source citations

---

## v0.8.3 — 2026-02-12

**Configurable Chat Model + Upgrade to GPT-5 Nano**

### New Features
- **Admin model selector**: New Settings tab in `/admin` dashboard lets you swap the chat model without redeploying. Choose from GPT-5 Nano, GPT-5 Mini, GPT-4o Mini, or GPT-4.1 Mini with pricing info displayed inline.
- **Default model → GPT-5 Nano**: 3x cheaper than GPT-4o Mini ($0.05 vs $0.15/M input), newer model, 400K context window. Perfect for municipal Q&A.
- **Model stored in Supabase**: Chat model preference persisted in `towns.config` JSONB column — changes take effect immediately, no migration needed.

---

## v0.8.2 — 2026-02-12

**API Error Handling Hardening**

### Bug Fixes
- **Chat no longer returns 500 when OpenAI embedding API fails**: Wrapped RAG retrieval in its own try/catch so embedding or Supabase failures gracefully degrade to the "call Town Hall" fallback response instead of crashing
- **Content API handles missing `content_items` table**: If the migration hasn't been applied, `/api/content` returns an empty result set (200) instead of a 500 error
- **Added `console.error` logging to both `/api/chat` and `/api/content`**: Future errors will now appear in Vercel runtime logs for faster diagnosis

---

## v0.8.1 — 2026-02-11

**Data Quality Cleanup**

### Fixes
- **Department classification 4x improvement**: Title-based fallback patterns classify 47% of pages (236/500) into 24 departments — up from 12% (58/500) using URL patterns alone
- **Duplicate URL elimination**: Trailing-slash normalization in scraper prevents duplicate pages (e.g., `/page` vs `/page/`)
- **Stale date prevention**: System prompt now includes today's date so the AI won't present past events as upcoming
- **Build fix**: Resolved pre-existing type errors in connector framework (`runner.ts`, `scraper.ts`)

### Re-ingestion
- Full re-scrape and re-ingest with improved department metadata
- 500 documents, 2,068 chunks, 0 errors

---

## v0.8.0 — 2026-02-11

**Community Platform: Connector Framework + Local News Aggregation**

### New Features

**Pluggable Connector Framework**
- Config-driven data source architecture — add new content sources without code changes
- Generic connectors for RSS feeds, iCal calendars, and web scraping
- Connector registry with factory pattern for extensibility
- Automated ingestion runner with schedule tracking, error handling, and deduplication
- Content normalization into unified `content_items` table with pgvector embeddings
- `source_configs` table stores per-town connector configuration (URL, selectors, schedule)
- Cron API endpoint (`/api/cron/ingest`) for automated daily/hourly ingestion

**Local News Feed** (`/<town>/news`)
- Aggregates articles from 3 local news sources:
  - **Needham Patch** — 15 articles ingested
  - **Needham Observer** — 15 articles ingested
  - **Needham Local** — 10 articles ingested
- Filter by source with one-click filter chips
- Article cards with source badge, relative time, summary, and external link
- Load more pagination for browsing older articles
- News link in header navigation (feature-flag gated)

**Content API** (`/api/content`)
- Generic content query endpoint: filter by town, category, source
- Pagination with offset/limit and total count
- Excludes expired content automatically

**AI Content Generator** (`src/lib/ai/content-generator.ts`)
- Article summarization via GPT-4o-mini (2-sentence summaries)
- Daily digest generation from recent content items
- Weekend event preview generation (for future events integration)

**News Widget** (`src/components/dashboard/NewsFeedWidget.tsx`)
- Compact 5-headline widget for future dashboard integration
- "View all" link to full news page

### Database

- **Migration:** `004_content_platform.sql` — creates `content_items`, `source_configs`, and `generated_content` tables with pgvector HNSW indexing, RLS policies, and semantic search function
- **40 news articles** ingested from initial scrape of 3 Needham news sources

### Infrastructure

- Expanded `TownConfig` with new feature flags: `enableNews`, `enableEvents`, `enableDining`, `enableSafety`, `enableTransit`, `enableWeather`, `enableDashboard`
- Added `location` (lat/lng) and `transit_route` fields to town config
- New scripts: `scripts/seed-sources.ts` (source config seeder)
- Connector source files: `src/lib/connectors/` (types, registry, runner, rss, ical, scraper)

### Pages (28 total, +5 new)
- `/<town>/news` — local news feed
- `/api/content` — content query API
- `/api/cron/ingest` — automated ingestion endpoint
- 2 additional static generation pages

---

## v0.7.1 — 2026-02-11

**Full Re-Scrape & Data Quality Validation**

### Data Improvements
- **500 pages scraped** (up from 198 with Firecrawl — 152% increase)
- **2,068 chunks ingested** (up from 1,023 — 102% increase)
- **47 PDFs discovered** for future processing
- **Zero boilerplate** across all 500 pages — no [Loading], CivicPlus footers, language pickers, or navigation menus
- All old Firecrawl data cleared and replaced with clean custom scraper output

### Quality Scores (New vs Old)
| Question | Old Similarity | New Similarity | Change |
|---|---|---|---|
| Transfer station sticker | 0.504 | **0.678** | +0.174 |
| Zoning setbacks | 0.432 | **0.525** | +0.093 |
| Deck permit | 0.552 | **0.507** | -0.045 |
| Property tax rate | — | **0.746** | New |
| Town meeting | — | **0.694** | New |
| Where to vote | — | **0.635** | New |
| Snow parking ban | — | **0.633** | New |
| Dump hours | — | **0.663** | New |

- **9 of 10 test questions returned meaningful answers**
- **6 High confidence, 3 Medium confidence** (vs mostly Low/Low-Medium before)
- All citation titles are clean (no "Default" or "CivicPlus.CMS.FAQ" metadata)
- All responses are conversational and human-sounding

### Validation
- Ingestion validation passed with zero errors
- Zero orphaned chunks, zero documents without chunks
- Department coverage across 13+ municipal departments

---

## v0.7.0 — 2026-02-11

**Custom Scraper — Firecrawl Replacement**

### New Features

**Custom Web Scraper** (`scripts/scraper.ts`)
- Replaces Firecrawl API with a zero-cost custom scraper built on cheerio + @mozilla/readability + turndown
- Purpose-built for CivicPlus municipal sites (needhamma.gov page structure)
- Saves $16/month in Firecrawl API costs
- Parallel page fetching with configurable concurrency and rate limiting
- Content-hash based change detection for incremental scraping
- Extracts clean markdown from HTML with boilerplate removal

**Scraper Configuration** (`scripts/scraper-config.ts`)
- Centralized URL patterns, selectors, and exclusion rules for CivicPlus sites
- Configurable content selectors, navigation exclusions, and PDF link discovery
- Easy to extend for additional municipal site platforms

**Clean Re-ingestion Script** (`scripts/reingest-clean.ts`)
- One-command pipeline to scrape → chunk → embed → upsert fresh data
- Designed for full data refresh after switching scraper backends

**Smoke Test** (`scripts/smoke-test.ts`)
- Quick validation that the scraper can reach the site, fetch pages, and extract content
- Useful for CI and pre-deploy checks

### Changes
- `scripts/crawl.ts` — now a thin backward-compatible wrapper that delegates to `scripts/scraper.ts`
- `scripts/ingest.ts` — updated to work with the new scraper output format
- `__tests__/scripts/crawl.test.ts` — rewritten for the new scraper API
- `.env.example` — removed `FIRECRAWL_API_KEY`, added scraper config vars
- `.gitignore` — added scraper output/cache directories

### Infrastructure
- Removed `@mendable/firecrawl-js` dependency
- Added `cheerio`, `@mozilla/readability`, `turndown`, `jsdom` dependencies

---

## v0.6.0 — 2026-02-11

**AI Polish & Municipal Intelligence**

### New Features

**Conversational AI Personality**
- Rewritten system prompt: warm, conversational tone like a friendly town clerk
- Leads with direct answers, ends with natural follow-up questions
- Understands informal language ("the dump", "cops", "can I build a deck")
- Phone numbers are clickable (tel: links) in chat responses
- No bracket citations or metadata in AI text — clean, natural prose

**Smart Query Expansion** (`src/lib/synonyms.ts`)
- Two-tier synonym dictionary: 30+ universal entries + 9 Needham-specific entries
- Automatic query expansion: "dump" → also searches "Transfer Station, solid waste, recycling"
- Intent detection: "when is X open?" adds schedule/hours keywords to search
- Department routing: matches queries to relevant town departments for reranking
- Word-boundary matching prevents false positives (e.g., "street" won't match "tree")

**Improved Source Citations**
- Clean citation pills: CivicPlus CMS metadata stripped from document titles
- Clickable source links open official town pages in a new tab
- Generic/untitled sources filtered out automatically
- Deduplication by URL, max 4 source pills per response
- Responsive overflow handling on mobile

**Better Confidence Scoring**
- Now based on top similarity score (not average), more accurate for mixed-quality results
- Configurable thresholds via environment variables (`CONFIDENCE_HIGH_THRESHOLD`, `CONFIDENCE_MEDIUM_THRESHOLD`)
- New labels: "Verified from official sources" (high), "Based on town documents — verify for important decisions" (medium), "Limited information — contact the department directly" (low)
- Updated labels in all 3 languages (en/es/zh)

**Smarter Retrieval Pipeline**
- Multi-query vector search: parallel searches with original + expanded queries
- Similarity floor (0.35) filters out noise chunks
- Multi-factor reranking: semantic similarity (60%), keyword overlap (20%), recency (10%), document authority (10%), plus department boost
- Source diversity: selects chunks from different documents to avoid redundancy
- Lowered match threshold to 0.30 for better recall

### Bug Fixes
- Fixed source format mismatch between API (`document_title`) and UI (`title`)
- Edge case handling in system prompt (off-topic, ambiguous, multi-part questions)

---

## v0.5.1 — 2026-02-11

**Chat Bug Fix & Data Quality Improvements**

### Bug Fixes
- **Fixed "No response received" in chat UI**: The SSE stream parser in `TownChatPage.tsx` expected `0:` prefix but Vercel AI SDK v6 sends `data:` prefix — chat now correctly displays AI answers
- **Fixed confidence extraction**: Confidence level now correctly extracted from nested object returned by API

### Improvements
- **Boilerplate stripping**: Added `stripBoilerplate()` to `scripts/chunk.ts` — removes 15 patterns of CivicEngage CMS chrome (loading spinners, breadcrumbs, Google Translate picker, font probes, footer badges) before chunking
- **Oversized chunk safety**: Added `splitOversizedChunk()` with 4-level recursive splitting (paragraphs → newlines → sentences → hard token split) to prevent embedding API errors
- **Lowered match threshold**: Changed vector search threshold from 0.65 to 0.40 in chat API to return results for more queries
- **UI smoke test in checklist**: Added browser-based UI verification as step 2 in the merge-to-main checklist in `CLAUDE.md`

---

## v0.5.0 — 2026-02-10

**Production-Grade Ingestion Pipeline**

### New Features

**Comprehensive Crawl Coverage**
- Centralized URL registry with 40+ data sources from Research Report (`config/crawl-sources.ts`)
- Priority-based crawling (priority 1-5) with source categorization
- Incremental crawling with content-hash comparison (skips unchanged documents)
- Retry logic with exponential backoff (3 attempts, 1s/2s/4s delays)
- Enhanced exclusion patterns (search pages, login pages, binary formats)
- CLI options: `--sources` (crawl all sources), `--high-priority` (priority 4-5 only)

**Accurate Token Counting**
- Replaced 4 char/token approximation with js-tiktoken for exact tokenization
- Uses same tokenizer as OpenAI text-embedding-3-small model
- Prevents chunks from exceeding embedding model limits (8191 tokens)
- Precise overlap calculation with `getLastNTokens()` helper

**Enhanced PDF Extraction**
- Heuristic-based complexity detection (replaces keyword-only approach)
- Analyzes: avg chars/page (<200 = scanned), table density (>10 = complex), extraction length (<100 = failed)
- Parallel processing with configurable concurrency limit (default: 3 PDFs in parallel)
- Extraction validation: flags multi-page PDFs with <100 chars extracted
- Warnings for fee schedules without tables, high non-printable character density

**Content-Hash Change Detection**
- Replaced unreliable HTTP HEAD checks with full content-hash comparison
- Separate tracking of `last_crawled` (every check) and `last_changed` (only when hash differs)
- 0% false positives vs. ~50% with HTTP HEAD approach
- Accurate staleness warnings based on actual content changes

**Data Quality Validation** (`npm run validate`)
- Validates required metadata fields (document_title, document_type, document_url, etc.)
- Detects duplicate chunks via content_hash
- Verifies embedding dimensions (all 1536-dimensional)
- Coverage report: identifies departments with <3 chunks (data gaps)
- Checks for orphaned chunks (document_id references non-existent documents)
- Documents without chunks report (pending processing)

**Enhanced Metadata Tracking**
- Every chunk includes: `chunk_index`, `total_chunks`, `content_hash`
- Department extraction from URL patterns
- New database columns: `last_crawled`, `last_changed`
- Performance indexes: content_hash, metadata GIN index, chunk_index

### Infrastructure

- **Database Migration:** `003_enhance_metadata_tracking.sql` adds `last_crawled` and `last_changed` columns, plus 5 performance indexes
- **New Scripts:**
  - `scripts/validate-ingestion.ts` — post-ingestion quality validation
  - `config/crawl-sources.ts` — 40+ source URL registry
- **Package Updates:**
  - `js-tiktoken` ^1.0.21 — exact token counting for OpenAI models

### Improvements

- **scripts/chunk.ts:** Exact token counting, enhanced metadata (chunk_index, total_chunks, content_hash)
- **scripts/crawl.ts:** Incremental crawling, retry logic, source registry integration
- **scripts/extract-pdf.ts:** Heuristic complexity detection, parallel processing, validation
- **scripts/monitor.ts:** Content-hash comparison instead of HTTP HEAD
- **package.json:** Added `validate` script

### Target Metrics

- 200+ documents indexed (from 40+ sources)
- 100% token counting accuracy (vs. ±25% approximation)
- 0% change detection false positives (vs. ~50% with HTTP HEAD)
- All chunks have complete metadata
- Automated quality validation

---

## v0.4.0 — 2026-02-10

**All feature branches integrated into main**

### New Features

**Permit Wizard** (`/[town]/permits`)
- Guided step-by-step workflow for 4 project types: deck, fence, renovation, addition
- Decision tree asks 3 targeted questions per project type
- Generates personalized permit summary: required permits, estimated fees, documents needed, timeline, department contacts, and tips
- "Ask Navigator for More Details" links directly to chat with pre-filled question
- Fully multi-tenant — adapts town name, department phone from town config
- Full i18n support (English, Spanish, Chinese)

**Chat Feedback Mechanism**
- Thumbs up/down on every AI response
- Optional comment field (up to 2000 characters)
- Posts to `/api/feedback` with session tracking
- Visual states: idle, submitting, submitted, error with auto-retry

**Admin Dashboard** (`/admin`)
- Real-time analytics: feedback trends, query volume, response quality
- System logs viewer with filtering
- Structured ingestion logging
- Cron sync endpoint (`/api/cron/sync`)

**Multi-Tenant Architecture** (`/[town]/*`)
- Dynamic `[town]` routing — all pages scoped per town
- Town configuration in `config/towns.ts` (brand colors, departments, feature flags)
- Per-town CSS theming via CSS custom properties
- `TownProvider` context for client components
- Legacy `/chat` redirects to `/<default-town>/chat`

**Internationalization (i18n)**
- 3 languages: English, Spanish, Chinese
- Language toggle in header with localStorage persistence
- Browser language auto-detection
- All UI strings translated including permit wizard

**Infrastructure**
- Town-scoped Row Level Security (Supabase migration `002_town_scoped_rls.sql`)
- `town_id` parameter on feedback and department APIs
- Static page generation for all town routes

### Pages (23 total)
- `/` — root redirect
- `/[town]` — town home page (Needham, Mock Town)
- `/[town]/chat` — AI chat with feedback
- `/[town]/permits` — permit wizard
- `/admin` — admin dashboard
- `/chat` — legacy redirect
- 11 API routes

---

## v0.3.0 — 2026-02-09

### New Features
- Landing page with hero section, life situation tiles, popular questions, department directory
- Chat UI with typing indicators, source chips, confidence badges, follow-up suggestions
- Markdown rendering in AI responses

---

## v0.2.0 — 2026-02-09

### New Features
- RAG chat API with OpenAI embeddings
- Search endpoint
- Admin document and ingestion management endpoints
- Feedback collection API

---

## v0.1.0 — 2026-02-09

### New Features
- Data ingestion pipeline: crawl, extract, chunk, embed
- Supabase schema and migrations
- Next.js 14 project scaffold with Tailwind CSS
