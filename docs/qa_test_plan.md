# QA Test Plan — Search Dedup, Mass.gov Query Expansion, Pipeline Health Dashboard, Events Calendar

## Setup
- Base URL: https://staging.needhamnavigator.com
- Admin password: required to access /admin (enter the admin password when prompted)
- No local dev server needed — all tests run against the live staging deployment
- Note: The events calendar may show "No events yet" if event data hasn't been ingested yet — this is expected and tested explicitly in T10

## What Changed
Four PRs were merged to `develop` (staging):
1. **Search dedup** — search results no longer show multiple chunks from the same page. Each URL appears only once.
2. **Mass.gov query expansion** — searches about building codes, property assessment, septic, conservation, etc. now include mass.gov results alongside local needhamma.gov content.
3. **Pipeline health dashboard** — new "Pipeline" tab in admin dashboard showing connector health, article generation stats, and content freshness KPIs.
4. **Events calendar** — full month-view calendar UI with source filters, view toggle, per-event "Add to Calendar" dropdown, and a subscribable iCal feed endpoint.

## Tests

### T1 — Search Dedup: No Duplicate Pages
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Navigate to the URL above
2. In the search bar, type "transfer station" and press Enter (or click search)
3. Wait for search results to load
4. Examine all result titles and their source URLs (shown as source pills/chips below each result)
5. Repeat with query "building permit"

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Search results appear | At least 2 results shown |
| 4 | No duplicate page URLs for "transfer station" | Each needhamma.gov URL appears at most once |
| 5 | No duplicate page URLs for "building permit" | Each needhamma.gov URL appears at most once |

**Screenshot:** Capture as `t1_search_dedup_transfer_station.png` after results for "transfer station" load. Capture `t1_search_dedup_building_permit.png` after "building permit" results load.

---

### T2 — Search Dedup: Result Count Still Reasonable
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Search for "zoning bylaws"
2. Count the number of search results returned
3. Search for "schools"
4. Count the number of search results returned

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Result count for "zoning bylaws" | At least 3 unique results |
| 4 | Result count for "schools" | At least 3 unique results |

**Screenshot:** Capture as `t2_search_count_zoning.png` after "zoning bylaws" results.

---

### T3 — Mass.gov Results Appear for Dual-Jurisdiction Queries
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Search for "building code requirements"
2. Examine the source domains in the results — look for mass.gov alongside needhamma.gov
3. Search for "septic system inspection"
4. Examine the source domains
5. Search for "property tax exemptions"
6. Examine the source domains

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | "building code requirements" includes mass.gov | At least one result from mass.gov domain |
| 4 | "septic system inspection" includes mass.gov | At least one result from mass.gov domain |
| 6 | "property tax exemptions" includes mass.gov | At least one result from mass.gov domain |

**Screenshot:** Capture as `t3_massgov_building_code.png` showing mass.gov result for "building code requirements".

---

### T4 — Mass.gov Results Do NOT Appear for Purely Local Queries
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Search for "transfer station hours"
2. Examine the source domains in the results
3. Search for "recycling schedule"
4. Examine the source domains

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | "transfer station hours" results | No mass.gov results — only needhamma.gov or local sources |
| 4 | "recycling schedule" results | No mass.gov results — only needhamma.gov or local sources |

**Screenshot:** Capture as `t4_local_only_transfer_station.png` showing results for "transfer station hours".

---

### T5 — Admin Pipeline Tab: Loads and Shows KPIs
**Category:** UI
**URL:** https://staging.needhamnavigator.com/admin

**Steps:**
1. Navigate to /admin
2. Enter the admin password when prompted
3. Click the "Pipeline" tab in the tab bar
4. Observe the KPI cards at the top (Pipeline Status, Total Content, Items Last 24h, Items Last 7d)
5. Scroll down to see the "Connectors" section

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | "Pipeline" tab exists in the tab bar | Tab visible with a Zap icon |
| 4 | KPI cards render | 4 cards showing: Pipeline Status (text), Total Content (number), Items Last 24h (number), Items Last 7d (number) |
| 5 | Connectors section renders | Table with columns: Source, Type, Category, Schedule, Last Fetched, Errors, Status |

