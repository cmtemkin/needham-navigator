# QA Results — PR #143: Security Cleanup, SonarCloud Fixes, and Duplicate Search Bar

**Run date:** 2026-02-25T09:21:01-05:00  
**Base URL:** https://staging.needhamnavigator.com  
**Town slug:** `needham`  
**Tester:** Automated (Antigravity QA Agent)

---

## Summary Table

| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Homepage: Single Search Bar | ✅ PASS | — |
| T2 | Sticky Search Bar Scroll | ✅ PASS | — |
| T3 | Chat: Streaming Response | ✅ PASS | — |
| T4 | Search: No Duplicate Titles | ✅ PASS | — |
| T5 | Calendar: Events Display | ❌ FAIL | `/needham/calendar` returns 404; events page shows "No events yet" |
| T6 | Calendar: Add to Calendar | ⚠️ PARTIAL | Subscribe popup OK; per-event Add to Calendar blocked (no events) |
| T7 | Articles: Skeletons & Filters | ✅ PASS | — |
| T8 | Community: Phone Links | ✅ PASS | — |
| T9 | Live Widgets | ✅ PASS | — |
| T10 | Releases: Markdown Stripped | ✅ PASS | — |
| T11 | Service Worker | ✅ PASS | 1 unrelated 404 for `/undefined` in console |
| T12 | Calendar: Pluralization | 🚫 BLOCKED | No events loaded; cannot test event count labels |
| T13 | Mobile: Homepage Search | ✅ PASS | — |

**Total: 10 PASS · 1 FAIL · 1 PARTIAL · 1 BLOCKED**

---

## Per-Test Details

---

## T1 — Homepage: Single Search Bar ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Hero search bar is visible | Large centered search input in gradient hero section | ✅ Hero search bar visible in gradient hero section | PASS |
| 3 | Only one search bar on page | No second search bar in header area | ✅ Only one search bar visible | PASS |
| 4 | Header search bar is hidden | Header shows logo, nav links, but NO search input | ✅ Header shows logo + nav links (News, Events, Ask a Question); no search input | PASS |
| 6 | Search results appear | Results list visible below a sticky search bar | ✅ Results appeared after searching "permits" | PASS |
| 7 | Sticky search bar positioning | Sits BELOW the header with ~60px gap, not overlapping | ✅ Sticky bar at ~Y=124px, header ends ~Y=84px; clear separation | PASS |

![T1 — Homepage single search bar](t1_homepage_single_search_bar_png_1772029433357.png)

![T1 — Sticky search bar position after search](t1_sticky_search_bar_position_png_1772029479045.png)

---

## T2 — Sticky Search Bar Scroll Behavior ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Sticky bar stays visible on scroll | Search bar with query stays pinned below header | ✅ Bar remained visible and pinned after scrolling ~500px | PASS |
| 4 | No visual overlap | Clear separation between header and sticky bar | ✅ Clear separation observed; no overlap | PASS |
| 5 | Header stays on top | Header visually above sticky search bar at all times | ✅ Header remained at the very top of viewport | PASS |

![T2 — Sticky search bar scroll (no overlap)](t2_sticky_scroll_no_overlap_png_1772029514396.png)

---

## T3 — Chat: Streaming Response Still Works ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Response streams in | Text appears incrementally, not all at once | ✅ Typing animation then incremental text; streaming confirmed | PASS |
| 4 | Bold text rendered | Words like permit types or department names are bold | ✅ Bold rendered (e.g., "Demolition:", "Helpful contact details") | PASS |
| 5 | Source chips visible | At least 1 source chip with title and link | ✅ 4 source chips visible (e.g., "Permits / Licenses", "Permit Requirements, MA") | PASS |
| 6 | Confidence badge visible | Badge shows "high", "medium", or "low" | ✅ "Verified from official sources" badge with green dot | PASS |
| 7 | AI disclaimer visible | Text like "AI answers may not be current" below message | ✅ "AI answers may not be current — always verify with official sources" present | PASS |

![T3 — Chat response complete](t3_chat_response_complete_png_1772029639423.png)

---

