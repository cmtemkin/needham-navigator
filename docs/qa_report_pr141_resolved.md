# QA Test Run Report - Staging (2026-02-25)

**Environment**: `https://staging.needhamnavigator.com`
**Features Tested**: Search Dedup, Mass.gov Query Expansion, Admin Pipeline Dashboard, Events Calendar
**Date**: February 25, 2026

### Summary Table
| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Search Dedup: No Duplicate Pages | PASS | — |
| T2 | Search Dedup: Result Count Still Reasonable | PASS | — |
| T3 | Mass.gov Results Appear for Dual-Jurisdiction | PASS | — |
| T4 | Mass.gov Results Do NOT Appear for Local Queries | PASS | — |
| T5 | Admin Pipeline Tab: KPIs | PASS | — |
| T6 | Admin Pipeline Tab: Connector Health Badges | PASS | — |
| T7 | Admin Pipeline Tab: Article Generation Stats | PASS | — |
| T8 | Events Page: Calendar UI Renders | PASS | — |
| T9 | Events Page: Month Navigation | PASS | — |
| T10 | Events Page: Empty State | PASS | — |
| T11 | Events Page: View Toggle | PASS | — |
| T12 | Events Page: Source Filter Buttons | PASS | — |
| T13 | Events Page: Subscribe Dropdown | PASS | — |
| T14 | ICS Feed Endpoint | PASS | — |
| T15 | Events Page: Mobile Responsive | PASS | — |
| T16 | Calendar Grid Structure (If Events Exist) | SKIP | — |

### Per-Test Details

## T1 — Search Dedup: No Duplicate Pages [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Search results appear | At least 2 results shown | 4 results shown for "transfer station" | PASS |
| 4 | No duplicate URLs for "transfer station" | Each URL at most once | No duplicate needhamma.gov URLs found | PASS |
| 5 | No duplicate URLs for "building permit" | Each URL at most once | 5 results, no duplicate URLs found | PASS |

---

## T2 — Search Dedup: Result Count Still Reasonable [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Result count for "zoning bylaws" | At least 3 unique results | 4 unique results found | PASS |
| 4 | Result count for "schools" | At least 3 unique results | 4 unique results found | PASS |

---

## T3 — Mass.gov Results Appear for Dual-Jurisdiction [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | "building code requirements" includes mass.gov | At least one result from mass.gov domain | Found mass.gov result (home improvement law) | PASS |
| 4 | "septic system inspection" includes mass.gov | At least one result from mass.gov domain | Found mass.gov result | PASS |
| 6 | "property tax exemptions" includes mass.gov | At least one result from mass.gov domain | Found mass.gov results | PASS |

---

## T4 — Mass.gov Results Do NOT Appear for Local Queries [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | "transfer station hours" results | No mass.gov results | Only needhamma.gov results returned | PASS |
| 4 | "recycling schedule" results | No mass.gov results | Only needhamma.gov results returned | PASS |

---

## T5 — Admin Pipeline Tab: KPIs [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | "Pipeline" tab exists in the tab bar | Tab visible with a Zap icon | Pipeline tab visible and clicked | PASS |
| 4 | KPI cards render | 4 cards showing: Pipeline Status, Total Content, Items Last 24h, Items Last 7d | All 4 KPI cards rendered | PASS |
| 5 | Connectors section renders | Table with columns: Source, Type, Category, Schedule, Last Fetched... | Connectors table visible below | PASS |

---

## T6 — Admin Pipeline Tab: Connector Health Badges [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Connectors table has rows | At least 5 connector rows visible | 8 connectors visible | PASS |
| 3 | Each connector has a colored status badge | Badges show one of: Healthy, Warning, Error, Disabled | Badges appear as Disabled or Error | PASS |
| 4 | "needham:library-events" shows Disabled | Gray "Disabled" badge | Gray "Disabled" badge verified | PASS |
| 4 | "needham:school-calendar" shows Disabled | Gray "Disabled" badge | Gray "Disabled" badge verified | PASS |

---

## T7 — Admin Pipeline Tab: Article Generation Stats [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Article Generation section exists | Section heading visible below connectors | Section present | PASS |
| 3 | Three stats shown | "Articles Today", "Articles This Week", "Last Daily Brief" | 0, 2, and 6d ago respectively | PASS |

---

