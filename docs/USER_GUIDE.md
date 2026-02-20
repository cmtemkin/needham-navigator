# Needham Navigator — User Guide

Needham Navigator is an AI-powered municipal information hub that helps residents find answers about town services, permits, zoning, schools, and more.

---

## Getting Started

Visit your town's Navigator page:

| Town | URL |
|------|-----|
| Needham, MA | `/needham` |
| Mock Town, MA (demo) | `/mock-town` |

The home page shows a daily brief, latest news (AI articles + local news), topic cards, and popular questions. Click any tile or question to start a conversation.

### UI Modes

Needham Navigator supports two interface styles (configured via `uiMode` in town settings):

**Classic Mode (default)** — Chat-first interface with conversational AI as the primary feature. Great for exploratory questions and interactive conversations.

**Search Mode** — Search-first interface optimized for quick lookup and document discovery:
- Large search bar with instant results from town documents
- AI-generated answers appear above search results (cached answers show instantly with a green "Instant" badge)
- Floating chat button in bottom-right corner for follow-up questions
- "Ask about this" buttons on search results open the chat with context
- Browse by topic cards and popular questions for discovery
- **"Right Now in Needham" live widgets** — compact cards showing current weather (NWS), next commuter rail departure (MBTA), and community safety status, each linking to their full page

Both modes access the same underlying data and provide the same quality answers — choose based on your preferred interaction style.

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

Click the language toggle (globe icon) in the footer to switch between:
- English
- Spanish (Espanol)
- Chinese (中文)

All navigation, labels, and system text are translated. AI chat responses are currently in English.

### News

Navigate to **News** from the header or visit `/<town>/articles`.

A unified feed combining AI-generated articles and external local news in a single timeline, sorted by date. Every AI article is grounded in real documents from official town sources. External news links directly to the original source.

**Content types in the feed:**
| Badge | Meaning |
|-------|---------|
| **AI Generated** | Full article written by AI from public records and meeting minutes |
| **AI Summary** | AI-condensed summary of an external article or document |
| **Needham Patch** / **Observer** / **Needham Local** / **Town of Needham** | External news from local sources (links to original article) |

**Features:**
- **Source filter** — filter by All Sources, AI Articles, Patch, Observer, Needham Local, or Town of Needham
- **Category filter** — filter by Town Government, Schools, Public Safety, Community, Permits & Development, Business, or News
- Unified feed shows both AI articles (click to read on-site) and external news (click to read at source)
- Each AI article page shows: formatted content with headers and bullets, source type badge, clickable source links to official documents, AI disclaimer, thumbs up/down feedback, and an "Ask about this" button that opens chat pre-loaded with the article title
- Articles are generated automatically each morning at 5 AM from newly ingested town documents
- External news from Needham Patch, Needham Observer, and Needham Local is scraped daily and displayed alongside AI content
- **Geographic filtering** — content from other states or distant cities is automatically filtered out. Government/school content is Needham-only; events/dining/community content includes the broader Boston metro area.
- All content appears in RAG-powered search and chat, with a locality boost for Needham-specific results

### Daily Brief

Navigate to **Daily Brief** from the home page banner or visit `/<town>/daily-brief`.

A daily AI-generated digest of the most important Needham news and updates, with inline citations linking each item to its official source. When a brief is available for today it appears as a banner on the home page.

**Features:**
- Today's brief rendered with full markdown formatting and inline source citations
- Sources section at the bottom listing all official documents referenced
- Collapsible accordion of up to 7 previous briefs
- Brief is generated daily at 5 AM ET; "Check back after 5 AM" shown when not yet available

### Events

Navigate to **More → Events** or visit `/<town>/events`.

Community events, town meetings, and activities pulled from calendar feeds. Each event shows the date, time, location, and a link to details. When no events are available yet, you can ask Navigator about upcoming events.

### Weather

Navigate to **More → Weather** or visit `/<town>/weather`.

