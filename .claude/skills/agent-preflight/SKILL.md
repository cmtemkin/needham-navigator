---
name: agent-preflight
description: >
  Mandatory preflight checklist that every AI agent must run before starting any new work
  on this repo. Checks for open CI failures, production outages, and build health — then
  fixes existing bugs before writing any new code. Use this skill at the START of every
  Claude Code session, every new agent chat, and before beginning any feature work.
  Triggers: starting a session, beginning work, new feature, new task, "what should I work on",
  opening the repo, any agent prompt that starts with building something new.
---

# Agent Preflight Checklist

You are an AI agent working on a shared codebase. Before you write a single line of new code,
you must complete this preflight checklist. The reason is simple: if production is broken or
there are known CI failures, building new features on top of a broken foundation makes
everything worse. Fix what's broken first, then build.

## Step 1: Check for open issues (30 seconds)

Run this command to see if there are any known problems:

```bash
gh issue list --label ci-failure --label prod-down --state open
```

**If issues exist:**
- Read each open issue carefully — they contain error details and fix instructions
- These are your TOP PRIORITY. Do not start any new feature work.
- Fix the issues first (see Step 4 below)

**If no issues exist:** Great, move to Step 2.

## Step 2: Verify the build is healthy (1-2 minutes)

Even if there are no open issues, confirm that main actually builds:

```bash
git checkout main
git pull origin main
npm ci
npm run build
```

**If the build fails:**
- You just found a bug that slipped through. Fix it before doing anything else.
- Create a branch, fix the issue, push, and create a PR.
- Do NOT push directly to main.

**If the build succeeds:** Move to Step 3.

## Step 3: Check for in-flight work (30 seconds)

See what's already in progress so you don't duplicate effort or create conflicts:

```bash
gh pr list --state open
git branch -r
```

Review any open PRs. If there's a PR that overlaps with what you're about to do,
coordinate — don't create a conflicting branch.

## Step 4: Fix existing bugs (if any found)

When you find issues from Step 1 or build failures from Step 2:

1. Create a fix branch from main: `git checkout main && git pull && git checkout -b fix/<short-description>`
2. Diagnose the problem from the GitHub Issue or build output
3. Fix it with the minimal change needed
4. Verify locally: `npm run build && npm test`
5. Push and create a PR: `git push origin fix/<name> && gh pr create --title "Fix: <desc>" --body "Fixes #<issue>"`
6. Do NOT merge — CI will auto-merge if green
7. Only then move on to new feature work

## Step 5: Start your actual work

Now that everything is healthy, begin your assigned task:
- NEVER push directly to main — always create a feature branch
- One feature per PR — keep changes focused
- Create a PR when done — CI handles the rest

Branch naming: `feature/<name>`, `fix/<name>`, `setup/<name>`, `data/<name>`
