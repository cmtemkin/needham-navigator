# Needham Navigator — QA Report
**Run timestamp:** 2026-02-24T14:35:28Z  
**Base URL:** http://localhost:3000  
**Town route:** `/needham`

## Summary

| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Single Search Bar on Homepage | ✅ PASS | — |
| T2 | Content Preview Text Quality | ✅ PASS | 1 |
| T3 | Search Deduplication | ❌ **FAIL** | — |
| T4 | No Archive Content in Search | ✅ PASS | — |
| T5 | Cron Diagnostics Endpoint | ✅ PASS | 4 |
| T6 | Mobile Viewport — Homepage Search | ✅ PASS | — |

**5 passed / 1 failed / 5 total warnings**

---

## T1 — Single Search Bar on Homepage ✅ PASS

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Header has no `<input>` on homepage | 0 inputs | 0 inputs | ✅ |
| 4 | Hero has `data-pendo="search-input-hero"` | 1 input | 1 input found | ✅ |
| 5 | No `aria-label="Search"` toggle in header (homepage) | 0 buttons | 0 buttons | ✅ |
| 8 | Header has `data-pendo="header-search-input"` on `/articles` | 1 input | 1 input found | ✅ |
| 10 | Header has no search input on `/search?q=permits` | 0 inputs | 0 inputs | ✅ |
| 11 | Sticky `data-pendo="search-input-sticky"` visible on results page | visible | confirmed visible | ✅ |

### Homepage screenshot (desktop)

![T1 — Homepage desktop](/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t1_homepage_png_1771940708271.png)

---

## T2 — Content Preview Text Quality ✅ PASS (1 warning)

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3a | All previews length > 20 chars | > 20 chars | Met — e.g. "February 13, 2026 A group of high schoolers is on a mission to let kids be kids." (~80 chars) | ✅ |
| 3b | No markdown syntax (`#`, `**`, `![`, `]()`) in previews | None | None detected | ✅ |
| 3c | Previews end cleanly (`...` or sentence punctuation) | `.` or `...` | Observed — "to let kids be kids." and "...the last..." | ✅ |

> [!WARNING]
> **Non-Needham content detected:** "Eversource Offers Direct Payment Permits for Businesses in Connecticut" is visible on the homepage news feed. This is off-topic for a Needham, MA town guide. Confirmed present in the DB via `/api/admin/cron-status`.

### Homepage with off-topic Eversource article visible

![T2 — Warning: Eversource article visible in news feed](/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t2_warning_news_png_1771942017912.png)

---

## T3 — Search Deduplication ❌ FAIL

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 5 | No duplicate titles for "transfer station" | All unique | "Recycling and Transfer Station Summer Hours in Effect" appears **twice** | ❌ |
| 7 | No duplicate normalized titles for "transfer station" | All unique | "recycling and transfer station summer hours in effect" duplicated | ❌ |
| 9 | No duplicate URLs for "transfer station" | All unique | `needhamma.gov/CivicAlerts.asp` appears for both duplicate results | ❌ |
| 10 | No duplicates for "building permits" | All unique | Duplicate results with matching normalized titles and URLs found | ❌ |

**Root cause hypothesis:** Duplicate records exist in the vector store / Supabase, or de-duplication is not applied at query time.

### Duplicate results visible in search (transfer station)

![T3 — FAIL: Duplicate search results for "transfer station"](/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t3_fail_duplicates_png_1771943323171.png)

---

## T4 — No Archive Content in Search ✅ PASS

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 4 | No `/archivecenter`, `/archive.asp`, `/archive.aspx`, `archive_id=` URLs for "meeting minutes" | 0 | 0 | ✅ |
| 6 | No "Archive Center" titles for "meeting minutes" | 0 | 0 | ✅ |
| 7 | No archive URLs or titles for "town meeting 2020" | 0 | 0 | ✅ |

---

## T5 — Cron Diagnostics Endpoint ✅ PASS (4 warnings)

**Endpoint:** `GET /api/admin/cron-status` → 200 OK

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | HTTP 200 | 200 | 200 | ✅ |
| 3 | Valid JSON | valid | valid | ✅ |
| 4 | Has `timestamp`, `env`, `source_configs` keys | present | all present | ✅ |
| 5 | `env.CRON_SECRET` is boolean | boolean | `false` | ✅ |
| 6 | `source_configs` has `total` and `enabled` numbers | numbers | `total: 0, enabled: 0` | ✅ |

