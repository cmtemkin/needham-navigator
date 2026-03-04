# Investigate Content Refresh and Generation Issues

- [x] Check `vercel.json` cron configuration and schedule.
- [x] Inspect the `/api/cron/daily` endpoint to understand the daily generation and refresh logic.
- [x] Identify if there are other cron endpoints or background jobs affecting content refresh.
- [x] Determine why articles aren't refreshing and fix any bugs in the cron logic or refresh schedule.
- [x] Update the cron schedule or add new crons to refresh content more frequently as expected by the user.

## Proposed Fixes
The `/api/cron/daily` endpoint on Vercel runs all three steps (monitor, ingest, generate) sequentially, but the `ingest` step often times out due to Vercel Hobby Plan function limits (10s to 60s max). If `ingest` times out, no new documents are added to the database.

Simultaneously, there is a GitHub Action (`generate-articles.yml`) set to run every day, but it ONLY generates articles assuming docs have already been ingested. Since no new docs are ingested successfully by Vercel, the generator skips creating the daily brief. 

To resolve this, we will move the entire pipeline to GitHub Actions, bypassing Vercel completely.

1. **Delete** `.github/workflows/generate-articles.yml`
2. **Create** a new `.github/workflows/content-pipeline.yml` that runs every 4 hours (`0 */4 * * *`) and executes:
   - `npx tsx scripts/monitor.ts`
   - `npx tsx scripts/ingest.ts --limit=50`
   - `npx tsx scripts/generate-articles.ts`
3. **Remove** the `crons` array from `vercel.json` as it's no longer needed and reliably fails.

## Verification
1. [x] Review the new `content-pipeline.yml` workflow.
2. [x] Run locally to identify node/ts dependencies (failed with node permissions locally, but Action config is sound).
3. [x] Commit changes so the user can trigger from GitHub Actions tab to ensure it runs without timeouts.
