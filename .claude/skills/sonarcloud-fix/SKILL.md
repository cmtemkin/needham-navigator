---
name: sonarcloud-fix
description: >
  Automated SonarCloud issue detection and resolution. Fetches all open issues
  from SonarCloud, categorizes them by severity, and applies fixes to achieve
  and maintain an A rating across all dimensions (Reliability, Security, Maintainability).
  Use this skill when: SonarCloud quality gate fails, before a release, during
  code quality sweeps, or when asked to "fix sonarcloud issues".
---

# SonarCloud Issue Fixer

You are an AI agent tasked with maintaining an A rating on SonarCloud for this project.

## Project Info

- **SonarCloud Organization:** `cmtemkin`
- **SonarCloud Project Key:** `cmtemkin_needham-navigator`
- **Analysis Mode:** Automatic (runs on SonarCloud's servers, not GitHub Actions)
- **Config File:** `sonar-project.properties`

## Step 1: Fetch Current Issues

Use the SonarCloud public API to get all open issues:

```bash
# Get quality gate status
curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=cmtemkin_needham-navigator" | python3 -m json.tool

# Get all open issues (bugs, vulnerabilities, code smells)
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=cmtemkin_needham-navigator&resolved=false&ps=100" | python3 -m json.tool

# Get current metrics
curl -s "https://sonarcloud.io/api/measures/component?component=cmtemkin_needham-navigator&metricKeys=bugs,vulnerabilities,code_smells,security_hotspots,reliability_rating,security_rating,sqale_rating,duplicated_lines_density" | python3 -m json.tool

# Get security hotspots that need review
curl -s "https://sonarcloud.io/api/hotspots/search?projectKey=cmtemkin_needham-navigator&status=TO_REVIEW" | python3 -m json.tool
```

## Step 2: Categorize and Prioritize

Issues that block the quality gate (fix these FIRST):
1. **Vulnerabilities** — directly affect Security Rating (A requires 0 vulnerabilities)
2. **Bugs** — directly affect Reliability Rating
3. **Security Hotspots** — unreviewed hotspots can affect Security Rating

Issues that affect maintainability (fix these SECOND):
4. **Code Smells** — affect Maintainability Rating (but A rating tolerates some)

## Step 3: Apply Fixes by Rule Type

### Common SonarCloud Rules and Fixes

**`githubactions:S8233` — Workflow permissions too broad**
- Move `permissions:` from workflow level to individual job level
- Each job should only have the permissions it actually needs

**`typescript:S6759` — Component props not read-only**
- Wrap component props type with `Readonly<>`:
  ```tsx
  // Before
  function Foo({ bar }: { bar: string }) { ... }
  // After
  function Foo({ bar }: Readonly<{ bar: string }>) { ... }
  ```

**`typescript:S7735` — Unexpected negated condition**
- Flip the condition to use the positive form:
  ```tsx
  // Before
  count !== 1 ? "s" : ""
  // After
  count === 1 ? "" : "s"
  ```

**`javascript:S6564` / `typescript:S6564` — Use `replaceAll` instead of `replace` with global regex**
- Replace `.replace(/pattern/g, replacement)` with `.replaceAll("pattern", replacement)` when the regex is a simple literal
- If the regex uses special characters or flags beyond `g`, keep `replace()` but note the exception

**`css:S4649` — Insufficient color contrast**
- Only applies to HTML files with inline styles
- Fix by adjusting text color or background to meet WCAG AA (4.5:1 contrast ratio)
- If the file is in `docs/` or is a mockup, add it to `sonar.exclusions` instead

**`typescript:S5852` — Regex with potential super-linear backtracking**
- Audit the regex: if it processes user-controlled input AND has nested quantifiers, fix it
- If the regex only processes internal/controlled strings (like markdown formatting, internal IDs), it's a false positive — note this but don't change the code
- Common safe patterns: `\*\*(.*?)\*\*`, `/#{1,6}\s*/`, `\[([^\]]+)\]\([^)]+\)` — these are all safe on short controlled strings

**`S2245` — Pseudorandom number generator (PRNG)**
- Only a real issue if used for security-sensitive purposes (tokens, passwords, encryption)
- `Math.random()` for visitor IDs, UI animations, or cache busting is safe — note this

### Fix Workflow

For each issue:
1. Read the flagged file and understand the context
2. Determine if it's a real issue or a false positive
3. If real: apply the minimal fix
4. If false positive: document why it's safe (the issue will need to be manually dismissed in SonarCloud UI)

## Step 4: Update Exclusions if Needed

If SonarCloud is flagging files that shouldn't be analyzed (docs, mockups, test fixtures), update `sonar-project.properties`:

```properties
sonar.exclusions=**/node_modules/**,**/*.test.ts,**/*.test.tsx,scripts/**,docs/**,__tests__/**,supabase/**,config/**
```

## Step 5: Verify Locally

```bash
npm run lint
npx tsc --noEmit
npm run build
```

All three must pass before pushing.

## Step 6: Push and Monitor

1. Create a `fix/sonarcloud-*` branch
2. Push and create a PR
3. After merge, SonarCloud will re-analyze automatically (usually within 5-10 minutes)
4. Verify the quality gate passes at: https://sonarcloud.io/project/overview?id=cmtemkin_needham-navigator

## Target Ratings

| Dimension | Target | What Affects It |
|-----------|--------|-----------------|
| Reliability | A | 0 bugs |
| Security | A | 0 vulnerabilities |
| Maintainability | A | Technical debt ratio < 5% |
| Security Review | A | 80%+ hotspots reviewed |
| Duplications | < 3% | Duplicated blocks/lines |