## T4 — Search Results: No Duplicate Titles ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Results appear | At least 2 results related to transfer station | ✅ Multiple relevant results returned | PASS |
| 4 | No duplicate titles | Each result has a unique title | ✅ All result titles unique; no duplicates detected | PASS |
| 5 | Clean snippets | No `**`, `#`, `[text](url)` markdown artifacts in snippets | ✅ Snippets clean; no markdown artifacts visible | PASS |

![T4 — Search results for "transfer station"](t4_search_results_transfer_station_png_1772029684917.png)

---

## T5 — Calendar: Events Load and Display ❌

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Events load | Spinner disappears, calendar grid is populated | ❌ `/needham/calendar` → 404. On `/needham/events`: page loads but shows "No events yet" | FAIL |
| 3 | Current month shown | Month/year header matches today's (February 2026) | ✅ February 2026 header visible | PASS |
| 5 | Detail panel appears | Panel shows events for selected date | ❌ No events to click; panel untestable | FAIL |
| 6 | Event cards correct | Title, date badge, time, source label all visible | ❌ No events loaded | FAIL |
| 7 | List view toggle | Clicking List icon switches to list layout | ✅ Toggle works; switches to list layout | PASS |
| 8 | List view sorted | Events sorted by date, future events only | ❌ No events to verify sorting | FAIL |

> **Bug:** `/needham/calendar` returns a 404 — the calendar route does not exist; the correct path appears to be `/needham/events`. The events page loads but shows **"No events yet. Events from the Town Calendar, Library, and Schools will appear here once the data pipeline is configured."** This is a data pipeline/configuration issue, not a code regression, but the missing route alias may be a concern.

![T5 — Calendar month view (empty state)](t5_calendar_month_view_1772029881984.png)

![T5 — Calendar list view (empty state)](t5_calendar_list_view_1772029897579.png)

---

## T6 — Calendar: Add to Calendar ⚠️ PARTIAL

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Dropdown appears | Shows "Google Calendar" link and "Download .ics" option | ⚠️ Cannot test — no events loaded to access per-event dropdown | BLOCKED |
| 4 | ICS file downloads | File has `.ics` extension | ⚠️ Cannot test — no events | BLOCKED |
| 5 | Subscribe popup opens | Popup with URL input and Copy button | ✅ Subscribe button opens popup with URL and Copy button | PASS |
| 6 | Subscribe URL correct | URL contains `/api/events/ics?town=needham` | ✅ `https://staging.needhamnavigator.com/api/events/ics?town=needham` confirmed | PASS |
| 7 | Copy works | Button click copies URL | ✅ Copy button present and functional | PASS |

> **Warning:** Per-event "Add to Calendar" dropdown (Google Calendar + Download .ics) could not be tested due to absence of events on staging. The subscribe/ICS endpoint URL is correct.

![T6 — Subscribe popup (proxy for Add to Calendar dropdown)](t6_add_to_calendar_dropdown_1772029918857.png)

---

## T7 — Articles / News Page: Loading Skeletons and Filters ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Skeleton loading state | 6 shimmer/placeholder cards visible during load | ✅ Skeleton/shimmer cards observed immediately on navigation | PASS |
| 3 | Articles render | At least 1 article with title, snippet, source badge | ✅ 370 articles loaded with titles, snippets, and source badges | PASS |
| 4 | Keyword filter works | Typing "school" shows only school-related items | ✅ "14 of 370 items (filtered)" shown after typing "school" | PASS |
| 5 | Filtered count updates | "X of Y items (filtered)" text visible | ✅ "14 of 370 items (filtered)" text visible | PASS |
| 6 | Date filter works | Results further filtered by date range | ✅ "This Week" filter → "5 of 370 items (filtered)" | PASS |

![T7 — Articles loading skeleton](t7_articles_loading_skeleton_1772029932956.png)

![T7 — Articles filtered by "school"](t7_articles_filtered_1772029963193.png)

---

