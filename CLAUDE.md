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
- `npx next build` - full build and static generation
- `npx next dev -p 3000` - dev server
- `npx tsc --noEmit` - type check only

## Conventions
- Components in `src/components/`
- All user-facing routes under `src/app/[town]/`
- Legacy `/chat` redirects to `/[town]/chat`
- API routes in `src/app/api/`
- Admin routes in `src/app/admin/`
- Do NOT modify ingestion scripts (`scripts/`) unless explicitly asked

## Key Decisions
- **Domain:** needhamnavigator.com (purchased on Squarespace)
- **Hosting:** Vercel (changed from Replit - cheaper for Next.js apps, better CI/CD)
- **Vision:** Beyond Q&A - full AI-driven local information hub / autonomous newspaper. Events, reviews, community news. Fully automated CI/CD.
- **Web Crawling:** Custom scraper (cheerio + @mozilla/readability + turndown) - replaces Firecrawl ($16/mo savings). Built specifically for municipal CivicPlus sites. Entry points: `scripts/scraper.ts` (core), `scripts/scraper-config.ts` (config), `scripts/reingest-clean.ts` (full refresh), `scripts/smoke-test.ts` (validation). FIRECRAWL_API_KEY no longer needed.
- **CI/CD:** GitHub Actions - Vercel deploy on push to main

## Merge-to-Main Checklist

Every time code is merged to `main`, complete these steps before pushing:

1. **Build passes** - run `npx next build` and confirm zero errors
2. **UI smoke test** - start the dev server and verify critical user flows work in the browser (at minimum: load the chat page, send a question, confirm a response appears)
3. **Update User Guide** - edit `docs/USER_GUIDE.md` to reflect any new or changed features
4. **Update Release Notes** - add a new version entry to `docs/RELEASE_NOTES.md` with:
   - Version number (bump minor for features, patch for fixes)
   - Date
   - Summary of what changed, grouped by New Features / Bug Fixes / Breaking Changes
5. **Commit docs with the merge** - include doc updates in the same commit or as a follow-up before pushing

## CI/CD Rules for All Agents

**CRITICAL - All agents MUST follow these rules:**

1. **NEVER push directly to main** - main is protected, direct pushes will be rejected
2. **ALWAYS create a feature branch** - `git checkout -b feature/your-feature-name`
3. **Push your branch and create a PR** - `git push origin feature/your-feature-name && gh pr create --fill`
4. **NEVER merge your own PR** - GitHub Actions will auto-merge if CI passes
5. **If CI fails, fix the errors on your branch and push again** - CI will re-run automatically
6. **Keep PRs focused** - one feature or fix per PR, not everything at once
7. **Write clear commit messages** - describe what changed and why
8. **Before starting any new work**, check for open issues labeled `ci-failure` or `prod-down`:
   `gh issue list --label ci-failure --label prod-down --state open`
   If any exist, **fix those first** before starting new features

## Pre-Push Verification Loop (MANDATORY - DO NOT SKIP)

Before pushing ANY code to your branch, you MUST complete this loop. This is non-negotiable.

**Step 1: Run all three checks**
```
npm run build
npm test
npx tsc --noEmit
```

**Step 2: If ANY check fails**
1. Read the full error output carefully
2. Fix every error in your code
3. Go back to Step 1 and re-run ALL three checks
4. Repeat this loop until all three pass with zero errors

**Step 3: Local Preview Checkpoint (MANDATORY)**

After all checks pass, you MUST let the user preview before pushing:
1. Start the dev server: `npx next dev -p 3000`
2. Tell the user: "All checks pass. Preview your changes at http://localhost:3000/needham - let me know if it looks good or if you want changes."
3. **Include a specific change summary** listing every file changed, what was modified (before → after), and why. The user should know exactly what to look for when previewing.
4. **STOP and WAIT** for the user to respond.
4. If the user requests changes, make them and go back to Step 1.
5. Only proceed to Step 4 after the user explicitly approves.

**Step 4: Only after user approval, push your code**
```
git add <changed-files>
git commit -m "type: description of change"
git push -u origin <branch-name>
```

**Step 5: Create the PR**
```
gh pr create --title "type: description" --body "Summary of changes"
```

**YOU are the primary gate. The CI pipeline is a safety net, not the first line of defense. If you push code that fails CI, you have failed. Fix it locally first. If you push code the user hasn't approved, you have also failed.**

## Agent Preflight Checklist (MANDATORY)

Every agent session MUST start with these steps before writing any new code:

1. Check for open issues: `gh issue list --label ci-failure --label prod-down --state open`
2. Verify build health: `git checkout main && git pull origin main && npm ci && npm run build`
3. Check in-flight work: `gh pr list --state open`
4. If anything is broken, fix it FIRST - create a `fix/` branch, push, and create a PR
5. Only after everything is green should you start new feature work

Branch naming: `feature/<name>`, `fix/<name>`, `setup/<name>`, `data/<name>`

## Vercel Cron Jobs
- **Daily Monitor** (`/api/cron/monitor`): Runs at 6:00 AM UTC (1:00 AM Eastern) via `vercel.json`
  - Checks tracked needhamma.gov pages for content-hash changes
  - Monitors RSS feed for new pages
  - Flags documents not verified in 90+ days as stale
  - Logs results to `ingestion_log` table with `triggered_by: "vercel-cron"`
  - Secured by `CRON_SECRET` Bearer token (set in Vercel Dashboard)
  - Core logic in `src/lib/monitor.ts`, route in `src/app/api/cron/monitor/route.ts`
- **Connector Ingest** (`/api/cron/ingest`): Runs connectors on schedule
- **Sync** (`/api/cron/sync`): Legacy sync endpoint (predecessor to monitor)

## CI/CD Pipeline Status
- **Last validated:** 2026-02-12
- **Pipeline:** GitHub Actions (ci.yml) > auto-merge > Vercel deploy
- **Branch protection:** Enforced on `main` (require PR + status checks)
- **Repo visibility:** Public (MIT License)
