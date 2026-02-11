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
- The AI responds with sourced answers, confidence levels, and follow-up suggestions
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

**Comprehensive Crawling** (`npm run crawl`)

New CLI options for production-grade crawling:
- `npm run crawl --sources` — Crawl all 40+ data sources from registry
- `npm run crawl --high-priority` — Crawl only high-priority sources (priority 4-5)
- `npm run crawl --map` — Discover all URLs on site

**Features:**
- Incremental crawling (skips unchanged documents via content-hash)
- Retry logic with exponential backoff (3 attempts)
- 40+ source URL registry in `config/crawl-sources.ts`
- Priority-based processing (1=low, 5=high)

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
| Permits | `/<town>/permits` | Permit wizard |
| Admin | `/admin` | Dashboard (not town-scoped) |

Legacy URLs like `/chat` automatically redirect to the default town.

---

## Tips

- **Use everyday language** — You can say "the dump" instead of "Transfer Station" or "who do I call about a rat" instead of "Board of Health contact" — the AI understands informal phrasing
- **Be specific** — "What permits do I need for a 6-foot fence on my property line?" gets better answers than "fence permit"
- **Use the Permit Wizard first** — it gives you a structured checklist, then you can ask follow-ups in chat
- **Check confidence levels** — high confidence means strong source matches; low confidence means you should verify with the town directly
- **Always verify** — This is an AI tool. For official decisions, contact the relevant department directly using the phone numbers provided.