**Screenshot:** Capture as `t5_pipeline_tab_kpis.png` showing the full Pipeline tab view.

---

### T6 — Admin Pipeline Tab: Connector Health Badges
**Category:** UI
**URL:** https://staging.needhamnavigator.com/admin

**Steps:**
1. Navigate to /admin → Pipeline tab (if not already there)
2. Examine the connectors table
3. Look for connectors with status badges (healthy = green, warning = yellow, error = red, disabled = gray, never_run = gray)
4. Verify that disabled connectors (library-events, school-calendar) show "disabled" status, not "error"

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Connectors table has rows | At least 5 connector rows visible |
| 3 | Each connector has a colored status badge | Badges show one of: Healthy, Warning, Error, Disabled, Never Run |
| 4 | "needham:library-events" shows Disabled | Gray "Disabled" badge (not red "Error") |
| 4 | "needham:school-calendar" shows Disabled | Gray "Disabled" badge (not red "Error") |

**Screenshot:** Capture as `t6_pipeline_connectors.png` showing the full connectors table.

---

### T7 — Admin Pipeline Tab: Article Generation Stats
**Category:** UI
**URL:** https://staging.needhamnavigator.com/admin

**Steps:**
1. On the Pipeline tab, scroll down past the connectors table
2. Look for "Article Generation" section
3. Verify it shows articles_today count, articles_this_week count, and last daily brief timestamp

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Article Generation section exists | Section heading visible below connectors |
| 3 | Three stats shown | "Articles Today" (number), "Articles This Week" (number), "Last Daily Brief" (date or "—") |

**Screenshot:** Capture as `t7_pipeline_articles.png` showing article generation stats.

---

### T8 — Events Page: Calendar UI Renders
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Navigate to /needham/events
2. Observe the page header (should show "Needham Events" with a calendar icon)
3. Observe the controls bar: month navigation (< month year >), Today button, source filter buttons (All, Town, Library, Schools), view toggle (grid/list icons), Subscribe button
4. Observe the main content area — either a calendar grid or "No events yet" empty state

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Page header renders | "Needham Events" with purple gradient background |
| 3 | Month navigation present | Left arrow, current month/year text (e.g. "February 2026"), right arrow, "Today" button |
| 3 | Source filter buttons present | 4 buttons: "All", "Town", "Library", "Schools" |
| 3 | View toggle present | Two icon buttons (grid and list), grid selected by default |
| 3 | Subscribe button present | Button with RSS icon and text "Subscribe" |
| 4 | Content area shows calendar or empty state | Either a 7-column calendar grid OR a "No events yet" card |

**Screenshot:** Capture as `t8_events_page_full.png` showing the complete events page.

---

### T9 — Events Page: Month Navigation
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Note the currently displayed month/year
2. Click the right arrow (next month)
3. Verify the month label updates to the next month
4. Click the right arrow again
5. Click the left arrow (previous month) twice
6. Click the "Today" button

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Month label changes | Shows next month (e.g. February → March 2026) |
| 4 | Month advances again | Shows month after next |
| 5 | Goes back two months | Returns to the month from step 2 |
| 6 | Returns to current month | Shows the actual current month/year |

**Screenshot:** Capture as `t9_events_next_month.png` after clicking next month.

---

### T10 — Events Page: Empty State
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Navigate to /needham/events
2. If no events are ingested yet, verify the empty state renders properly
3. The empty state should show a grid icon, "No events yet" heading, and explanatory text

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Empty state card renders (if no events) | White card with border, centered content |
| 3 | Empty state text | Heading "No events yet" and subtext mentioning Town Calendar, Library, and Schools |

> **Note:** If events ARE present, skip this test and note "SKIP — events data present" in the report.

**Screenshot:** Capture as `t10_events_empty_state.png` if empty state is shown.

---

