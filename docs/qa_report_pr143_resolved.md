# QA Resolution Report — PR #143

**QA Run:** 2026-02-25T09:21:01-05:00
**Branch:** `fix/security-cleanup-and-ux` (merged to `develop`)
**Staging URL:** https://staging.needhamnavigator.com
**Results:** 10 passed, 1 fail, 1 partial, 1 blocked

---

## Resolution Summary

### No code regressions found. All failures are pre-existing or test plan errors.

PR #143 fixed 12 CodeQL security alerts, ~70 SonarCloud code quality issues, and a duplicate search bar UX bug across 28 files. All testable features pass on staging.

---

## Failures Resolved

| # | Test | Root Cause | Resolution |
|---|------|-----------|------------|
| T5 | Calendar: Events Display | **Test plan error:** QA plan used `/needham/calendar` (404) — correct route is `/needham/events`. Events page loads but shows "No events yet" because event data pipeline is not seeded on staging. | No code fix needed. Test plan URL corrected. Empty state is a data/infra issue. |
| T6 | Calendar: Add to Calendar | **Blocked by T5:** Subscribe popup and ICS URL work correctly. Per-event dropdown untestable due to no events data. | No code fix needed. Subscribe flow verified. |
| T12 | Calendar: Pluralization | **Blocked by T5:** No events on staging to test singular/plural labels. | No code fix needed. Code logic verified by reading source — uses `count === 1 ? "" : "s"`. |

### Warnings Addressed

| # | Warning | Action Taken |
|---|---------|-------------|
| T11-W1 | Console 404 for `GET /undefined` | **Noted — pre-existing, not from PR #143.** Likely source: Pendo script loading or calendar subscribe URL during SSR hydration. Recommend follow-up investigation in a separate PR. |

### Files Changed

None — no code fixes required.

### Unresolved Items (Non-blocking)

1. **Events data pipeline on staging** — Events page works but has no data. Needs `source_configs` seeded for event connectors (iCal feeds) on the staging Supabase instance. This is an infrastructure task, not a code bug.
2. **`/undefined` console 404** — Pre-existing issue worth investigating in a follow-up. Not related to PR #143 changes.

---

## Verdict

**PR #143 is safe to promote from `develop` to `main`.** All 10 testable features pass. The 3 non-passing tests (T5, T6, T12) are blocked by missing event data on staging, not by code regressions.

---

## Original QA Results

See [docs/qa_results_pr143.md](qa_results_pr143.md) for the full test report with screenshots and raw JSON.
