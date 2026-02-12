# Needham Navigator — User Guide

Needham Navigator is an AI-powered municipal information hub that helps residents find answers about town services, permits, zoning, schools, and more.

---

## Getting Started

Visit your town's Navigator page:

| Town | URL |
|------|-----|
| Needham, MA | `/needham` |
| Mock Town, MA (demo) | `/mock-town` |

The home page shows popular questions, life-situation tiles, and department contacts. Click any tile or question to start a conversation.

---

## Features

### AI Chat

Navigate to **Ask a Question** from the header or visit `/<town>/chat`.

- Type any question about town services, permits, zoning, schools, or departments
- **Use everyday language** — say "the dump" instead of "Transfer Station", "who do I call about a rat" instead of "Board of Health contact" — the AI understands informal phrasing and expands your query automatically
- The AI responds conversationally with sourced answers, confidence levels, and follow-up suggestions
- **Clickable sources** — each response shows source pills linking directly to official town pages
- **Clickable phone numbers** — phone numbers in answers are tap-to-call on mobile
- **Confidence levels** — "Verified from official sources" (green), "Based on town documents" (yellow), or "Limited information" (orange) helps you know when to verify
- Click a follow-up suggestion to continue the conversation
- **Feedback**: Every AI response has thumbs up/down buttons — your feedback helps improve answers. You can optionally add a comment.

### Permit Wizard

Navigate to **Permits** from the header or visit `/<town>/permits`.

A guided step-by-step tool that tells you exactly which permits, fees, and documents you need for common home projects:

| Project Type | What It Covers |
|---|---|
| **Build a Deck** | Attached/detached, size, height — determines building permit, zoning review |
| **Install a Fence** | Height, location, material — flags zoning board requirements for tall/front fences |
| **Home Renovation** | Kitchen/bath/other, structural changes, electrical/plumbing — identifies all required permits |
| **Build an Addition** | Size, stories, foundation — comprehensive permit list including conservation review |

**How to use it:**
1. Select your project type
2. Answer 3 questions about your specific situation
3. Get a personalized summary with:
   - Required permits
   - Estimated fees
   - Documents to prepare
   - Expected timeline
   - Department contact info
   - Helpful tips
4. Click **Ask Navigator for More Details** to continue in chat

### Multi-Language Support

Click the language toggle (globe icon) in the header to switch between:
- English
- Spanish (Espanol)
- Chinese (中文)

All navigation, labels, and system text are translated. AI chat responses are currently in English.

### Local News Feed

Navigate to **News** from the header or visit `/<town>/news`.

A real-time aggregated feed of local news from multiple sources:

| Source | Description |
|--------|-------------|
| **Needham Patch** | Hyperlocal news and community stories |
| **Needham Observer** | In-depth local reporting |
| **Needham Local** | Community-focused coverage and video |
| **Town of Needham** | Official town government RSS updates |

**Features:**
- Filter by source using filter chips at the top
- Each article shows source badge, publish time (relative), summary, and link to full article
- "Load more" pagination for browsing older articles
- Content is automatically refreshed via the ingestion pipeline

### Department Directory

The home page lists key town departments with phone numbers. Click any department to ask the AI about their services.

---

## Admin Dashboard

Visit `/admin` to access:

- **Analytics** — feedback trends, query volume, response quality metrics
- **System Logs** — ingestion status, error tracking, sync history
- **Document Management** — view indexed content and sources

---

## Developer / Data Quality Tools

### Data Validation

Run `npm run validate` to check ingestion data quality:

```bash
npm run validate [town_id]
```

**What it validates:**
- ✓ All chunks have required metadata (document_title, document_type, document_url, chunk_type, etc.)
- ✓ No duplicate chunks (same content_hash)
- ✓ Embedding dimensions are correct (1536 for text-embedding-3-small)
- ✓ No orphaned chunks (document_id references non-existent documents)
- ✓ Coverage report showing chunk count per department

**Sample output:**
```
=== INGESTION VALIDATION REPORT ===
Town: needham
Total Documents: 215
Total Chunks: 1,847
Avg Chunks/Document: 8.6

Document Types:
  zoning_bylaws        324
  general_bylaws       198
  building_permits     145
  ...

Department Coverage:
  Planning & Community Development    487 chunks
  Department of Public Works          234 chunks
  ...

✅ Validation PASSED
```

### Enhanced Ingestion Pipeline

**Custom Web Scraper** (`scripts/scraper.ts`)

The scraper is purpose-built for CivicPlus municipal sites (zero external API cost):
- Built on cheerio + @mozilla/readability + turndown
- Parallel page fetching with rate limiting
- Content-hash change detection for incremental scraping
- Configurable via `scripts/scraper-config.ts`

**Crawling** (`npm run crawl`)
- `npm run crawl --sources` — Crawl all 40+ data sources from registry
- `npm run crawl --high-priority` — Crawl only high-priority sources (priority 4-5)
- `npm run crawl --map` — Discover all URLs on site

**Smoke Test** (`scripts/smoke-test.ts`)
- Quick validation: `npx ts-node scripts/smoke-test.ts`
- Verifies the scraper can reach the site, fetch pages, and extract content

**Re-ingestion** (`scripts/reingest-clean.ts`)
- One-command full data refresh: scrape → chunk → embed → upsert
- Run after scraper changes or when a full re-crawl is needed

**Monitoring** (`npm run monitor`)

Daily change detection with content-hash comparison:
- Tracks `last_crawled` (every check) and `last_changed` (only when content changes)
- 0% false positives (vs. ~50% with HTTP HEAD)
- Flags stale documents (>90 days since last verification)
- Queues changed documents for re-ingestion

**Data Quality Features:**
- Exact token counting with js-tiktoken (100% accuracy)
- Heuristic-based PDF complexity detection
- Parallel PDF extraction (3 concurrent by default)
- Extraction validation (flags multi-page PDFs with <100 chars)
- Enhanced metadata: chunk_index, total_chunks, content_hash

---

## Navigation

| Page | URL | Description |
|------|-----|-------------|
| Home | `/<town>` | Landing page with quick links |
| Chat | `/<town>/chat` | AI-powered Q&A |
| News | `/<town>/news` | Aggregated local news feed |
| Permits | `/<town>/permits` | Permit wizard |
| Admin | `/admin` | Dashboard (not town-scoped) |

Legacy URLs like `/chat` automatically redirect to the default town.

---

## Tips

- **Use everyday language** — Say "the dump", "cops", "can I build a deck" — the AI understands slang and informal phrasing, and automatically expands your search to find the right town info
- **Be specific** — "What permits do I need for a 6-foot fence on my property line?" gets better answers than "fence permit"
- **Use the Permit Wizard first** — it gives you a structured checklist, then you can ask follow-ups in chat
- **Check confidence levels** — green ("Verified") means strong source matches; orange ("Limited info") means you should call the department directly
- **Click source pills** — each answer includes clickable links to the official town pages the answer was based on
- **Always verify** — This is an AI tool. For official decisions, contact the relevant department directly using the phone numbers provided.