## T8 — Community: Phone Number Links ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Police phone visible | Phone number displayed like "(781) 455-7570" | ✅ Police phone displayed as "(781) 455-7570" | PASS |
| 4 | Police tel link clean | `href` is `tel:7814557570` (digits only) | ✅ `href="tel:7814557570"` — no parens, dashes, or spaces | PASS |
| 5 | Fire tel link clean | `href` is `tel:` followed by digits only | ✅ `href="tel:7814557580"` — digits only | PASS |

![T8 — Community emergency contacts with phone links](t8_community_phone_links_1772029999175.png)

---

## T9 — Live Widgets: Weather and Transit ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Weather widget renders | Temperature, forecast text, wind info, "Live" badge | ✅ 39°F, "Light Snow", wind info, and "Live" badge visible | PASS |
| 4 | Transit widget renders | Next departure time or "No departures" message | ✅ Next departure "2:33 PM" shown | PASS |
| 5 | Alert pluralization correct | "1 Alert" (singular) or "2 Alerts" (plural) | ✅ "4 ALERTS" (plural) — correct | PASS |
| 6 | Stop name displays | Shows "Next train · [StopName]" if present | ✅ "Next train · Roslindale Village" — correct format | PASS |

![T9 — Live widgets (weather and transit)](t9_live_widgets_1772030016582.png)

---

## T10 — Releases Page: Markdown Stripped ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Clean text rendering | No `**`, `#`, backticks, or `[text](url)` visible | ✅ Release notes (v0.17.0) render with clean text; no raw markdown | PASS |
| 3 | Bold text handled | Either rendered bold or stripped to plain text | ✅ Bold text rendered properly | PASS |
| 4 | Links handled | Shown as plain text or clickable links | ✅ PR links (e.g., "PR #130") rendered as text/links, not raw markdown | PASS |

![T10 — Releases page with clean rendering](t10_releases_page_1772030075768.png)

---

## T11 — Service Worker: Offline Fallback ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | SW registered | Service worker shows as "activated and running" | ✅ SW registered, state: `"activated"`, scope: `https://staging.needhamnavigator.com/` | PASS |
| 4 | No JS errors | No errors about `self`, `globalThis`, or service worker in console | ✅ No related errors; one unrelated 404 for `/undefined` noted | PASS |

> **Warning:** One unrelated console error: `GET /undefined 404`. Not related to the service worker or PR #143 changes.

---

## T12 — Calendar: Event Detail Panel Pluralization 🚫 BLOCKED

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Singular form | "(1 event)" — no trailing "s" | 🚫 Cannot test — no events on staging | BLOCKED |
| 5 | Plural form | "(N events)" with "s" | 🚫 Cannot test — no events on staging | BLOCKED |

> **Blocked:** Events calendar shows "No events yet. Events from the Town Calendar, Library, and Schools will appear here once the data pipeline is configured." Pluralization logic cannot be verified until the data pipeline is active.

![T12 — Calendar empty state (blocked)](t12_event_count_singular_1772030097117.png)

---

## T13 — Mobile: Homepage Search Bar ✅

**Viewport: 375×812 (iPhone)**

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Single search bar on mobile | No duplicate search bars | ✅ Only hero search bar visible; header has no second search bar | PASS |
| 5 | Sticky bar below header | Clear visual separation, no overlap | ✅ Sticky search bar appears below header with clear gap after search | PASS |
| 6 | Results readable | Text not truncated, cards stack vertically | ✅ Results readable; cards stack vertically on mobile | PASS |

![T13 — Mobile homepage (375×812)](t13_mobile_homepage_1772030238378.png)

![T13 — Mobile search results for "taxes"](t13_mobile_search_results_final_1772030148338.png)

---

## Issues Found

### 🔴 FAIL: `/needham/calendar` returns 404
The test plan links to `/needham/calendar` but that route doesn't exist. The correct URL appears to be `/needham/events`. Consider either:
- Adding a redirect from `/needham/calendar` → `/needham/events`, or
- Updating internal links/docs to use `/needham/events`

### 🟡 PARTIAL: Calendar events not populated on staging
Both T5 (events display) and T12 (pluralization) are untestable because the events data pipeline isn't configured on staging. This also means the per-event "Add to Calendar" dropdown in T6 couldn't be verified. These tests should be re-run once event data is seeded or the pipeline is connected.

