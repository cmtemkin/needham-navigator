# Needham Navigator — Product Requirements Document

**AI-Powered Municipal Information Hub**

Needham, MA — First Instance of a Reusable Framework

Version 2.1 — February 2026

*Unified PRD with Parallel Branch Strategy*
*For AI Coding Agents in Google Antigravity (Claude Code, Codex)*

---

# 1. Product Overview

## 1.1 Vision Statement

Needham Navigator is the Apple-quality, AI-powered front door to local government and community information for Needham, MA. It transforms hundreds of scattered PDFs, web pages, and municipal documents into a single, conversational interface where any resident can get instant, accurate, source-cited answers about their town — from zoning regulations to transfer station hours to school enrollment.

Built as a reusable framework, it can be replicated for any municipality by swapping data sources and configuration, creating a scalable product that brings modern AI-powered civic engagement to towns across America.

## 1.2 Confirmed Technology Stack

The following technology choices have been confirmed and should not be reconsidered:

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Frontend** | Next.js + Tailwind CSS + shadcn/ui | React framework with utility CSS |
| **Backend/API** | Next.js API Routes | Serverless functions within Next.js |
| **Database** | Supabase PostgreSQL + pgvector | Free tier for MVP; $25/mo Pro |
| **Embeddings** | OpenAI text-embedding-3-small | $0.02/1M tokens (~$0.50/yr) |
| **LLM** | GPT-4o Mini | ~$0.07/mo for 500 questions |
| **Web Crawling** | Firecrawl API | $16/mo; clean markdown output |
| **PDF Extraction** | pypdf + LlamaParse | pypdf for simple; LlamaParse for complex |
| **Hosting** | Replit | Dev + deploy; NOT Vercel for now |
| **Scheduling** | Replit Scheduled Deployments | Daily cron for change detection |
| **AI SDK** | Vercel AI SDK | Streaming chat responses |

**Important:** Do NOT substitute or reconsider any of these technology choices. They have been selected deliberately based on cost, capability, and the builder's familiarity.

## 1.3 Target Users

### Primary Personas

**The Homeowner Renovator ("Sarah"):** Lives in Needham, wants to build a deck or addition. Needs to understand zoning setbacks, required permits, fees, and the application process. Currently must navigate 5+ different PDFs and web pages. Goal: Get a clear answer in 30 seconds.

**The New Resident ("James"):** Just moved to Needham. Needs to know about trash pickup (there is none — transfer station only), voter registration, school enrollment, MBTA stations, and general town services. Currently overwhelmed by the town website. Goal: One place to learn everything.

**The Concerned Citizen ("Maria"):** Long-time resident who wants to stay informed about Town Meeting warrants, Select Board decisions, MBTA Communities zoning changes, and property tax assessments. Currently relies on word-of-mouth and the Needham Channel. Goal: Quick, reliable updates on civic matters.

### Secondary Personas

**Real Estate Agents (David):** Need quick access to zoning districts, property records, school information, and tax rates when advising clients.

**Small Business Owners (Lisa):** Need permit information, Board of Health requirements, signage regulations.

**Town Staff:** May use the tool to answer resident questions more efficiently, reducing phone call volume.

## 1.4 Success Metrics

| Metric | Target (MVP) | Measurement |
|--------|--------------|-------------|
| **Answer Accuracy** | 80% of common questions answered correctly with source citation | Golden test dataset (68 questions) |
| **Response Time** | Under 2s initial load; under 5s for first AI token | Lighthouse audit |
| **Concurrent Users** | 100 concurrent without degradation | k6 load testing |
| **Data Coverage** | 200+ documents indexed (80%+ of public town docs) | Document inventory count |
| **User Engagement** | Average 3+ questions per session | Anonymous session analytics |
| **Accessibility** | WCAG 2.1 AA compliance | Axe/Lighthouse; screen reader test |

---

# 2. Core Features — MVP (Week 1)

## 2.1 AI Chat Interface

The primary interaction model. Chat is the main feature and the primary way residents interact with the tool.

### Natural Language Q&A

Users type questions in plain English about any Needham town service, regulation, or resource. The system retrieves relevant documents from the vector database, generates a synthesized answer using GPT-4o Mini, and presents it with streaming text.

**Examples:** "What are the zoning setback requirements for my lot?" — "When is the transfer station open?" — "How do I register to vote?" — "What permits do I need to build a deck?" — "Who is on the Select Board?"

**Implementation:** Vercel AI SDK useChat hook for streaming responses. Supabase pgvector for semantic search. System prompt instructs LLM to always cite sources, indicate confidence, and suggest follow-ups.

### Source Attribution

Every AI response includes clickable citations showing which document(s) the answer was sourced from, with document title, page/section, and last-updated date.

**Format:** Inline citations like [Zoning By-Law Ch.4, $4.1.2 (June 2024)] with expandable detail panel showing full source context.

**Critical Requirement:** If no relevant source is found, the system must NOT hallucinate. Instead: "I don't have specific information about that, but the [Department Name] can help. Contact: [phone/email]."

### Confidence Indicators

Each response includes a visual confidence level (High/Medium/Low) based on semantic similarity scores from vector search and number of supporting documents.

**High Confidence (Green):** Multiple documents support the answer with high semantic similarity (>0.85). Answer is likely accurate.

**Medium Confidence (Yellow):** Some supporting documents found (0.70--0.85 similarity). Answer may be incomplete; verify with town staff.

**Low Confidence (Orange):** Few or weak matches (<0.70 similarity). "This answer may not be accurate. Please contact the relevant department directly."

### Graceful Out-of-Scope Handling

When users ask questions outside the tool's knowledge base (federal tax questions, neighboring town info, personal advice), respond helpfully without hallucinating.

