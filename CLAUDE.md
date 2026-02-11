# CLAUDE.md - Needham Navigator

## User Preferences
- **Never ask the user to hand-key anything.** Always do the full implementation, integration, conflict resolution, testing, committing, and pushing yourself. The user expects autonomous execution.

## Project Overview
Needham Navigator is an AI-powered municipal information hub built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Supabase.

## Architecture
- Multi-tenant routing via `src/app/[town]/` dynamic segments
- Town configs defined in `config/towns.ts`
- Per-town theming with CSS variables (`src/lib/town-theme.ts` - must stay server-safe, no `"use client"`)
- Context providers: `TownProvider` (town config), `I18nProvider` (i18n)
- Icons: lucide-react
- Backend: Supabase PostgreSQL with RLS

## Key Commands
- `npx next build` — full build and static generation
- `npx next dev -p 3000` — dev server
- `npx tsc --noEmit` — type check only

## Conventions
- Components in `src/components/`
- All user-facing routes under `src/app/[town]/`
- Legacy `/chat` redirects to `/[town]/chat`
- API routes in `src/app/api/`
- Admin routes in `src/app/admin/`
- Do NOT modify ingestion scripts (`scripts/`) unless explicitly asked

## Key Decisions
- **Domain:** needhamnavigator.com (purchased on Squarespace)
- **Hosting:** Vercel (changed from Replit — cheaper for Next.js apps, better CI/CD)
- **Vision:** Beyond Q&A → full AI-driven local information hub / autonomous newspaper. Events, reviews, community news. Fully automated CI/CD.
- **Web Crawling:** Custom scraper (cheerio + @mozilla/readability + turndown) — replaces Firecrawl ($16/mo savings). Built specifically for municipal CivicPlus sites.
- **CI/CD:** GitHub Actions → Vercel deploy on push to main

## Merge-to-Main Checklist
Every time code is merged to `main`, complete these steps before pushing:

1. **Build passes** — run `npx next build` and confirm zero errors
2. **UI smoke test** — start the dev server and verify critical user flows work in the browser (at minimum: load the chat page, send a question, confirm a response appears)
3. **Update User Guide** — edit `docs/USER_GUIDE.md` to reflect any new or changed features
4. **Update Release Notes** — add a new version entry to `docs/RELEASE_NOTES.md` with:
   - Version number (bump minor for features, patch for fixes)
   - Date
   - Summary of what changed, grouped by New Features / Bug Fixes / Breaking Changes
5. **Commit docs with the merge** — include doc updates in the same commit or as a follow-up before pushing