### T11 — Events Page: View Toggle (Month ↔ List)
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. On the events page, click the list view icon (right icon in the view toggle)
2. Observe the layout changes from grid to list
3. Click the grid view icon (left icon) to switch back

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 1 | List icon becomes active | List icon gets primary color background, grid icon becomes inactive |
| 2 | Content switches to list layout | If events exist: chronological event cards. If empty: empty state unchanged |
| 3 | Grid icon becomes active | Grid icon gets primary color background, returns to calendar grid |

**Screenshot:** Capture as `t11_events_list_view.png` while in list view.

---

### T12 — Events Page: Source Filter Buttons
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. On the events page, verify "All" filter is selected by default (filled primary color)
2. Click "Town" filter button
3. Verify "Town" becomes active and "All" becomes inactive
4. Click "All" to reset

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 1 | "All" is selected by default | "All" button has primary color fill |
| 2 | "Town" becomes active | "Town" button gets primary color fill |
| 3 | "All" deselects | "All" button returns to outlined/inactive style |
| 4 | "All" reselects | "All" button returns to primary color fill |

**Screenshot:** Capture as `t12_events_town_filter.png` with "Town" filter active.

---

### T13 — Events Page: Subscribe Dropdown
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Click the "Subscribe" button (RSS icon)
2. Observe the dropdown panel that appears
3. Verify it shows: title "Subscribe to Needham Events", description text, URL input field, Copy button, "Add to Google Calendar" link, "Download .ics file" link
4. Click the URL input field — verify it selects/highlights the URL text
5. Click outside the dropdown to close it

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Dropdown appears below Subscribe button | White panel with border and shadow |
| 3 | Contains subscribe URL | URL input shows `https://staging.needhamnavigator.com/api/events/ics?town=needham` |
| 3 | Copy button present | "Copy" button next to URL input |
| 3 | Google Calendar link | "Add to Google Calendar" text link |
| 3 | .ics download link | "Download .ics file (Apple Calendar / Outlook)" text link |
| 4 | URL input selects on click | Text in the input becomes highlighted/selected |
| 5 | Dropdown closes | Panel disappears when clicking outside |

**Screenshot:** Capture as `t13_subscribe_dropdown.png` with dropdown open.

---

### T14 — ICS Feed Endpoint Returns Valid Calendar
**Category:** API
**URL:** https://staging.needhamnavigator.com/api/events/ics?town=needham

**Steps:**
1. Navigate directly to the URL above in the browser
2. Observe: either a file download triggers OR the browser displays text/calendar content
3. Examine the content — it should start with "BEGIN:VCALENDAR" and end with "END:VCALENDAR"
4. Verify required iCal headers: VERSION:2.0, PRODID, CALSCALE:GREGORIAN, X-WR-CALNAME

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Response returns | HTTP 200 (not 500 error) |
| 3 | Valid iCal format | Content starts with BEGIN:VCALENDAR |
| 3 | Valid iCal ending | Content ends with END:VCALENDAR |
| 4 | VERSION header | Contains "VERSION:2.0" |
| 4 | PRODID header | Contains "PRODID:-//NeedhamNavigator//Events//EN" |
| 4 | Calendar name | Contains "X-WR-CALNAME:Needham Navigator Events" |

**Screenshot:** Capture as `t14_ics_feed_response.png` showing the raw iCal content or download dialog.

---

### T15 — Events Page: Mobile Responsive
**Category:** Mobile / Visual
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Resize browser to mobile viewport (375x812) or use DevTools device emulation (iPhone 14)
2. Verify the events page renders without horizontal overflow
3. Verify the controls bar wraps gracefully (filter buttons may wrap to a second row)
4. Verify the calendar grid cells are smaller but still show day numbers and event dots
5. Verify the Subscribe dropdown doesn't overflow off-screen

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | No horizontal scroll | Page fits within 375px viewport |
| 3 | Controls wrap cleanly | Filter buttons and view toggle wrap to new rows without overlapping |
| 4 | Calendar grid is usable | Day numbers visible, cells are tappable |
| 5 | Subscribe dropdown fits | Dropdown panel stays within viewport bounds |