**Response Template:** "I don't have information about [topic]. This falls outside Needham town services. Here are some resources that may help: [relevant links]. For Needham-specific questions, try asking about [suggested topics]."

### Suggested Follow-Up Questions

After each response, show 2--3 clickable suggested follow-up questions based on the topic. Rendered as clickable pill buttons below the answer. LLM generates suggestions as part of the response.

### Conversation History

Chat maintains context within a session. Users can ask follow-up questions that reference previous answers. History persists until browser tab is closed.

**Storage:** Client-side only (React state). No server-side chat storage. No PII collection.

### Content Moderation (MVP)

For MVP, content guardrails are handled entirely through the system prompt (see Appendix A). The system prompt instructs the LLM to stay on-topic, decline inappropriate requests, and never provide legal/medical/financial advice. Dedicated content moderation will be addressed post-MVP.

## 2.2 Landing Page & Information Architecture

The landing page is the first thing users see. It must feel welcoming, intuitive, and guide non-technical users into the chat experience through visual tiles and clickable prompts. Refer to the HTML mockup (Needham_Navigator_UI_Mockup.html) as the definitive visual specification.

### Hero Section

Full-width hero with navy-to-dark gradient background, gold accent on "Needham." Contains a prominent search bar that submits directly to the chat. Headline: "Your guide to everything Needham." Pulsing "AI-Powered · Always Up to Date" badge.

### Quick Prompt Pills

Horizontally scrollable row of 8 one-click prompt pills that float over the hero-to-content transition. Each pill has an icon and short label. Clicking any pill immediately opens the chat view with that question pre-submitted.

**Default pills:** Transfer station hours, Pay my tax bill, Register to vote, School enrollment, Town Meeting dates, Snow parking ban, Dog license, Library hours.

### Life Situation Tiles

Grid of 8 large, visually appealing tiles organized by life situation (not department). Each tile has: a colored icon, title, brief description, and 2--3 clickable sub-prompts. Clicking the tile or any sub-prompt opens the chat with that question.

**Tile categories:** Home & Property, Schools & Education, Trash & Recycling, Parks & Recreation, Getting Around, Town Government, Safety & Emergencies, New to Needham.

### Most Asked Questions

Ranked grid of the 6 most common resident questions, each clickable to open chat. Shows question text and topic category.

### Department Quick Access

Horizontal scrollable row of department chips with name, phone number, and icon. Clicking a chip opens chat with a question about that department.

### Search

Search bar in both the hero section and the header. Combines full-text search (Supabase) with semantic/vector search. Returns ranked results with document title, relevance snippet, and source link.

### Department Directory

Comprehensive, searchable department directory with names, titles, phone numbers, emails, office hours, and physical addresses. Sourced from needhamma.gov/Directory.aspx.

## 2.3 Data Management

### Admin Dashboard

Simple admin interface (password-protected) at /admin for managing data sources. View all indexed documents, trigger re-ingestion, see last-updated dates, and flag outdated content.

**Features:** Document list with status (current/stale/error), manual re-ingest button per document or bulk, last successful ingest timestamp, error log for failed ingestions, simple analytics (total docs, total queries, popular topics).

**Implementation:** Next.js route /admin with basic auth. Supabase dashboard for direct database access as backup.

### Content Versioning

Every document in the vector database includes metadata: source URL, ingest date, document date, file hash (to detect changes), and version number. When a document is re-ingested, old chunks are deleted and new chunks replace them.

### Staleness Flagging

Documents not verified within 90 days are flagged as potentially stale in the admin dashboard. AI responses citing stale documents include a warning: "This information was last verified [date]. It may be outdated."

---

# 3. Enhanced Features — V2 (Week 2)

## 3.1 Interactive Zoning Map Integration

