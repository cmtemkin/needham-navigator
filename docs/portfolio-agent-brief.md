# Needham Navigator — Parallel Feature Build Brief

> **Usage:** Pass this entire file as a prompt to a fresh Claude Code agent.
> It will orchestrate sub-agents to build all features in parallel on separate branches.
> Each feature is independent and will NOT conflict with the active `feature/search-quality-pipeline` branch.

---

## Context

You are working on **Needham Navigator**, a Next.js 14 (App Router) AI-powered municipal information hub. The codebase is at the current working directory. Read `CLAUDE.md` for conventions.

**Active work (DO NOT TOUCH):** The `feature/search-quality-pipeline` branch has in-flight changes to `src/lib/rag.ts`, `src/lib/pinecone.ts`, `src/app/api/search/route.ts`, `scripts/embed.ts`, `scripts/re-embed.ts`, `scripts/scraper-config.ts`, and `src/lib/connectors/runner.ts`. Do not modify these files.

**Your job:** Build 6 independent features in parallel using sub-agents. Each feature gets its own branch off `main`. Follow all conventions in `CLAUDE.md` (branch naming, pre-push checks, PR creation, no direct push to main).

---

## Feature 1: Events & Calendar Page

**Branch:** `feature/events-calendar`

**Goal:** Add a town events page that aggregates upcoming events from needhamma.gov.

**Tasks:**
1. Create `src/app/[town]/events/page.tsx` — server component that fetches events
2. Create `src/app/api/events/route.ts` — API route that queries Supabase `events` table (create if needed)
3. Create `supabase/migrations/YYYYMMDD_add_events_table.sql` — events table: id, town_id, title, description, date, time, location, source_url, created_at
4. Add "Events" link to the town nav bar in `src/app/[town]/layout.tsx`
5. Style with Tailwind, use lucide-react icons (Calendar, MapPin, Clock)
6. Add i18n translations for en/es/zh in `src/lib/i18n.tsx` for "Events", "Upcoming Events", "No upcoming events"
7. Run lint, tsc, build, test before pushing

**Key files to read first:** `src/app/[town]/layout.tsx`, `src/app/[town]/page.tsx` (for pattern), `src/lib/i18n.tsx`, `config/towns.ts`

---

## Feature 2: Community News Feed (RSS Aggregation)

**Branch:** `feature/community-news`

**Goal:** Aggregate local news from RSS feeds (Needham Times, Patch, etc.) into a news page.

**Tasks:**
1. Install `rss-parser` package
2. Create `src/lib/rss-feeds.ts` — config for RSS feed URLs per town (start with Needham: Patch Needham, Needham Times if available)
3. Create `src/app/api/news/route.ts` — fetches and merges RSS feeds, caches for 15 min
4. Create `src/app/[town]/news/page.tsx` — displays news articles with title, source, date, summary, link
5. Add "News" link to town nav bar in `src/app/[town]/layout.tsx`
6. Add i18n translations for "News", "Local News", "Read more"
7. Run lint, tsc, build, test before pushing

**Key files to read first:** `src/app/[town]/layout.tsx`, `src/app/[town]/page.tsx`, `src/lib/i18n.tsx`

---

## Feature 3: Mobile PWA Support

**Branch:** `feature/pwa-support`

**Goal:** Make the app installable as a PWA with offline fallback.

**Tasks:**
1. Install `next-pwa` (or `@ducanh2912/next-pwa` for Next.js 14 compatibility)
2. Create `public/manifest.json` — app name "Needham Navigator", theme color from town config, icons
3. Create `public/icons/` — Generate PNG icons at 192x192 and 512x512 (simple text-based or use existing branding)
4. Update `next.config.mjs` — add PWA plugin config (DO NOT remove existing `turbopack` or `rewrites` config)
5. Create `public/offline.html` — simple offline fallback page
6. Add `<link rel="manifest">` to `src/app/layout.tsx`
7. Add meta tags for mobile (viewport, theme-color, apple-mobile-web-app)
8. Run lint, tsc, build, test before pushing