Live weather conditions and 7-day forecast from the National Weather Service (weather.gov). Shows current temperature, wind speed, humidity, and detailed forecast periods with official NWS icons. Data updates automatically from the NWS API using the town's geographic coordinates.

### Safety

Navigate to **More → Safety** or visit `/<town>/safety`.

Emergency contacts and public safety resources:
- **911 emergency banner** prominently displayed
- **Quick-dial cards** for Police and Fire departments (auto-detected from town config)
- **Safety updates** from the content feed as they're added

### Transit

Navigate to **More → Transit** or visit `/<town>/transit`.

Live MBTA schedules and alerts for the town's commuter rail line (configured via `transit_route` in town settings):
- **Service alerts** with descriptions
- **Upcoming departures** with stop names, direction, and times
- Link to full schedule on MBTA.com

### Dining

Navigate to **More → Dining** or visit `/<town>/dining`.

Local restaurant and eatery listings as they're added to the content feed. Each listing shows the name, address, hours, and a link to the restaurant. Ask Navigator for recommendations in the meantime.

### Zoning

Navigate to **More → Zoning** or visit `/<town>/zoning-map`.

Zoning district information and land use resources:
- **Interactive map** (when Google Maps API key is configured)
- **Quick-lookup cards** for common zoning topics — click any card to ask Navigator about setbacks, permitted uses, dimensional requirements, or zoning by-laws
- Link to the town's official zoning map

### Department Directory

The home page lists key town departments with phone numbers. Click any department to ask the AI about their services.

---

## Admin Dashboard

Visit `/admin` to access:

- **Analytics** — feedback trends, query volume, response quality metrics
- **Costs** — OpenAI API spend monitoring: today/week/month totals, projected monthly cost, daily cost chart (last 30 days), cost-by-model breakdown, average cost per query
- **System Logs** — ingestion status, error tracking, sync history
- **Document Management** — view indexed content and sources
- **Settings** — configure the AI chat model (GPT-5 Nano, GPT-5 Mini, GPT-4o Mini, GPT-4.1 Mini) with pricing info; changes take effect immediately

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
- ✓ Embedding dimensions are correct (1536 for text-embedding-3-large, stored in Pinecone)
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
| News | `/<town>/articles` | Unified news feed (AI articles + local news) |
| Permits & Zoning | `/<town>/permits` | Permit wizard + zoning info |
| Events | `/<town>/events` | Community events calendar |
| Weather | `/<town>/weather` | Live NWS weather & forecast |
| Safety | `/<town>/safety` | Emergency contacts & updates |
| Transit | `/<town>/transit` | MBTA schedules & alerts |
| Dining | `/<town>/dining` | Local restaurant listings |
| Zoning | `/<town>/zoning-map` | Zoning info & map |
| Admin | `/admin` | Dashboard (not town-scoped) |

Legacy URLs like `/chat` automatically redirect to the default town.

---

## SEO & Discoverability

The site includes standard SEO features that work automatically:

- **robots.txt** — tells search engines what to crawl (blocks admin and API routes)
- **sitemap.xml** — lists all public pages for Google and other crawlers, auto-generated from town configs
- **Open Graph / Twitter cards** — when the site link is shared on social media, it shows a proper title and description instead of a blank preview
- **Branded 404 page** — visiting a bad URL shows a helpful "Page not found" page with a link back to the homepage

---

## Tips

- **Use everyday language** — Say "the dump", "cops", "can I build a deck" — the AI understands slang and informal phrasing, and automatically expands your search to find the right town info
- **Be specific** — "What permits do I need for a 6-foot fence on my property line?" gets better answers than "fence permit"
- **Use the Permit Wizard first** — it gives you a structured checklist, then you can ask follow-ups in chat
- **Check confidence levels** — green ("Verified") means strong source matches; orange ("Limited info") means you should call the department directly
- **Click source pills** — each answer includes clickable links to the official town pages the answer was based on
- **Always verify** — This is an AI tool. For official decisions, contact the relevant department directly using the phone numbers provided.