Embedded interactive map (via Needham's ArcGIS WebGIS) allowing users to click a parcel and see its zoning district, dimensional regulations, and permitted uses. Clicking a parcel auto-populates relevant zoning questions in the chat.

**Data Source:** Needham WebGIS (ArcGIS). GIS data available at needhamma.gov/2795.

## 3.2 Permit Wizard — "What Permits Do I Need?"

Guided workflow where users describe their project and the system walks them through: required permits, estimated fees, required documents, typical timeline, which departments review, and next steps.

**Example Flow:** "I want to build a deck" → "Is it attached to the house?" → "What is the square footage?" → "Based on your answers, you need: Building Permit ($150 min), plot plan, and building plans."

## 3.3 Multi-Language Support

Needham has 16.7% foreign-born population. Support common languages: Chinese (Mandarin), Spanish, Portuguese, Korean, Hindi. UI language toggle plus AI responses generated in the user's language.

**Implementation:** GPT-4o Mini handles multilingual generation natively. UI strings via i18n library (next-intl). Language auto-detection from browser settings.

## 3.4 Feedback Mechanism

"Was this answer helpful?" thumbs up/down after each response. Optional free-text feedback. Anonymous, no PII collected. Data stored in Supabase for quality improvement.

## 3.5 Analytics Dashboard

Admin-facing dashboard showing: most asked topics, unanswered questions, feedback scores, daily/weekly/monthly usage trends, popular quick links, average session length.

## 3.6 Mobile PWA

Progressive Web App so the site can be installed on mobile home screens. Offline support for cached content.

## 3.7 Notification Signup

Email signup for automated notifications when Town Meeting warrants are posted, Select Board agendas are published, or major zoning changes are proposed.

---

# 4. Document Chunking Strategy

This section defines how each category of Needham municipal document should be chunked for optimal RAG retrieval. The strategy uses a hybrid approach: structure-based chunking (using document headings and sections) combined with semantic boundaries, with document-type-specific parameters.

## 4.1 Chunking Parameters by Document Type

| Document Type | Chunk Size | Overlap | Break Strategy | Rationale |
|---|---|---|---|---|
| **Zoning Bylaws** | 1,024 tokens | 256 (25%) | Section headers (Ch.1--8) | Legal definitions need complete context |
| **General Bylaws** | 768 tokens | 192 (25%) | Numbered paragraph breaks | Numbered structure enables precise referencing |
| **Building Permits** | 512 tokens | 128 (25%) | Procedural step breaks | Users follow procedural flow |
| **Fee Schedules** | 384 tokens | 96 (25%) | Table-atomic (never split) | Tabular data must stay intact |
| **Budget Documents** | 1,280 tokens | 320 (25%) | Narrative + data separation | Text and tables serve different queries |
| **Board of Health** | 768 tokens | 192 (25%) | Topic-based | Regulations and minutes are distinct types |
| **Public Works / RTS** | 512 tokens | 128 (25%) | Section-based | Short, discrete information items |
| **Meeting Minutes** | 768 tokens | 192 (25%) | Agenda item-based | Agenda items are natural breakpoints |
| **Planning Board** | 896 tokens | 224 (25%) | Item + project separation | Mixed regulatory and case content |

## 4.2 Table Handling Rules

1. Never split a table mid-row. Tables under 1,024 tokens are kept as single atomic chunks.

2. For tables exceeding 1,024 tokens, split by logical grouping (Residential/Commercial/Industrial) while keeping all columns intact.

3. Always include the table's section heading and any footnotes in the same chunk.

4. Add table_type and table_name to chunk metadata for targeted retrieval.

## 4.3 Cross-Reference Handling

Municipal documents heavily cross-reference each other (e.g., Zoning Bylaw §5.2 references General Bylaws §12.1). Each chunk includes a cross_references metadata field listing related documents. During retrieval, the system should surface related chunks from referenced documents alongside the primary result.

## 4.4 Universal Metadata Schema

Every chunk stored in Supabase must include this metadata (stored as JSONB):

**chunk_id** (e.g., "ZB-5.2.1"), **document_id**, **document_title**, **document_type** (regulation/procedure/meeting/budget/informational), **department**, **document_url**, **section_number**, **section_title**, **page_number**, **effective_date**, **last_amended**, **document_date**, **chunk_type** (regulation/table/procedure_step/meeting_item/financial_data), **contains_table** (bool), **cross_references** (array), **keywords** (array), **applies_to** (array of zones/categories).

---

# 5. Data Ingestion & Monitoring Pipeline

## 5.1 Architecture Overview

The ingestion system has four tiers that run as a coordinated pipeline:

### Tier 1: Change Detection (Daily at 2 AM)

A Replit Scheduled Deployment runs daily to: (1) Check CivicPlus RSS feed at /rss.aspx for new announcements, (2) Crawl sitemap.xml for new or removed URLs, (3) Compare HTTP HEAD responses (Last-Modified, Content-Length, ETag) for all tracked PDF URLs against stored hashes. When changes are detected, URLs are queued for re-ingestion.

### Tier 2: Content Download

**Initial crawl:** Firecrawl API crawls 200+ pages on needhamma.gov, returning clean markdown. All linked PDFs are downloaded and stored with metadata (URL, download_time, file_size, content_hash).

**Incremental updates:** Only changed/new URLs are re-crawled. Firecrawl's map endpoint discovers new pages. Direct HTTP download for changed PDFs.

**Cost:** Firecrawl free tier (500 credits) covers initial crawl. Monthly monitoring: $16/month for ongoing crawls.

### Tier 3: Processing Pipeline

For each downloaded document:

1. pypdf extracts text from standard PDFs (free, fast).

2. LlamaParse API processes complex PDFs with tables or multi-column layouts (free tier: 1,000 pages/day).

3. Content is chunked according to the strategy in Section 4.

4. OpenAI text-embedding-3-small generates embeddings.

5. Chunks are upserted into Supabase pgvector with full metadata.

### Tier 4: Version Tracking

Supabase tables track document versions. When a document is re-ingested, old chunks are deleted and new chunks replace them. Documents not verified within 90 days are flagged as stale. The admin dashboard shows staleness status.

## 5.2 Ingestion Tools

| Component | Tool | Cost | Role | Why |
|---|---|---|---|---|
| **Web Crawling** | Firecrawl | $16/mo | Crawl needhamma.gov | API-driven, clean markdown, handles CivicPlus |
| **PDF Extraction** | pypdf + LlamaParse | $0--10/mo | Extract text from PDFs | pypdf for simple; LlamaParse for complex tables |
| **Change Detection** | Custom cron | $0 | Detect updates | HTTP HEAD hash comparison on Replit |
| **Embeddings** | text-embedding-3-small | <$1/mo | Generate vectors | Best cost/quality at $0.02/1M tokens |
| **Vector Storage** | Supabase pgvector | $0--25/mo | Store & search | Hybrid search: vector + full-text + SQL |
| **Scheduling** | Replit Scheduled | $0 | Daily cron jobs | Already in Replit ecosystem |

---

# 6. Technical Specification

## 6.1 System Architecture

The system consists of five layers: Frontend (Next.js + React), API Layer (Next.js API Routes), AI/RAG Engine (Vercel AI SDK + OpenAI), Data Layer (Supabase PostgreSQL + pgvector), and Ingestion Pipeline (Firecrawl + pypdf + LlamaParse + custom scripts).

**Architecture Flow:** [User Browser] → [Replit CDN] → [Next.js Frontend (React + Tailwind)] → [Next.js API Routes (/api/chat, /api/search, /api/admin)] → [Vercel AI SDK] → [OpenAI GPT-4o Mini (answer generation)] + [OpenAI text-embedding-3-small (query embedding)] → [Supabase pgvector (semantic search)] → [Response streamed back to user]

**Ingestion Flow:** [Replit Scheduled Deployment (daily)] → [Firecrawl (web crawl)] + [pypdf/LlamaParse (PDF extraction)] → [Document-type-specific chunking (Section 4)] → [OpenAI Embeddings] → [Supabase pgvector (document storage)]

## 6.2 API Design

| Method | Endpoint | Purpose | Notes |
|--------|----------|---------|-------|
| **POST** | /api/chat | Send question, receive streamed AI response | Body: { messages, town_id }. Streaming via Vercel AI SDK. |
| **GET** | /api/search?q=...&town=... | Full-text + semantic search | Ranked results with snippets and source metadata. |
| **GET** | /api/departments?town=... | Department directory | All departments with contacts for specified town. |
| **GET** | /api/categories?town=... | Browse categories | Category tree with document counts. |
| **POST** | /api/feedback | Submit response feedback | Body: { response_id, helpful, comment? }. Anonymous. |
| **POST** | /api/admin/ingest | Trigger document re-ingestion | Auth required. Body: { source_url? } or bulk. |
| **GET** | /api/admin/documents | List indexed documents | Auth required. Docs with status and metadata. |
| **GET** | /api/admin/analytics | Usage analytics | Auth required. Query counts, popular topics. |

## 6.3 Data Model

### Core Tables (Supabase PostgreSQL):

**documents:** id (UUID PK), town_id (TEXT FK), url (TEXT UNIQUE), title (TEXT), source_type (TEXT: pdf/html), content_hash (TEXT), file_size_bytes (INT), downloaded_at (TIMESTAMP), last_ingested_at (TIMESTAMP), last_verified_at (TIMESTAMP), is_stale (BOOLEAN DEFAULT false), chunk_count (INT), metadata (JSONB).

**document_chunks:** id (UUID PK), document_id (UUID FK), town_id (TEXT), chunk_index (INT), chunk_text (TEXT), embedding (vector(1536)), metadata (JSONB — contains all fields from Section 4.4), created_at (TIMESTAMP).

**towns:** id (TEXT PK), name (TEXT), website_url (TEXT), brand_colors (JSONB), config (JSONB), created_at (TIMESTAMP).

**conversations:** id (UUID PK), town_id (TEXT FK), session_id (TEXT), created_at (TIMESTAMP). No PII stored; sessions are anonymous UUIDs.

**feedback:** id (UUID PK), conversation_id (UUID FK), response_text_hash (TEXT), helpful (BOOLEAN), comment (TEXT), created_at (TIMESTAMP).

**departments:** id (UUID PK), town_id (TEXT FK), name (TEXT), phone (TEXT), email (TEXT), address (TEXT), hours (TEXT), description (TEXT).

**ingestion_log:** id (UUID PK), timestamp (TIMESTAMP), action (TEXT: crawl/parse/embed/monitor), documents_processed (INT), errors (INT), duration_ms (INT), details (JSONB).

Row-level security (RLS) enforced on all tables by town_id to ensure multi-tenant data isolation.

## 6.4 Deployment

**Hosting:** Replit for development and initial deployment. Deployment optimization deferred — priority is building end-to-end. Vercel migration can happen later if needed.

**Database:** Supabase (free tier for MVP, $25/month Pro for production).

**Domain:** Custom domain via Namecheap (~$10/year). CNAME configured on Replit.

**Secrets Management:** Replit Secrets for: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, LLAMAPARSE_API_KEY, ADMIN_PASSWORD, FIRECRAWL_API_KEY.

**CI/CD:** Replit handles build and deploy. Linting via ESLint configured in project.

---

# 7. Testing Strategy

## 7.1 Golden Test Dataset

A comprehensive test dataset of **68 questions** has been created (see Needham_Navigator_Golden_Test_Dataset.json). The dataset covers all 5 personas across 12 topic areas with a mix of Easy, Medium, and Hard difficulty levels.

| Category | # Questions | Difficulty Mix | Key Tests |
|---|---|---|---|
| Zoning & Dimensional | 11 | 4 Easy, 5 Med, 2 Hard | Setbacks, FAR, home business, variances |
| Building Permits | 8 | 3 Easy, 3 Med, 2 Hard | Process, fees, required docs, inspections |
| Transfer Station / Trash | 5 | 3 Easy, 2 Medium | Hours, fees, NO curbside pickup |
| Property Taxes | 5 | 2 Easy, 2 Med, 1 Hard | Tax lookup, rates, abatement |
| Schools | 5 | 3 Easy, 2 Medium | Enrollment, calendar, community ed |
| Transportation / MBTA | 4 | 3 Easy, 1 Medium | Stations, schedules, parking |
| Public Safety | 3 | 2 Easy, 1 Medium | Non-emergency contacts, alerts |
| Health / Food | 4 | 2 Easy, 2 Medium | Food permits, inspections |
| Parks & Rec | 3 | 2 Easy, 1 Medium | Programs, pools, field permits |
| Town Government | 5 | 2 Easy, 2 Med, 1 Hard | Town Meeting, bylaws, MBTA zoning |
| Edge Cases | 10+ | Various | Vague, multi-part, wrong assumptions, out-of-scope |

## 7.2 Persona Coverage in Test Dataset

**Sarah (Homeowner Renovator):** 16 questions — decks, additions, fences, setbacks, permits, fees, process.

**James (New Resident):** 17 questions — trash/recycling, schools, registration, MBTA, library, basics.

**Maria (Concerned Citizen):** 15 questions — Town Meeting, taxes, Select Board, zoning changes, appeals.

**David (Real Estate Agent):** 12 questions — zoning lookups, property records, school districts, tax rates.

**Lisa (Small Business Owner):** 8 questions — food permits, signage, home occupation, health inspections.

## 7.3 Testing Protocol

After each data ingestion cycle, run the full test suite programmatically:

1. Send each question to the /api/chat endpoint.

2. Parse the response for expected_answer_contains keywords.

3. Verify source citations match expected_source.

4. Check confidence level matches expected_confidence.

5. Score: percentage of questions where all expected facts appear.

6. Target: 80%+ on Easy, 60%+ on Medium, 40%+ on Hard for MVP.

## 7.4 Critical Edge Cases

**Wrong assumption:** "Where do I put my trash cans on the curb?" — Must correct that Needham has NO curbside trash pickup and explain the Transfer Station.

**Vague question:** "I want to do something to my house" — Should ask clarifying questions about the type of project.

**Multi-part:** "What's my zoning AND what permits do I need?" — Should address both parts with appropriate sources.

**Out-of-scope:** "What are the federal income tax rates?" — Should gracefully decline and redirect.

## 7.5 Other Testing

**Unit Tests:** Jest for utility functions, API route handlers, and data processing. Target 80%+ coverage on critical paths.

**E2E Tests:** Playwright for critical user flows: ask a question, browse categories, search, view department directory.

**Accessibility Testing:** Automated via axe-core in CI pipeline. Manual screen reader testing with VoiceOver/NVDA. Keyboard-only navigation walkthrough.

**Load Testing:** k6 or Artillery to verify 100 concurrent user target.

---

# 8. Framework & Multi-Tenant Design

## 8.1 Configuration Schema

Each town instance is defined by a configuration object. Adding a new town requires creating this config and running the data ingestion pipeline. No code changes needed.

Town configuration includes: **town_id** (unique slug), **display_name**, **website_url**, **custom_domain**, **colors** (primary, accent, background, text), **logo_url**, **timezone**, **departments** (array), **data_sources** (array of URLs), **feature_flags** (enableZoningMap, enablePermitWizard, enableMultiLanguage), **vector_namespace** (isolated embedding space per town), **analytics_id**.

## 8.2 Theming System

CSS custom properties set from the town config at the layout level. Primary color, accent color, text color, and background color cascade through all components. Town logo replaces Needham seal. Font remains system default for performance.

## 8.3 Pricing Model Concept

| Component | Price | Includes |
|---|---|---|
| **Setup Fee** | $2,500 -- $5,000 | Data source ID, initial ingestion, config, theme, QA, launch support |
| **Monthly SaaS** | $200 -- $500/mo | Hosting, LLM API costs, data refresh, monitoring, bug fixes, basic support |
| **Premium Add-ons** | $100 -- $300/mo each | Zoning map, permit wizard, multi-language, analytics dashboard |

At $500/month per town, 10 towns generates $60K ARR. Infrastructure cost per town is ~$15--30/month, yielding ~90%+ gross margin.

---

# 9. User Experience & Design

## 9.1 Design Principles

**Clean:** Minimal visual noise. White space is a feature. Every element earns its place.

**Trustworthy:** Government-adjacent tools must feel authoritative. Navy/blue palette. Source citations build credibility. No flashy animations.

**Accessible:** WCAG 2.1 AA minimum. High contrast. Keyboard navigable. Screen reader compatible. Mobile-first responsive.

**Fast:** Streaming AI responses. Skeleton loading states. No full-page reloads.

**Forgiving:** Typo-tolerant search. Helpful error messages. Always provide a path forward.

## 9.2 Color Palette

Based on Needham's official branding (navy/gold/white):

**--primary:** #003F87 (Needham navy) — Headers, primary buttons, navigation

**--primary-dark:** #002D62 — Hero gradient, hover states

**--accent:** #D4AF37 (gold) — Highlights, active states, badges

**--bg:** #FFFFFF — Main content area

**--surface:** #F7F8FA — Card backgrounds, tile backgrounds

**--text-primary:** #1A1A1A — Body text

**--text-secondary:** #5A6070 — Captions, descriptions

**--text-muted:** #9CA3AF — Timestamps, metadata, hints

**--success:** #059669 — High confidence indicators

**--warning:** #D97706 — Medium confidence, staleness alerts

## 9.3 Typography

**Font Stack:** system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif. System fonts for zero download cost and native platform feel.

## 9.4 UI Mockup Reference

The file **Needham_Navigator_UI_Mockup.html** is the definitive visual specification. Open it in a browser and implement the UI to match. It is a fully interactive prototype with working navigation between the landing page and chat views, simulated AI responses, and all click targets functional.

**Key UI elements to implement exactly as shown in the mockup:**

- Hero section with gradient background, search bar, and "Ask Navigator" button

- Horizontally scrollable quick prompt pills overlapping hero/content

- 8 life-situation tiles with icons, descriptions, and clickable sub-prompts

- Most Asked Questions ranked grid

- Department chips with phone numbers

- Chat view with back button, avatar, source citations, confidence badges, follow-up pills

- Chat welcome state with suggestion buttons

- Responsive mobile layout (tiles stack, header simplifies)

## 9.5 Loading & Error States

**AI Response Loading:** Animated typing indicator (three dots) while generating. Response streams in character by character.

**Page Loading:** Skeleton screens matching final layout. No spinners. No blank white screens.

**Errors:** Friendly, specific messages. Always provide alternative: "Something went wrong. Try rephrasing your question, or contact Town Hall at (781) 455-7500."

**No Results:** "I couldn't find information about that. Here are some suggestions: [related topics]. Or contact [relevant department]."

---

# 10. Development Environment & Setup

This section assumes you are starting from a **completely empty GitHub repository** that has been manually created on github.com and cloned into Google Antigravity. There is no existing code, no configuration, and no dependencies installed. The primary coding agent is **Claude Code** running in Antigravity's integrated terminal.

## 10.1 Prerequisites (Manual, Before Coding Begins)

The human operator must complete these steps before any AI agent begins coding:

- Create a new empty GitHub repository (e.g., needham-navigator)

- Clone the empty repo into Google Antigravity as a new project

- Create a Supabase project at supabase.com (free tier). Copy the Project URL and anon/service keys.

- Get an OpenAI API key from platform.openai.com

- Get a Firecrawl API key from firecrawl.dev (free tier: 500 credits)

- Get a LlamaParse API key from cloud.llamaindex.ai (free tier: 1,000 pages/day)

- Copy all four reference files into a /docs folder in the repo: this PRD, the Research Report, the Golden Test Dataset JSON, and the UI Mockup HTML

## 10.2 Project Bootstrap (Day 1 — Claude Code in Antigravity)

Open Claude Code in Antigravity's terminal. Give it this exact prompt to bootstrap the project from the empty repo:

> Read the PRD at /docs/Needham_Navigator_PRD.docx (or its text equivalent). This is an empty repo. Bootstrap the full project: (1) Initialize Next.js 14 with App Router, TypeScript, Tailwind CSS, and ESLint. (2) Install dependencies: @supabase/supabase-js, ai, openai, @ai-sdk/openai, lucide-react. Install dev deps: @types/node, @types/react. (3) Create .env.local with placeholders for OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, LLAMAPARSE_API_KEY, FIRECRAWL_API_KEY, ADMIN_PASSWORD. (4) Create the Supabase database schema from Section 6.3 of the PRD as a SQL migration file at /supabase/migrations/001_initial_schema.sql. Include pgvector extension, all tables, RLS policies, and indexes. (5) Create a basic project structure: src/app/ for pages, src/lib/ for utilities, src/components/ for React components, scripts/ for ingestion scripts. (6) Add a .gitignore for Next.js, node_modules, .env.local. (7) Create a basic layout.tsx with the Needham Navigator color tokens as CSS variables from Section 9.2 of the PRD. (8) Commit everything as 'Initial project scaffold' and push to main.

After this bootstrap completes, the main branch should have a running (but empty) Next.js app with the full database schema ready to deploy to Supabase.

## 10.3 Environment Variables

Create a .env.local file in the project root (this file is gitignored). The human operator must fill in real values:

OPENAI_API_KEY=sk-... (from platform.openai.com)

SUPABASE_URL=https://xxxxx.supabase.co (from Supabase dashboard)

SUPABASE_ANON_KEY=eyJ... (from Supabase dashboard > Settings > API)

SUPABASE_SERVICE_KEY=eyJ... (from Supabase dashboard > Settings > API, service_role key)

FIRECRAWL_API_KEY=fc-... (from firecrawl.dev)

LLAMAPARSE_API_KEY=llx-... (from cloud.llamaindex.ai)

ADMIN_PASSWORD=... (choose any password for /admin route)

**Important:** After filling in .env.local, run the SQL migration against Supabase. Go to Supabase Dashboard > SQL Editor and paste the contents of /supabase/migrations/001_initial_schema.sql. Run it.

---

# 11. Parallel Branch Strategy

After the main branch is bootstrapped (Section 10.2), the project splits into three parallel workstreams on separate git branches. Each branch is assigned to a different AI agent working in Google Antigravity's Manager View (Mission Control). The branches are designed so that **no two agents edit the same files**, preventing merge conflicts.

## 11.1 Branch Overview

| Branch | Agent | Scope | PRD Sections |
|--------|-------|-------|---|
| **feature/ingestion** | Agent 1 (Claude) | Data pipeline: crawling, PDF extraction, chunking, embeddings, Supabase storage, monitoring cron | Sections 4, 5, 6.3 (tables only) |
| **feature/chat-api** | Agent 2 (Codex) | RAG chat endpoint, search API, system prompt, source citations, confidence scoring | Sections 2.1, 6.1, 6.2, Appendix A |
| **feature/frontend** | Agent 3 (Claude) | Landing page, chat UI, tiles, department directory. Uses mocked API responses initially. | Sections 2.2, 9, UI Mockup HTML |

## 11.2 File Ownership (No Overlap)

Each branch owns a specific set of files. Agents must NOT create or modify files outside their ownership scope. This is what prevents merge conflicts.

### Branch: feature/ingestion

- scripts/ingest.ts — Main ingestion orchestrator

- scripts/crawl.ts — Firecrawl web crawler

- scripts/extract-pdf.ts — pypdf + LlamaParse extraction

- scripts/chunk.ts — Document-type-specific chunking logic (Section 4)

- scripts/embed.ts — OpenAI embedding generation + Supabase upsert

- scripts/monitor.ts — Daily change detection cron (HTTP HEAD hash comparison)

- src/lib/supabase.ts — Supabase client singleton (shared, but created by this branch)

- src/lib/embeddings.ts — Embedding utility functions

### Branch: feature/chat-api

- src/app/api/chat/route.ts — Main RAG chat endpoint with streaming

- src/app/api/search/route.ts — Full-text + semantic search endpoint

- src/app/api/departments/route.ts — Department directory endpoint

- src/app/api/categories/route.ts — Browse categories endpoint

- src/app/api/feedback/route.ts — Feedback submission endpoint

- src/app/api/admin/ — All admin API routes (ingest trigger, document list, analytics)

- src/lib/rag.ts — RAG retrieval logic (vector search + reranking)

- src/lib/prompts.ts — System prompt and prompt templates (Appendix A)

- src/lib/confidence.ts — Confidence scoring logic

### Branch: feature/frontend

- src/app/page.tsx — Landing page (hero, tiles, prompts, departments)

- src/app/chat/page.tsx — Chat view page

- src/app/admin/page.tsx — Admin dashboard page

- src/components/ — All React components (ChatBubble, Tile, PromptPill, DeptChip, SourceChip, ConfidenceBadge, HeroSearch, etc.)

- src/app/globals.css — Global styles, Tailwind config, CSS variables

- src/lib/mock-data.ts — Mock API responses for development (removed after merge)

- public/ — Static assets (favicon, Needham logo, OG image)

## 11.3 Branch Creation Commands

After the main branch bootstrap is complete, create all three branches from main. In Antigravity's terminal (or via Manager View):

**git checkout -b feature/ingestion main && git push -u origin feature/ingestion**

**git checkout -b feature/chat-api main && git push -u origin feature/chat-api**

**git checkout -b feature/frontend main && git push -u origin feature/frontend**

Then assign each branch to a separate agent workspace in Antigravity's Manager View.

## 11.4 Agent Prompts

When spawning each agent in Antigravity's Manager View, give them targeted prompts that reference specific PRD sections:

### Prompt for Ingestion Agent (feature/ingestion)

> You are working on the feature/ingestion branch. Read /docs/Needham_Navigator_PRD.docx Sections 4 (Chunking Strategy) and 5 (Ingestion Pipeline). Also read /docs/Needham_Navigator_Research_Report.docx for the full data source inventory with URLs. Build the complete data ingestion pipeline: (1) Firecrawl crawler for needhamma.gov pages, (2) PDF downloader + pypdf/LlamaParse extraction, (3) Document-type-specific chunking per Section 4.1, (4) OpenAI embedding generation, (5) Supabase pgvector upsert with full metadata schema from Section 4.4, (6) Daily monitoring cron with HTTP HEAD hash comparison. Create a src/lib/supabase.ts client. All scripts go in /scripts/. Test by ingesting 10 documents and verifying they appear in Supabase. Do NOT create any files in src/app/ or src/components/ — those belong to other branches.

### Prompt for Chat API Agent (feature/chat-api)

> You are working on the feature/chat-api branch. Read /docs/Needham_Navigator_PRD.docx Sections 2.1 (Chat Interface features), 6.1 (Architecture), 6.2 (API Design), and Appendix A (System Prompt). Build all API routes: (1) POST /api/chat — RAG pipeline with Vercel AI SDK streaming, Supabase pgvector retrieval, system prompt from Appendix A, source citation formatting, confidence scoring. (2) GET /api/search — hybrid full-text + semantic search. (3) GET /api/departments, /api/categories. (4) POST /api/feedback. (5) All /api/admin/ routes. Create src/lib/rag.ts, src/lib/prompts.ts, src/lib/confidence.ts. Test each endpoint with curl. Use the src/lib/supabase.ts client (it will exist from the ingestion branch — if it doesn't exist yet, create a minimal version). Do NOT create any files in src/components/ or modify src/app/page.tsx.

### Prompt for Frontend Agent (feature/frontend)

> You are working on the feature/frontend branch. Read /docs/Needham_Navigator_PRD.docx Sections 2.2 (Landing Page & IA) and 9 (UX & Design). Open /docs/Needham_Navigator_UI_Mockup.html in a browser — this is the EXACT visual specification. Implement the UI to match. Build: (1) Landing page at src/app/page.tsx with hero section, quick prompt pills, 8 life-situation tiles, most-asked questions grid, department chips. (2) Chat view at src/app/chat/page.tsx with message bubbles, source citations, confidence badges, follow-up suggestions, typing indicator, welcome state. (3) All React components in src/components/. (4) Use Tailwind CSS with the color tokens from Section 9.2. (5) Create src/lib/mock-data.ts with mock API responses so the UI works standalone. (6) Make it fully responsive. Do NOT create any files in src/app/api/ or /scripts/.

## 11.5 Merge Order

Branches must be merged into main in this specific order. Each merge should be done via pull request so you can review the diff in Antigravity's artifact view before merging.

| Order | Branch | Why This Order | Post-Merge Check |
|---|---|---|---|
| **1st** | **feature/ingestion** | Data must exist before API can query it. This branch creates src/lib/supabase.ts which others depend on. | Run ingest script; verify docs in Supabase |
| **2nd** | **feature/chat-api** | API reads from Supabase (now populated). Can test endpoints with curl against real data. | curl /api/chat with test question; verify source citations |
| **3rd** | **feature/frontend** | UI connects to working API. Remove mock-data.ts and wire components to real endpoints. | Full E2E test; run golden test dataset |

**After the 3rd merge**, the app should be fully functional end-to-end. Run the golden test dataset (68 questions) against /api/chat to verify answer quality.

## 11.6 Post-Merge Integration (Day 6--7)

After all three branches are merged, use Claude Code on main to:

- Remove src/lib/mock-data.ts and wire all frontend components to real API endpoints

- Run the full ingestion pipeline to index 200+ documents

- Execute the golden test dataset and fix any retrieval issues

- Polish responsive design, fix edge cases, run accessibility audit (Lighthouse)

- Add legal disclaimers from Appendix B to the footer and chat welcome state

---

# 12. Development Schedule

## 12.1 Week 1: Core MVP

| Day | Tasks | Deliverable |
|--------|-------|---|
| **Day 1** | Manual: Create GitHub repo, Supabase project, get API keys. Claude Code: Bootstrap project from empty repo (Section 10.2). Copy /docs files. Push to main. | Running Next.js app + DB schema |
| **Day 2** | Create 3 parallel branches from main (Section 11.3). Assign agents in Antigravity Manager View. Spawn all 3 agents with prompts from Section 11.4. Monitor progress. | 3 agents working in parallel |
| **Day 3--4** | Agents continue building on their branches. Review artifacts and diffs as they complete. Answer any agent questions. Ingestion agent should have 50+ docs indexed by end of Day 4. | 3 branches with working code |
| **Day 5** | Merge in order: ingestion → chat-api → frontend. Resolve any minor conflicts. Wire frontend to real API (remove mocks). Verify end-to-end. | Working app on main branch |
| **Day 6** | Expand ingestion to 200+ docs. Run golden test dataset (68 questions). Fix retrieval issues. Tune chunking parameters. Fix UI bugs found during testing. | 200+ docs, 80%+ accuracy |
| **Day 7** | Polish: responsive design fixes, accessibility audit (Lighthouse), legal disclaimers, error states, loading states. Deploy to Replit. | MVP ready for beta |

## 12.2 Week 2: Enhancement & Launch

| Day | Tasks | Deliverable |
|--------|-------|---|
| **Day 8--9** | Admin dashboard: document management, manual re-ingest, basic analytics. Daily sync cron job setup via Replit Scheduled Deployments. | Admin panel at /admin |
| **Day 10** | Permit wizard: guided workflow for common permit scenarios (deck, fence, renovation). Decision tree logic. | Permit wizard for 3+ scenarios |
| **Day 11** | Feedback mechanism: thumbs up/down, optional comment. Multi-language UI toggle. | Feedback + language support |
| **Day 12** | Multi-tenant framework: extract Needham-specific config, create config schema, test with mock second town. | Config-driven multi-tenant |
| **Day 13** | Custom domain setup. Final QA. Load testing (100 concurrent). Accessibility re-audit. | Production-ready deployment |
| **Day 14** | Soft launch: share with 5--10 Needham residents. Monitor for errors. Fix critical issues. | Beta live with real users |

## 12.3 Risk Mitigation

**Risk 1: Poor Answer Quality (HIGH):** Strong system prompt, confidence scoring, mandatory source citations, golden test dataset run after every data change. Fallback: reduce to curated FAQ with AI search.

**Risk 2: PDF Ingestion Failures (MEDIUM):** Use pypdf for simple PDFs, LlamaParse for complex ones. Test with 10 most complex PDFs early. Fallback: manually create Markdown versions.

**Risk 3: Merge Conflicts (LOW):** File ownership in Section 11.2 is designed to eliminate conflicts. If a conflict occurs, the human operator resolves it manually before merging the next branch.

**Risk 4: Scope Creep (HIGH):** Week 1 features are the hard MVP line. If behind by Day 5, cut browse/search and ship chat-only MVP. A working chat with 80% accuracy on 200 docs is more valuable than a polished UI with broken answers.

---

# 13. Go-to-Market

## 13.1 Launch Plan

**Phase 1 — Private Beta (Days 14--21):** Share with 5--10 trusted Needham residents. Collect structured feedback via Google Form. Fix critical issues.

**Phase 2 — Community Launch (Days 21--28):** Post in Needham community Facebook groups, Nextdoor, and local email lists. Share on LinkedIn with PM portfolio framing. Reach out to Needham Channel.

**Phase 3 — Official Outreach (Days 28+):** Email Select Board members and Town Manager's office with demo link. Contact League of Women Voters Needham. Present at public meeting if invited.

## 13.2 Town Government Outreach

**Key Contacts:** Town Manager's Office ((781) 455-7500 ext. 71501), Select Board ((781) 455-7500 ext. 71204), Town Clerk (ext. 216).

**Positioning:** "Free community tool created by a Needham resident to make town information more accessible. Not affiliated with the town. All information sourced from public documents with citations. Seeking feedback from town staff on accuracy."

## 13.3 Portfolio Positioning

Frame at the intersection of three narratives: (1) **Product thinking** — identified user pain point, validated through research, built with clear metrics. (2) **AI/tech fluency** — built a production RAG app with embeddings, vector search, LLMs, prompt engineering. (3) **Entrepreneurial execution** — shipped working product in 2 weeks, designed as reusable SaaS framework, launched to real users.

---

# Appendix A: System Prompt

The following system prompt should be used for the GPT-4o Mini instance powering the chat. This also serves as the MVP content moderation layer:

> You are Needham Navigator, a helpful AI assistant that answers questions about the Town of Needham, Massachusetts. You have been trained on official town documents including zoning bylaws, permit requirements, department information, meeting minutes, and community resources.
>
> RULES: (1) Only answer based on the provided context documents. Never make up information. (2) Always cite your sources with document title, section, and date. (3) If you are not confident in an answer, say so clearly and direct the user to the appropriate town department with their phone number. (4) For property-specific zoning or permit questions, provide general information but always advise the user to verify with the Planning & Community Development Department at (781) 455-7550. (5) Never provide legal advice. State that all information is for reference only. (6) After each answer, suggest 2-3 relevant follow-up questions. (7) Be concise but complete. Aim for 2-4 paragraph responses. (8) Maintain a friendly, professional tone appropriate for a municipal service. (9) Do not engage with questions about topics outside of Needham town services. Politely redirect. (10) Do not generate inappropriate, offensive, or harmful content under any circumstances.
>
> DISCLAIMER to include in first message of every session: This tool uses AI and may provide inaccurate information. Always verify with official town sources before making decisions. This is not legal advice. Contact Town Hall: (781) 455-7500.

---

# Appendix B: Legal Disclaimers

## Homepage Disclaimer (Footer)

"Needham Navigator is an independent community tool and is not affiliated with, endorsed by, or operated by the Town of Needham. This tool uses artificial intelligence to answer questions based on publicly available town documents. AI-generated responses may contain errors or outdated information. Always verify important information with the relevant town department before making decisions. This tool does not provide legal, financial, or professional advice. For official town services, visit needhamma.gov or call (781) 455-7500."

## Terms of Service (Key Provisions)

Information provided "as is" with no warranties of accuracy or completeness. User assumes all risk for decisions made based on chatbot responses. Tool is for informational purposes only; not a substitute for professional or legal advice. No PII is collected or stored. Chat sessions are not logged or retained. The tool may be unavailable at times without notice.

## Privacy Policy (Key Provisions)

We do not collect personally identifiable information. Chat sessions are processed in memory and not stored. No cookies are set for tracking purposes. Anonymous usage analytics (page views, query counts) may be collected. No data is shared with third parties.