**Key files to read first:** `next.config.mjs`, `src/app/layout.tsx`, `config/towns.ts`

---

## Feature 4: Chat UX Improvements

**Branch:** `feature/chat-ux`

**Goal:** Add conversation history, follow-up suggestions, and share functionality to the chat page.

**Tasks:**
1. Add conversation history to localStorage — save last 20 conversations per town with timestamps
2. Create `src/components/ChatHistory.tsx` — sidebar/drawer showing past conversations, click to restore
3. Add follow-up suggestion chips — after AI responds, show 3 related question suggestions (generated from the AI response or hardcoded based on topic)
4. Add "Share" button — copies the current Q&A to clipboard as formatted text
5. Add "New Chat" button to clear current conversation
6. Update `src/app/[town]/chat/page.tsx` to integrate these components
7. Add i18n translations for "History", "New Chat", "Share", "Copied!", "Suggested questions"
8. Run lint, tsc, build, test before pushing

**Key files to read first:** `src/app/[town]/chat/page.tsx`, `src/app/api/chat/route.ts`, `src/lib/i18n.tsx`

---

## Feature 5: Admin Dashboard Enhancements

**Branch:** `feature/admin-dashboard-v2`

**Goal:** Add content quality metrics and search analytics to the admin dashboard.

**Tasks:**
1. Create `src/app/admin/analytics/page.tsx` — search analytics page showing:
   - Top 20 search queries (from `search_logs` or analytics events)
   - Average response time
   - Queries with zero results
2. Create `src/app/admin/content/page.tsx` — content quality page showing:
   - Document count by `relevance_tier` (primary, regional, state, etc.)
   - Documents by domain (top 20)
   - Stale documents (not verified in 90+ days)
   - Chunk count distribution
3. Create `src/app/api/admin/stats/route.ts` — API endpoint that queries Supabase for the above metrics
4. Add navigation links in `src/app/admin/layout.tsx` for "Analytics" and "Content Quality"
5. Use simple charts (bar charts with Tailwind, no heavy charting library needed)
6. Run lint, tsc, build, test before pushing

**Key files to read first:** `src/app/admin/page.tsx`, `src/app/admin/layout.tsx`, any existing admin API routes

---

## Feature 6: Saved Searches & Bookmarks (User Preferences)

**Branch:** `feature/saved-searches`

**Goal:** Let users save favorite searches and bookmark answers (localStorage-based, no auth required).

**Tasks:**
1. Create `src/lib/saved-items.ts` — localStorage utility for saving/loading bookmarks and saved searches
2. Create `src/components/SaveButton.tsx` — bookmark icon button (Heart or Bookmark from lucide-react) that toggles save state
3. Create `src/app/[town]/saved/page.tsx` — page showing saved searches and bookmarked answers with delete capability
4. Add SaveButton to search results in `src/app/[town]/chat/page.tsx` (next to each AI answer)
5. Add "Saved" link to town nav bar in `src/app/[town]/layout.tsx`
6. Add i18n translations for "Saved", "No saved items", "Remove", "Save this answer"
7. Run lint, tsc, build, test before pushing

**Key files to read first:** `src/app/[town]/chat/page.tsx`, `src/app/[town]/layout.tsx`, `src/lib/i18n.tsx`

---

## Orchestration Instructions

1. **Start from main:** `git checkout main && git pull origin main`
2. **Launch all 6 features as parallel sub-agents** using the Task tool. Each sub-agent should:
   - Create its own branch from main
   - Implement the feature following the tasks above
   - Run `npm run lint && npx tsc --noEmit && npm run build && npm test` before pushing
   - Push the branch and create a PR with `gh pr create`
3. **Do NOT merge PRs** — let CI auto-merge if it passes
4. **If a sub-agent fails**, debug and fix on its branch
5. **Report back** with the list of PRs created and their status

**Critical rules:**
- Each branch must be created from `main`, not from each other
- Do not modify files listed in the "DO NOT TOUCH" section above
- Follow all conventions in `CLAUDE.md`
- Each PR should be self-contained and independently mergeable