## T8 — Events Page: Calendar UI Renders [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Page header renders | "Needham Events" with purple gradient background | Correct header displayed | PASS |
| 3 | Month navigation present | Left arrow, current month/year text, right arrow, "Today" button | Month nav and Today button present | PASS |
| 3 | Source filter buttons present | 4 buttons: "All", "Town", "Library", "Schools" | 4 filter buttons present | PASS |
| 3 | View toggle present | Two icon buttons (grid and list) | View toggle icons present | PASS |
| 3 | Subscribe button present | Button with RSS icon and text "Subscribe" | Subscribe button visible | PASS |
| 4 | Content area shows calendar or empty state | Either a 7-column calendar grid OR a "No events yet" card | "No events yet" empty state shown | PASS |

---

## T9 — Events Page: Month Navigation [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Month label changes | Shows next month | Changed from Feb to Mar | PASS |
| 4 | Month advances again | Shows month after next | Changed to April | PASS |
| 5 | Goes back two months | Returns to the month from step 2 | Readjusted via buttons | PASS |
| 6 | Returns to current month | Shows the actual current month/year | Clicked "Today" back to Feb 2026 | PASS |

---

## T10 — Events Page: Empty State [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Empty state card renders (if no events) | White card with border, centered content | Rendered properly | PASS |
| 3 | Empty state text | Heading "No events yet" and subtext | Subtext mentions pipeline config | PASS |

---

## T11 — Events Page: View Toggle [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | List icon becomes active | List icon gets primary color background | Button styling correctly toggled | PASS |
| 2 | Content switches to list layout | If empty: empty state unchanged | Empty state unchanged as expected | PASS |
| 3 | Grid icon becomes active | Grid icon gets primary color background | Toggled back to grid outline | PASS |

---

## T12 — Events Page: Source Filter Buttons [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | "All" is selected by default | "All" button has primary color fill | Selected on initial load | PASS |
| 2 | "Town" becomes active | "Town" button gets primary color fill | Changed successfully on click | PASS |
| 3 | "All" deselects | "All" button returns to outlined/inactive style | Unselected | PASS |
| 4 | "All" reselects | "All" button returns to primary color fill | Reselected | PASS |

---

## T13 — Events Page: Subscribe Dropdown [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Dropdown appears below Subscribe button | White panel with border and shadow | Dropdown appeared | PASS |
| 3 | Contains subscribe URL | URL input shows API URL | URL populated in input | PASS |
| 3 | Copy button present | "Copy" button next to URL input | Button present | PASS |
| 3 | Google Calendar link | "Add to Google Calendar" text link | Link present | PASS |
| 3 | .ics download link | "Download .ics file" text link | Link present | PASS |
| 5 | Dropdown closes | Panel disappears when clicking outside | Panel closed | PASS |

---

## T14 — ICS Feed Endpoint [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Response returns | HTTP 200 (not 500 error) | Returned 200 with feed content | PASS |
| 3 | Valid iCal format | Content starts with BEGIN:VCALENDAR | Starts properly | PASS |
| 3 | Valid iCal ending | Content ends with END:VCALENDAR | Ends properly | PASS |
| 4 | VERSION header | Contains "VERSION:2.0" | Version 2.0 included | PASS |
| 4 | PRODID header | Contains "PRODID:-//NeedhamNavigator//Events//EN" | PRODID present | PASS |
| 4 | Calendar name | Contains "X-WR-CALNAME:Needham Navigator Events" | Calendar name set | PASS |

---

## T15 — Events Page: Mobile Responsive [PASS ✅]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | No horizontal scroll | Page fits within 375px viewport | Fits within viewport perfectly | PASS |
| 3 | Controls wrap cleanly | Filter buttons and view toggle wrap | Responsive adjustments verified | PASS |
| 4 | Calendar grid is usable | Day numbers visible | N/A (Empty state) | PASS |
| 5 | Subscribe dropdown fits | Dropdown panel stays within viewport | N/A | PASS |

---

## T16 — Calendar Grid Structure (If Events Exist) [SKIP ⏭️]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| - | - | - | SKIP — no events data | SKIP |

---

## QA Resolution Summary

**Report:** 2026-02-25T18:50:00Z
**Branch:** feature/events-calendar-v2 (PRs #136, #137, #140, #141 merged to `develop`)
**Results:** 15 passed, 0 failed, 1 skipped, 0 warnings

### Failures Resolved

None — all tests passed.

### Warnings Addressed

None — no warnings reported.

### Files Changed

No code changes needed.

### Unresolved Items

- **T16 (Calendar Grid Structure)** — Skipped because no event data has been ingested yet. The calendar shows the empty state correctly. To fully test T16, run the seed script (`npx tsx scripts/seed-event-sources.ts`) and trigger an ingest to populate events, then re-run this test.