### Full response body

```json
{
  "timestamp": "2026-02-24T14:36:28.221Z",
  "env": {
    "CRON_SECRET": false,
    "OPENAI_API_KEY": true,
    "UPSTASH_VECTOR_REST_URL": true
  },
  "source_configs": {
    "total": 0,
    "enabled": 0,
    "configs": []
  },
  "recent_logs": {
    "error": "column ingestion_log.triggered_by does not exist"
  },
  "recent_articles": [
    { "id": "92a63226...", "title": "Needham, MA Daily Brief — Thursday, February 19, 2026", "content_type": "ai_generated" },
    { "id": "53ff7f91...", "title": "Eversource Offers Direct Payment Permits for Businesses in Connecticut", "content_type": "ai_generated" },
    { "id": "cb409579...", "title": "Needham, MA Daily Brief — Wednesday, February 18, 2026", "content_type": "ai_generated" },
    { "id": "7bb8d9f6...", "title": "Community Art Supply Swap in Needham", "content_type": "ai_summary" },
    { "id": "c1e0af0c...", "title": "Needham Golf Club Seasonal Closure Proposal Delayed", "content_type": "ai_summary" }
  ]
}
```

> [!WARNING]
> **`source_configs.enabled = 0`** — No source configs are enabled, ingestion pipeline is likely not seeded.

> [!WARNING]
> **`source_configs.total = 0`** — No source configs exist at all in the database.

> [!WARNING]
> **`env.CRON_SECRET = false`** — The `CRON_SECRET` environment variable is not set. Scheduled cron jobs will fail authentication.

> [!WARNING]
> **DB schema error in `recent_logs`** — `"column ingestion_log.triggered_by does not exist"` — a migration may be missing or out of sync.

---

## T6 — Mobile Viewport (375×812) ✅ PASS

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | No `aria-label="Search"` toggle in header on mobile homepage | 0 | `searchToggleInHeader: 0` | ✅ |
| 4 | Hero search input visible and interactable on mobile homepage | visible | `heroInput: 1` | ✅ |
| 6 | Search toggle button IS visible in header on mobile `/articles` | ≥ 1 | `searchToggleInHeader: 1` | ✅ |

**JS results (homepage):** `{"searchToggleInHeader":0,"heroInput":1}`  
**JS results (articles):** `{"searchToggleInHeader":1}`

### Mobile homepage (375×812)

![T6 — Mobile homepage: hero search visible, no header toggle](/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t6_mobile_homepage_1771943761586.png)

### Mobile articles page (375×812)

![T6 — Mobile articles: search toggle visible in header](/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t6_mobile_articles_1771943780315.png)

---

## Raw JSON