**Screenshot:** Capture as `t15_events_mobile.png` at 375x812 viewport.

---

### T16 — Events Page: Calendar Grid Structure (If Events Exist)
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. If events are present in the calendar, verify the grid structure
2. Check that day headers show Sun, Mon, Tue, Wed, Thu, Fri, Sat
3. Check that today's date has a colored circle highlight
4. If any day has events, check for colored event dots (purple = Town, blue = Library, green = Schools)
5. Click a day that has events — verify detail panel appears below the grid

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Day headers present | 7 column headers: Sun through Sat |
| 3 | Today highlighted | Today's date number has a filled circle background in the primary color |
| 4 | Event dots visible | Colored dots appear under day numbers that have events |
| 5 | Detail panel opens | Panel appears below grid showing event cards with date badge, source label, title, time |

> **Note:** If no events are present, skip this test and note "SKIP — no events data" in the report.

**Screenshot:** Capture as `t16_calendar_grid_detail.png` showing grid + detail panel for a selected day.

---

## Report Format

After running all tests, produce your report in EXACTLY this format:

### Summary Table
| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Search Dedup: No Duplicate Pages | PASS/FAIL | [count or —] |
| T2 | Search Dedup: Result Count Still Reasonable | PASS/FAIL | [count or —] |
| T3 | Mass.gov Results Appear for Dual-Jurisdiction | PASS/FAIL | [count or —] |
| T4 | Mass.gov Results Do NOT Appear for Local Queries | PASS/FAIL | [count or —] |
| T5 | Admin Pipeline Tab: KPIs | PASS/FAIL | [count or —] |
| T6 | Admin Pipeline Tab: Connector Health Badges | PASS/FAIL | [count or —] |
| T7 | Admin Pipeline Tab: Article Generation Stats | PASS/FAIL | [count or —] |
| T8 | Events Page: Calendar UI Renders | PASS/FAIL | [count or —] |
| T9 | Events Page: Month Navigation | PASS/FAIL | [count or —] |
| T10 | Events Page: Empty State | PASS/FAIL/SKIP | [count or —] |
| T11 | Events Page: View Toggle | PASS/FAIL | [count or —] |
| T12 | Events Page: Source Filter Buttons | PASS/FAIL | [count or —] |
| T13 | Events Page: Subscribe Dropdown | PASS/FAIL | [count or —] |
| T14 | ICS Feed Endpoint | PASS/FAIL | [count or —] |
| T15 | Events Page: Mobile Responsive | PASS/FAIL | [count or —] |
| T16 | Calendar Grid Structure (If Events Exist) | PASS/FAIL/SKIP | [count or —] |

### Per-Test Details

For each test, produce a section like this:

## T1 — Search Dedup: No Duplicate Pages [PASS ✅ or FAIL ❌]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Search results appear | At least 2 results shown | [what you observed] | PASS/FAIL |
| 4 | No duplicate URLs for "transfer station" | Each URL at most once | [what you observed] | PASS/FAIL |
| 5 | No duplicate URLs for "building permit" | Each URL at most once | [what you observed] | PASS/FAIL |

[If there are warnings, add them as blockquotes:]
> **Warning:** [description of the warning]

[If a screenshot was captured, embed it:]
![T1 — search dedup transfer station](path/to/t1_search_dedup_transfer_station.png)

---

### Raw JSON

At the very end, include a machine-readable JSON block:

```json
{
  "run_timestamp": "[ISO 8601]",
  "base_url": "https://staging.needhamnavigator.com",
  "summary": {
    "total": 16,
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "warnings": 0
  },
  "tests": [
    {
      "id": "T1",
      "name": "Search Dedup: No Duplicate Pages",
      "status": "pass|fail",
      "assertions": [
        {
          "step": 3,
          "description": "Search results appear",
          "status": "pass|fail",
          "expected": "At least 2 results shown",
          "actual": "[observed]"
        }
      ],
      "warnings": [],
      "screenshot_paths": ["t1_search_dedup_transfer_station.png"]
    }
  ]
}
```
