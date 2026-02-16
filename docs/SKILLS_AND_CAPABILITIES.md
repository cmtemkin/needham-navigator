# Needham Navigator — Skills & Capabilities Record

**Author:** Charlie Temkin
**Project:** [Needham Navigator](https://needhamnavigator.com) — AI-powered municipal information hub for Needham, MA
**Repository:** [github.com/cmtemkin/needham-navigator](https://github.com/cmtemkin/needham-navigator)
**License:** MIT | **Current Version:** v0.8.9 | **Last Updated:** February 14, 2026

---

## Project Summary

Needham Navigator is a full-stack AI application that transforms how residents interact with local government information. Citizens ask natural-language questions about town services, permits, zoning, schools, and more—and receive accurate, sourced answers backed by official municipal data. The system autonomously scrapes, processes, and maintains an up-to-date knowledge base from official town websites, with automated content monitoring and quality evaluation.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **Backend / Database** | Supabase (PostgreSQL + pgvector), Row-Level Security |
| **AI / ML** | OpenAI GPT-5 Nano (chat), text-embedding-3-large (embeddings), Vercel AI SDK v6 |
| **Search** | Hybrid retrieval: pgvector cosine similarity + PostgreSQL full-text search |
| **Web Scraping** | Custom scraper (Cheerio + Mozilla Readability + Turndown) |
| **Hosting** | Vercel (frontend + serverless API routes) |
| **CI/CD** | GitHub Actions → auto-merge → Vercel deploy |
| **Analytics** | Pendo (anonymous behavioral tracking, zero PII) |
| **Domain** | needhamnavigator.com (Squarespace DNS → Vercel) |

---

## Architecture & Design Skills

### RAG (Retrieval-Augmented Generation) Pipeline
End-to-end RAG pipeline built from scratch:

1. **Scrape** — Custom web scraper crawls CivicPlus municipal sites, extracting clean Markdown from HTML
2. **Chunk** — Documents split into semantically meaningful pieces with exact token counting (js-tiktoken)
3. **Embed** — Chunks converted to 1536-dimensional vectors via OpenAI text-embedding-3-large
4. **Store** — Vectors + metadata stored in Supabase PostgreSQL with pgvector HNSW indexing
5. **Hybrid Search** — Parallel semantic search (pgvector cosine similarity) and keyword search (PostgreSQL FTS)
6. **Multi-Factor Reranking** — Scored by: semantic similarity (60%), keyword overlap (20%), recency (10%), authority (10%), plus department boost
7. **Generate** — Top-ranked chunks passed to GPT-5 Nano with a carefully engineered system prompt

### Multi-Tenant Architecture
- Dynamic `[town]` routing — all pages scoped per town
- Town configuration system: brand colors, departments, feature flags, contacts
- Per-town CSS theming via CSS custom properties
- Town-scoped Row-Level Security policies in Supabase
- Designed to support multiple Massachusetts towns from a single codebase

### Dual UI Skins
- **Classic mode:** Chat-first interface (conversational Q&A)
- **Search mode:** Search-first interface with instant results, AI answers, topic browsing
- Configurable via `uiMode` feature flag per town
- Floating chat panel available in search mode

---

## Feature Inventory

### AI Chat System
- Streaming AI responses via Server-Sent Events (SSE)
- Conversational personality — friendly town clerk tone
- Smart query expansion with synonym dictionary (30+ universal + 9 town-specific entries)
- Intent detection ("when is X open?" → adds schedule/hours keywords)
- Confidence scoring with verification badges (High / Medium / Low)
- Source citations with clickable links to official documents
- Follow-up question suggestions
- Markdown rendering in responses
- Answer caching for instant responses on repeated questions

### Search & Discovery
- Semantic + keyword hybrid search
- Browse by topic cards
- Popular question suggestions
- Department chips for category filtering
- Similarity score display on results
- "Ask about this" integration between search and chat

### Permit Wizard
- Guided step-by-step workflow for 4 project types: deck, fence, renovation, addition
- Decision tree with 3 targeted questions per project type
- Generates personalized permit summary: required permits, fees, documents, timeline, contacts, tips
- "Ask Navigator for More Details" links to pre-filled chat

### Local News Aggregation
- Pluggable connector framework for data sources (RSS, iCal, web scraping)
- 3 news sources integrated (Needham Patch, Observer, Local)
- Article filtering by source, pagination, relative timestamps
- AI-powered article summarization (2-sentence summaries via GPT)
- Feature-flag gated per town

### Admin Dashboard (`/admin`)
- Real-time analytics: feedback trends, query volume, response quality
- OpenAI cost tracking: daily/weekly/monthly spend, projected costs, cost-per-query
- Model selector: swap chat model (GPT-5 Nano, GPT-5 Mini, GPT-4o Mini, GPT-4.1 Mini) without redeploying
- System logs viewer with filtering
- Ingestion status and structured logging

### Internationalization (i18n)
- 3 languages: English, Spanish, Chinese
- Language toggle with localStorage persistence
- Browser language auto-detection
- All UI strings translated including permit wizard

### User Feedback System
- Thumbs up/down on every AI response
- Optional comment field (up to 2,000 chars)
- Session tracking and visual state management
- Posts to feedback API with town scoping

---

## Data Engineering Skills

### Custom Web Scraper
- Zero-cost replacement for Firecrawl ($16/mo savings)
- Purpose-built for CivicPlus municipal site platform
- Parallel page fetching with configurable concurrency and rate limiting
- Content-hash based change detection for incremental scraping
- Boilerplate removal (15 patterns of CivicPlus CMS chrome stripped)
- PDF link discovery and extraction

### Content Ingestion Pipeline
- Centralized URL registry with 40+ sources, priority-based crawling
- Incremental crawling with content-hash comparison (skips unchanged docs)
- Retry logic with exponential backoff (3 attempts)
- Exact token counting (js-tiktoken — same tokenizer as OpenAI models)
- Recursive chunk splitting (paragraphs → newlines → sentences → hard token split)
- Enhanced metadata: chunk_index, total_chunks, content_hash, department

### PDF Processing
- Heuristic-based complexity detection (scanned vs. tables vs. standard)
- Parallel processing with configurable concurrency
- Extraction validation and quality warnings

### Automated Content Monitoring
- Vercel cron job runs daily at 6:00 AM UTC
- Detects content-hash changes on municipal pages
- RSS feed monitoring for new pages
- Flags stale documents (not verified in 90+ days)
- Automated re-ingestion of changed content

### Data Quality Validation (`npm run validate`)
- Required metadata field verification
- Duplicate chunk detection via content_hash
- Embedding dimension verification (all 1536-d)
- Department coverage gaps (departments with <3 chunks)
- Orphaned chunk detection
- Documents without chunks report

---

## Quality Assurance

### RAG Evaluation Framework
- **73-question golden test dataset** across 14 categories
- Questions verified against official needhamma.gov sources
- 3 difficulty levels (Easy, Medium, Hard)
- 5 persona contexts (New Resident, Concerned Citizen, Homeowner, Real Estate Agent, Small Business Owner)
- Automated eval pipeline: `npm run eval` → `npm run eval:scorecard`
- Scorecard output: overall score, category breakdowns, difficulty analysis, response time stats, improvement recommendations

### Testing
- Jest unit tests (`__tests__/` — 7 test files)
- Integration tests covering API health, chat, search, feedback, admin auth, error handling, confidence scoring, source citations, legal disclaimers
- TypeScript strict type checking (`npx tsc --noEmit`)
- ESLint linting

### Data Quality Results (v0.7.1)
- 500 pages scraped (152% increase over previous scraper)
- 2,068 chunks ingested (102% increase)
- Zero boilerplate across all pages
- 9 of 10 test questions returned meaningful answers
- 6 High confidence, 3 Medium confidence results

---

## DevOps & Infrastructure

### CI/CD Pipeline
- GitHub Actions: build → test → auto-merge → Vercel deploy
- Branch protection enforced on `main` (require PR + status checks)
- Pre-push verification loop: build + test + typecheck must all pass
- Mandatory local preview checkpoint before pushing

### SEO
- Dynamic `robots.txt` and `sitemap.xml` generation
- Open Graph and Twitter meta tags for social sharing
- Semantic HTML with proper heading hierarchy
- Branded 404 page

### Cost Management
- Automatic API cost logging (token usage + estimated USD per call)
- Fire-and-forget pattern — cost tracking never affects response latency
- Model pricing constants for easy updates
- Admin dashboard with spend projections

### Analytics (Pendo)
- Behavioral tracking: searches, chat messages, feedback, topic clicks, source clicks
- Anonymous visitor IDs (zero PII)
- Graceful degradation when API key is missing

---

## Project Scale

| Metric | Value |
|---|---|
| **Version** | v0.8.9 (30+ releases) |
| **Knowledge base** | 500 documents, 2,068 chunks |
| **News articles** | 40 articles from 3 local sources |
| **Golden test questions** | 73 across 14 categories |
| **Supported languages** | 3 (English, Spanish, Chinese) |
| **API routes** | 15+ endpoints |
| **React components** | 24 |
| **Database migrations** | 4 |
| **npm scripts** | 12 custom scripts |

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| Custom scraper over Firecrawl | $16/mo savings, better control over CivicPlus extraction |
| pgvector over Pinecone | Unified with Supabase — no separate vector DB bill |
| GPT-5 Nano over GPT-4o Mini | 3x cheaper ($0.05 vs $0.15/M input), 400K context |
| text-embedding-3-large over small | Correctly respects `dimensions: 1536` parameter |
| Vercel over Replit hosting | Cheaper for Next.js, better CI/CD integration |
| Hybrid search over vector-only | Combines semantic understanding with keyword precision |
| Content-hash over HTTP HEAD | 0% false positives vs ~50% with HEAD method |
| js-tiktoken over char/4 | Exact token counting vs ±25% approximation |

---

## Development Speed — AI-Assisted vs. Traditional

### Actual Build Time (AI-Assisted)
This application was built from zero to v0.8.9 in **~6 calendar days** (February 9–14, 2026), across 30+ releases.

### Estimated Traditional Build Time
A **senior full-stack engineer** working full-time without AI assistance would take an estimated **3–4 months** (~60–75 working days) to build this application to the same level of completeness and polish.

| Component | Estimated Traditional Time |
|---|---|
| Project setup & infra (Next.js, Supabase, CI/CD, Vercel) | 3–4 days |
| Custom web scraper (Cheerio + Readability + Turndown) | 4–5 days |
| Ingestion pipeline (crawl → chunk → embed → upsert) | 5–7 days |
| RAG retrieval engine (hybrid search + reranking + tuning) | 7–10 days |
| Chat API + streaming UI (SSE, prompt engineering, citations) | 5–6 days |
| Search-first UI skin + floating chat panel | 4–5 days |
| Multi-tenant architecture (routing, configs, theming, RLS) | 3–4 days |
| Permit wizard (decision tree, 4 project types) | 3–4 days |
| News / connector framework (RSS, content normalization) | 4–5 days |
| Admin dashboard (analytics, cost tracking, model selector) | 4–5 days |
| Internationalization (3 languages) | 2–3 days |
| Content monitoring & cron jobs | 2–3 days |
| Eval framework (73-question golden dataset + scorecard) | 3–4 days |
| Testing suite (unit + integration) | 3–4 days |
| SEO, analytics, feedback, caching | 3–4 days |
| Polish, bug fixes, edge cases | 5–7 days |
| **Total** | **~60–75 working days (3–4 months)** |

### Speedup Factor: ~12–15x

The hardest parts to replicate traditionally aren't code volume — they're the **experimentation loops**: tuning retrieval quality, perfecting system prompts, finding optimal chunk sizes, and debugging why the AI gives bad answers for specific question types. These feedback loops compress dramatically with AI-assisted development.

A **mid-level engineer** would likely need **5–6 months** due to additional research overhead on RAG architecture, pgvector, CivicPlus site quirks, and prompt engineering patterns.

---

*Generated February 14, 2026*
