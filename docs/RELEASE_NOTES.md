# Release Notes

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