### 🟡 WARNING: Console 404 for `/undefined`
An unrelated console error (`GET /undefined 404`) was observed on the homepage. Not related to PR #143 but worth investigating.

---

## Raw JSON

```json
{
  "run_timestamp": "2026-02-25T09:21:01-05:00",
  "base_url": "https://staging.needhamnavigator.com",
  "summary": {
    "total": 13,
    "passed": 10,
    "failed": 1,
    "partial": 1,
    "blocked": 1,
    "warnings": 2
  },
  "tests": [
    {
      "id": "T1",
      "name": "Homepage: Single Search Bar",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Hero search bar visible", "status": "pass", "expected": "Large centered search input in gradient hero section", "actual": "Hero search bar visible in gradient hero section" },
        { "step": 3, "description": "Only one search bar on page", "status": "pass", "expected": "No second search bar in header area", "actual": "Only one search bar visible" },
        { "step": 4, "description": "Header search bar hidden", "status": "pass", "expected": "Header shows logo, nav links, no search input", "actual": "Header shows logo + nav links (News, Events, Ask a Question); no search input" },
        { "step": 6, "description": "Search results appear", "status": "pass", "expected": "Results list visible below sticky search bar", "actual": "Results appeared after searching 'permits'" },
        { "step": 7, "description": "Sticky search bar positioning", "status": "pass", "expected": "Sits BELOW the header with ~60px gap, not overlapping", "actual": "Sticky bar at ~Y=124px, header ends ~Y=84px; clear separation" }
      ],
      "warnings": [],
      "screenshot_paths": ["t1_homepage_single_search_bar_png_1772029433357.png", "t1_sticky_search_bar_position_png_1772029479045.png"]
    },
    {
      "id": "T2",
      "name": "Sticky Search Bar Scroll Behavior",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Sticky bar stays visible on scroll", "status": "pass", "expected": "Search bar with query stays pinned below header", "actual": "Bar remained visible and pinned after scrolling ~500px" },
        { "step": 4, "description": "No visual overlap", "status": "pass", "expected": "Clear separation between header and sticky bar", "actual": "Clear separation observed; no overlap" },
        { "step": 5, "description": "Header stays on top", "status": "pass", "expected": "Header visually above sticky search bar", "actual": "Header remained at the very top of viewport" }
      ],
      "warnings": [],
      "screenshot_paths": ["t2_sticky_scroll_no_overlap_png_1772029514396.png"]
    },
    {
      "id": "T3",
      "name": "Chat: Streaming Response",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Response streams in", "status": "pass", "expected": "Text appears incrementally", "actual": "Typing animation then incremental text; streaming confirmed" },
        { "step": 4, "description": "Bold text rendered", "status": "pass", "expected": "Words like permit types in bold", "actual": "Bold rendered (e.g., 'Demolition:', 'Helpful contact details')" },
        { "step": 5, "description": "Source chips visible", "status": "pass", "expected": "At least 1 source chip with title and link", "actual": "4 source chips visible" },
        { "step": 6, "description": "Confidence badge visible", "status": "pass", "expected": "Badge shows high/medium/low", "actual": "'Verified from official sources' badge with green dot" },
        { "step": 7, "description": "AI disclaimer visible", "status": "pass", "expected": "Text like 'AI answers may not be current'", "actual": "'AI answers may not be current — always verify with official sources' present" }
      ],
      "warnings": [],
      "screenshot_paths": ["t3_chat_response_complete_png_1772029639423.png"]
    },
    {
      "id": "T4",
      "name": "Search: No Duplicate Titles",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Results appear", "status": "pass", "expected": "At least 2 results related to transfer station", "actual": "Multiple relevant results returned" },
        { "step": 4, "description": "No duplicate titles", "status": "pass", "expected": "Each result has a unique title", "actual": "All result titles unique; no duplicates detected" },
        { "step": 5, "description": "Clean snippets", "status": "pass", "expected": "No markdown artifacts in snippets", "actual": "Snippets clean; no markdown artifacts visible" }
      ],
      "warnings": [],
      "screenshot_paths": ["t4_search_results_transfer_station_png_1772029684917.png"]
    },
    {
      "id": "T5",
      "name": "Calendar: Events Load and Display",
      "status": "fail",
      "assertions": [
        { "step": 2, "description": "Events load", "status": "fail", "expected": "Spinner disappears, calendar grid is populated", "actual": "/needham/calendar returns 404; /needham/events shows 'No events yet'" },
        { "step": 3, "description": "Current month shown", "status": "pass", "expected": "Month/year header matches today's", "actual": "February 2026 header visible" },
        { "step": 5, "description": "Detail panel appears", "status": "fail", "expected": "Panel shows events for selected date", "actual": "No events to click; panel untestable" },
        { "step": 6, "description": "Event cards correct", "status": "fail", "expected": "Title, date badge, time, source label all visible", "actual": "No events loaded" },
        { "step": 7, "description": "List view toggle", "status": "pass", "expected": "Clicking List icon switches to list layout", "actual": "Toggle works; switches to list layout" },
        { "step": 8, "description": "List view sorted", "status": "fail", "expected": "Events sorted by date, future only", "actual": "No events to verify sorting" }
      ],
      "warnings": [
        "/needham/calendar returns 404; correct path is /needham/events",
        "Events data pipeline not configured on staging; 'No events yet' message shown"
      ],
      "screenshot_paths": ["t5_calendar_month_view_1772029881984.png", "t5_calendar_list_view_1772029897579.png"]
    },
    {
      "id": "T6",
      "name": "Calendar: Add to Calendar / Subscribe",
      "status": "partial",
      "assertions": [
        { "step": 3, "description": "Dropdown appears with Google Calendar and .ics options", "status": "blocked", "expected": "Dropdown shows Google Calendar and Download .ics", "actual": "Cannot test — no events loaded to access per-event dropdown" },
        { "step": 4, "description": "ICS file downloads", "status": "blocked", "expected": "File with .ics extension", "actual": "Cannot test — no events" },
        { "step": 5, "description": "Subscribe popup opens", "status": "pass", "expected": "Popup with URL input and Copy button", "actual": "Subscribe button opens popup with URL and Copy button" },
        { "step": 6, "description": "Subscribe URL correct", "status": "pass", "expected": "URL contains /api/events/ics?town=needham", "actual": "https://staging.needhamnavigator.com/api/events/ics?town=needham confirmed" },
        { "step": 7, "description": "Copy works", "status": "pass", "expected": "Button click copies URL", "actual": "Copy button present and functional" }
      ],
      "warnings": ["Per-event 'Add to Calendar' dropdown untestable due to absence of events on staging"],
      "screenshot_paths": ["t6_add_to_calendar_dropdown_1772029918857.png"]
    },
    {
      "id": "T7",
      "name": "Articles: Skeletons & Filters",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Skeleton loading state", "status": "pass", "expected": "6 shimmer/placeholder cards during load", "actual": "Skeleton cards observed immediately on navigation" },
        { "step": 3, "description": "Articles render", "status": "pass", "expected": "At least 1 article with title, snippet, source badge", "actual": "370 articles loaded with titles, snippets, and source badges" },
        { "step": 4, "description": "Keyword filter works", "status": "pass", "expected": "Typing 'school' shows only school-related items", "actual": "'14 of 370 items (filtered)' shown after typing 'school'" },
        { "step": 5, "description": "Filtered count updates", "status": "pass", "expected": "'X of Y items (filtered)' text visible", "actual": "'14 of 370 items (filtered)' text visible" },
        { "step": 6, "description": "Date filter works", "status": "pass", "expected": "Results further filtered by date range", "actual": "'This Week' filter → '5 of 370 items (filtered)'" }
      ],
      "warnings": [],
      "screenshot_paths": ["t7_articles_loading_skeleton_1772029932956.png", "t7_articles_filtered_1772029963193.png"]
    },
    {
      "id": "T8",
      "name": "Community: Phone Links",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Police phone visible", "status": "pass", "expected": "Phone displayed like '(781) 455-7570'", "actual": "Police phone displayed as '(781) 455-7570'" },
        { "step": 4, "description": "Police tel link clean", "status": "pass", "expected": "href is tel:7814557570 (digits only)", "actual": "href='tel:7814557570' — no parens, dashes, or spaces" },
        { "step": 5, "description": "Fire tel link clean", "status": "pass", "expected": "href is tel: followed by digits only", "actual": "href='tel:7814557580' — digits only" }
      ],
      "warnings": [],
      "screenshot_paths": ["t8_community_phone_links_1772029999175.png"]
    },
    {
      "id": "T9",
      "name": "Live Widgets",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Weather widget renders", "status": "pass", "expected": "Temperature, forecast, wind, Live badge", "actual": "39°F, Light Snow, wind info, Live badge visible" },
        { "step": 4, "description": "Transit widget renders", "status": "pass", "expected": "Next departure time or 'No departures'", "actual": "Next departure '2:33 PM' shown" },
        { "step": 5, "description": "Alert pluralization correct", "status": "pass", "expected": "'1 Alert' or '2 Alerts'", "actual": "'4 ALERTS' (plural) — correct" },
        { "step": 6, "description": "Stop name displays", "status": "pass", "expected": "Shows 'Next train · [StopName]'", "actual": "'Next train · Roslindale Village' — correct format" }
      ],
      "warnings": [],
      "screenshot_paths": ["t9_live_widgets_1772030016582.png"]
    },
    {
      "id": "T10",
      "name": "Releases: Markdown Stripped",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Clean text rendering", "status": "pass", "expected": "No **, #, backticks, or [text](url) visible", "actual": "v0.17.0 release notes render with clean text; no raw markdown" },
        { "step": 3, "description": "Bold text handled", "status": "pass", "expected": "Rendered bold or stripped to plain text", "actual": "Bold text rendered properly" },
        { "step": 4, "description": "Links handled", "status": "pass", "expected": "Plain text or clickable links (not raw markdown)", "actual": "PR links rendered as text/links, not raw markdown" }
      ],
      "warnings": [],
      "screenshot_paths": ["t10_releases_page_1772030075768.png"]
    },
    {
      "id": "T11",
      "name": "Service Worker",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "SW registered", "status": "pass", "expected": "Service worker shows as activated and running", "actual": "SW registered, state: 'activated', scope: https://staging.needhamnavigator.com/" },
        { "step": 4, "description": "No JS errors", "status": "pass", "expected": "No errors about self, globalThis, or service worker", "actual": "No related errors; one unrelated 404 for /undefined noted" }
      ],
      "warnings": ["Unrelated console error: GET /undefined 404"],
      "screenshot_paths": []
    },
    {
      "id": "T12",
      "name": "Calendar: Pluralization",
      "status": "blocked",
      "assertions": [
        { "step": 3, "description": "Singular form '(1 event)'", "status": "blocked", "expected": "'(1 event)' — no trailing s", "actual": "Cannot test — no events on staging" },
        { "step": 5, "description": "Plural form '(N events)'", "status": "blocked", "expected": "'(N events)' with N≥2", "actual": "Cannot test — no events on staging" }
      ],
      "warnings": ["Events calendar empty; data pipeline not configured"],
      "screenshot_paths": ["t12_event_count_singular_1772030097117.png"]
    },
    {
      "id": "T13",
      "name": "Mobile: Homepage Search",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Single search bar on mobile", "status": "pass", "expected": "No duplicate search bars", "actual": "Only hero search bar visible; header has no second search bar" },
        { "step": 5, "description": "Sticky bar below header", "status": "pass", "expected": "Clear visual separation, no overlap", "actual": "Sticky search bar appears below header with clear gap after search" },
        { "step": 6, "description": "Results readable", "status": "pass", "expected": "Text not truncated, cards stack vertically", "actual": "Results readable; cards stack vertically on mobile" }
      ],
      "warnings": [],
      "screenshot_paths": ["t13_mobile_homepage_1772030238378.png", "t13_mobile_search_results_final_1772030148338.png"]
    }
  ]
}
```