```json
{
  "run_timestamp": "2026-02-24T14:35:28Z",
  "base_url": "http://localhost:3000",
  "summary": {
    "total": 6,
    "passed": 5,
    "failed": 1,
    "warnings": 5
  },
  "tests": [
    {
      "id": "T1",
      "name": "Single Search Bar on Homepage",
      "status": "pass",
      "duration_ms": 12500,
      "assertions": [
        { "step": 3, "description": "Header has no input element on homepage", "status": "pass", "expected": "0 inputs in header", "actual": "0 inputs found in <header>" },
        { "step": 4, "description": "Hero section contains exactly one input with data-pendo=search-input-hero", "status": "pass", "expected": "1 input", "actual": "1 matching input found" },
        { "step": 5, "description": "No mobile search toggle button visible in header on homepage", "status": "pass", "expected": "0 visible buttons", "actual": "0 found" },
        { "step": 8, "description": "Header contains input with data-pendo=header-search-input on /articles", "status": "pass", "expected": "1 input", "actual": "1 found" },
        { "step": 10, "description": "Header does NOT contain search input on /search?q=permits", "status": "pass", "expected": "0 inputs", "actual": "0 inputs found" },
        { "step": 11, "description": "Sticky search bar with data-pendo=search-input-sticky visible on results page", "status": "pass", "expected": "visible", "actual": "confirmed visible" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t1_homepage_png_1771940708271.png"]
    },
    {
      "id": "T2",
      "name": "Content Preview Text Quality",
      "status": "pass",
      "duration_ms": 8000,
      "assertions": [
        { "step": "3a", "description": "All previews length > 20 characters", "status": "pass", "expected": "> 20 chars", "actual": "All met — shortest observed ~80 chars" },
        { "step": "3b", "description": "No markdown syntax in previews", "status": "pass", "expected": "none", "actual": "none detected" },
        { "step": "3c", "description": "Previews end cleanly", "status": "pass", "expected": "ends with . or ...", "actual": "confirmed" }
      ],
      "warnings": [
        "Non-Needham content: 'Eversource Offers Direct Payment Permits for Businesses in Connecticut' visible on homepage feed and confirmed in DB"
      ],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t2_warning_news_png_1771942017912.png"]
    },
    {
      "id": "T3",
      "name": "Search Deduplication",
      "status": "fail",
      "duration_ms": 25000,
      "assertions": [
        { "step": 5, "description": "No duplicate titles for 'transfer station'", "status": "fail", "expected": "all unique", "actual": "'Recycling and Transfer Station Summer Hours in Effect' appears 2x" },
        { "step": 7, "description": "No duplicate normalized titles for 'transfer station'", "status": "fail", "expected": "all unique", "actual": "normalized duplicate confirmed" },
        { "step": 9, "description": "No duplicate URLs for 'transfer station'", "status": "fail", "expected": "all unique", "actual": "needhamma.gov/CivicAlerts.asp duplicated" },
        { "step": 10, "description": "No duplicates for 'building permits'", "status": "fail", "expected": "all unique", "actual": "duplicate titles and URLs found" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t3_fail_duplicates_png_1771943323171.png"]
    },
    {
      "id": "T4",
      "name": "No Archive Content in Search",
      "status": "pass",
      "duration_ms": 10000,
      "assertions": [
        { "step": 4, "description": "No archive URLs for 'meeting minutes'", "status": "pass", "expected": "0", "actual": "0" },
        { "step": 6, "description": "No 'Archive Center' titles for 'meeting minutes'", "status": "pass", "expected": "0", "actual": "0" },
        { "step": 7, "description": "No archive content for 'town meeting 2020'", "status": "pass", "expected": "0", "actual": "0" }
      ],
      "warnings": [],
      "screenshot_paths": []
    },
    {
      "id": "T5",
      "name": "Cron Diagnostics Endpoint",
      "status": "pass",
      "duration_ms": 2000,
      "assertions": [
        { "step": 2, "description": "HTTP 200", "status": "pass", "expected": "200", "actual": "200" },
        { "step": 3, "description": "Valid JSON", "status": "pass", "expected": "valid", "actual": "valid" },
        { "step": 4, "description": "Has required keys", "status": "pass", "expected": "timestamp, env, source_configs", "actual": "all present" },
        { "step": 5, "description": "env.CRON_SECRET is boolean", "status": "pass", "expected": "boolean", "actual": "false" },
        { "step": 6, "description": "source_configs has total and enabled", "status": "pass", "expected": "numbers", "actual": "total: 0, enabled: 0" }
      ],
      "warnings": [
        "source_configs.enabled === 0 — pipeline not seeded",
        "source_configs.total === 0 — no source configs in DB",
        "env.CRON_SECRET is false — CRON_SECRET env var not set",
        "recent_logs error: 'column ingestion_log.triggered_by does not exist'"
      ],
      "screenshot_paths": []
    },
    {
      "id": "T6",
      "name": "Mobile Viewport — Homepage Search",
      "status": "pass",
      "duration_ms": 9000,
      "assertions": [
        { "step": 3, "description": "No search toggle in header on mobile homepage", "status": "pass", "expected": "0", "actual": "searchToggleInHeader: 0" },
        { "step": 4, "description": "Hero search input visible on mobile homepage", "status": "pass", "expected": "1", "actual": "heroInput: 1" },
        { "step": 6, "description": "Search toggle visible in header on mobile /articles", "status": "pass", "expected": ">= 1", "actual": "searchToggleInHeader: 1" }
      ],
      "warnings": [],
      "screenshot_paths": [
        "/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t6_mobile_homepage_1771943761586.png",
        "/Users/cmtemkin/.gemini/antigravity/brain/c18f1fc8-d13c-4ef5-9429-678b31699490/t6_mobile_articles_1771943780315.png"
      ]
    }
  ]
}
```
