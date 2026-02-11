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
