# QA Test Plan — PR #143: Security Cleanup, SonarCloud Fixes, and Duplicate Search Bar

## Setup
- **Base URL:** https://staging.needhamnavigator.com
- **Town slug:** `needham`
- No env vars or seed data needed — this is a staging deployment test.
- Changes are already merged to `develop` and deployed to staging.

## What Changed
This PR fixes 12 CodeQL security alerts (SSRF, log injection, URL sanitization, iCal injection), ~70 SonarCloud code quality issues (`.replace()` → `.replaceAll()`, `Readonly<>` props, nested ternaries, `globalThis`), and a UX bug where two overlapping search bars appeared on the homepage. The changes span 28 files across API routes, UI components, utility libraries, and a service worker. All changes are behavioral no-ops except the homepage search bar fix and the iCal escape ordering fix.

## Tests

### T1 — Homepage: Single Search Bar (No Duplicate)
**Category:** UI / Visual
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Navigate to the homepage URL
2. Observe the hero section with the large search bar
3. Verify there is only ONE search bar visible on the page (the hero search bar)
4. Verify the Header at the top does NOT show a second search bar
5. Type "permits" into the hero search bar and press Enter
6. Observe that the page transitions to search results mode
7. Verify a sticky search bar appears below the Header (not overlapping the Header)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Hero search bar is visible | Large centered search input in the gradient hero section |
| 3 | Only one search bar on page | No second search bar in the header area |
| 4 | Header search bar is hidden | Header shows logo, nav links, but NO search input |
| 6 | Search results appear | Results list visible below a sticky search bar |
| 7 | Sticky search bar positioning | Search bar sits BELOW the header with a visible gap (~60px from top), not overlapping |

**Screenshot:** Capture as `t1_homepage_single_search_bar.png` after step 4 (before searching)
**Screenshot:** Capture as `t1_sticky_search_bar_position.png` after step 7 (showing results mode)

---

### T2 — Homepage: Sticky Search Bar Scroll Behavior
**Category:** UI / Visual
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Navigate to the homepage
2. Type "trash recycling" and press Enter to trigger search
3. Scroll down through the results
4. Verify the sticky search bar remains visible and does NOT overlap the Header
5. Verify the Header remains at the very top (z-index higher)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Sticky bar stays visible on scroll | Search bar with the query stays pinned below the header |
| 4 | No visual overlap | Clear separation between header (top) and sticky search bar (below header) |
| 5 | Header stays on top | Header is visually above the sticky search bar at all times |

**Screenshot:** Capture as `t2_sticky_scroll_no_overlap.png` after scrolling down ~500px

---

### T3 — Chat: Streaming Response Still Works
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham/chat

**Steps:**
1. Navigate to the chat page
2. Type "How do I get a building permit in Needham?" and send
3. Observe the response streaming in (typing animation, then text appears incrementally)
4. Verify the AI response includes bold text formatting (rendered as `<strong>`)
5. Verify source chips appear below the answer
6. Verify the confidence badge appears
7. Verify the AI disclaimer text appears on the first AI message

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Response streams in | Text appears incrementally, not all at once |
| 4 | Bold text rendered | Words like permit types or department names are bold |
| 5 | Source chips visible | At least 1 source chip with a title and link |
| 6 | Confidence badge visible | Badge shows "high", "medium", or "low" |
| 7 | AI disclaimer visible | Text like "AI answers may not be current" below the message |

**Screenshot:** Capture as `t3_chat_response_complete.png` after the full response renders

---

### T4 — Search Results: No Duplicate Titles
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Navigate to the homepage
2. Search for "transfer station"
3. Observe the search results
4. Check that there are no duplicate result titles (same page appearing twice)
5. Verify result snippets display correctly (no raw markdown `**bold**` or `[link](url)`)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Results appear | At least 2 results related to transfer station |
| 4 | No duplicate titles | Each result has a unique title (dedup working) |
| 5 | Clean snippets | No `**`, `#`, `[text](url)` markdown artifacts in snippets |

**Screenshot:** Capture as `t4_search_results_transfer_station.png` after results load

---

### T5 — Calendar: Events Load and Display
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham/calendar

**Steps:**
1. Navigate to the calendar page
2. Wait for events to load (spinner should appear then disappear)
3. Verify the month grid is visible with the current month
4. Click on a date cell that has event dots
5. Verify the event detail panel appears below the grid
6. Verify each event shows: title, date/time, source badge
7. Switch to List View using the toggle button
8. Verify events display in a sorted list format

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Events load | Spinner disappears, calendar grid is populated |
| 3 | Current month shown | Month/year header matches today's date |
| 5 | Detail panel appears | Panel shows events for the selected date |
| 6 | Event cards correct | Title, date badge, time, source label all visible |
| 7 | List view toggle | Clicking the List icon switches to list layout |
| 8 | List view sorted | Events sorted by date, future events only |

**Screenshot:** Capture as `t5_calendar_month_view.png` after step 4
**Screenshot:** Capture as `t5_calendar_list_view.png` after step 8

---

### T6 — Calendar: Add to Calendar / Subscribe
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham/calendar

**Steps:**
1. Navigate to the calendar page and wait for events to load
2. Click on a date with events, then find the "Add to Calendar" dropdown on an event
3. Click "Add to Calendar" and verify the dropdown shows Google Calendar and Download .ics options
4. Click "Download .ics" — verify a `.ics` file downloads (check filename is reasonable, not garbled)
5. Click the "Subscribe" button in the controls bar
6. Verify the subscribe popup shows a URL ending in `/api/events/ics?town=needham`
7. Click "Copy" — verify the URL is copied to clipboard

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Dropdown appears | Shows "Google Calendar" link and "Download .ics" option |
| 4 | ICS file downloads | File has `.ics` extension, filename derived from event title |
| 5 | Subscribe popup opens | Popup with URL input and Copy button |
| 6 | Subscribe URL correct | URL contains `/api/events/ics?town=needham` |
| 7 | Copy works | Button click copies URL (popup may close) |

**Screenshot:** Capture as `t6_add_to_calendar_dropdown.png` at step 3

---

### T7 — Articles / News Page: Loading Skeletons and Filters
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham/articles

**Steps:**
1. Navigate to the articles page
2. Observe the loading state — should show 6 skeleton placeholders (not empty screen)
3. After loading completes, verify articles/content items display
4. Type "school" in the keyword search filter
5. Verify the list filters to show only items matching "school"
6. Click the "This Week" date filter
7. Verify the "Clear Filters" button appears if no results match

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Skeleton loading state | 6 shimmer/placeholder cards visible during load |
| 3 | Articles render | At least 1 article or content card with title, snippet, source badge |
| 4 | Keyword filter works | Typing "school" shows only school-related items |
| 5 | Filtered count updates | "X of Y items (filtered)" text visible |
| 6 | Date filter works | Results further filtered by date range |

**Screenshot:** Capture as `t7_articles_loading_skeleton.png` during step 2 (quickly, before load completes)
**Screenshot:** Capture as `t7_articles_filtered.png` after step 5

---

### T8 — Community Page: Phone Number Links
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham/community

**Steps:**
1. Navigate to the community page
2. Scroll to the Emergency Contacts section
3. Verify Police Department phone number is displayed
4. Inspect the phone link `href` attribute — should be `tel:` followed by digits only (no parentheses, dashes, or spaces)
5. Verify Fire Department phone number link has the same clean `tel:` format

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Police phone visible | Phone number displayed like "(781) 455-7570" |
| 4 | Police tel link clean | `href` is `tel:7814557570` (digits only) |
| 5 | Fire tel link clean | `href` is `tel:` followed by digits only |

**Screenshot:** Capture as `t8_community_phone_links.png` showing the emergency contacts section

---

### T9 — Live Widgets: Weather and Transit
**Category:** UI / Functional
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Navigate to the homepage
2. Scroll down to the "Right Now in Needham" section with live widgets
3. Verify the Weather widget shows current temperature, forecast, and wind
4. Verify the Transit widget shows next departure time (or "No departures" if none)
5. If transit has alerts, verify the alert count shows correctly (e.g., "1 Alert" not "1 Alerts", "2 Alerts" not "2 Alert")
6. If transit has a stop name, verify it appears after "Next train · [stop name]"

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Weather widget renders | Temperature, forecast text, wind info, "Live" badge |
| 4 | Transit widget renders | Next departure time or "No departures" message |
| 5 | Alert pluralization correct | "1 Alert" (singular) or "2 Alerts" (plural) |
| 6 | Stop name displays | If present, shows "Next train · [StopName]" |

**Screenshot:** Capture as `t9_live_widgets.png` showing the widget section

---

### T10 — Releases Page: Markdown Stripped
**Category:** UI / Visual
**URL:** https://staging.needhamnavigator.com/needham/releases

**Steps:**
1. Navigate to the releases page
2. Verify release notes render with clean text — no raw markdown artifacts
3. Check that bold text (`**text**`) is stripped/rendered properly
4. Check that links (`[text](url)`) show as plain text or rendered links, not raw markdown

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Clean text rendering | No `**`, `#`, backticks, or `[text](url)` visible in text |
| 3 | Bold text handled | Either rendered bold or stripped to plain text |
| 4 | Links handled | Shown as plain text or clickable links |

**Screenshot:** Capture as `t10_releases_page.png` showing at least one release entry

---

### T11 — Service Worker: Offline Fallback
**Category:** Config / Functional
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Navigate to the homepage (ensure service worker registers)
2. Open DevTools → Application → Service Workers
3. Verify the service worker is registered and active (no errors in console about `globalThis`)
4. Check the Console tab for any JavaScript errors related to `self is not defined` or service worker failures

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | SW registered | Service worker shows as "activated and running" |
| 4 | No JS errors | No errors mentioning `self`, `globalThis`, or service worker in console |

**Screenshot:** Capture as `t11_service_worker_status.png` showing the Service Workers panel

---

### T12 — Calendar: Event Detail Panel Pluralization
**Category:** UI / Visual
**URL:** https://staging.needhamnavigator.com/needham/calendar

**Steps:**
1. Navigate to the calendar page
2. Click on a date with exactly 1 event
3. Verify the header says "(1 event)" — NOT "(1 events)"
4. Click on a date with 2+ events
5. Verify the header says "(N events)" with the "s"

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Singular form | "(1 event)" — no trailing "s" |
| 5 | Plural form | "(2 events)", "(3 events)", etc. — with "s" |

**Screenshot:** Capture as `t12_event_count_singular.png` at step 3 (if a 1-event date exists)

---

### T13 — Mobile Viewport: Homepage Search Bar
**Category:** Mobile / Visual
**URL:** https://staging.needhamnavigator.com/needham
**Viewport:** 375x812 (iPhone)

**Steps:**
1. Set viewport to 375x812
2. Navigate to the homepage
3. Verify only ONE search bar is visible (hero search bar)
4. Type "taxes" and search
5. Verify the sticky search bar appears below the header without overlap
6. Verify results are readable and not clipped

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Single search bar on mobile | No duplicate search bars |
| 5 | Sticky bar below header | Clear visual separation, no overlap |
| 6 | Results readable | Text not truncated, cards stack vertically |

**Screenshot:** Capture as `t13_mobile_homepage.png` after step 3
**Screenshot:** Capture as `t13_mobile_search_results.png` after step 5

---

## Report Format

After running all tests, produce your report in EXACTLY this format:

### Summary Table
| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Homepage: Single Search Bar | PASS/FAIL | [count or —] |
| T2 | Sticky Search Bar Scroll | PASS/FAIL | [count or —] |
| T3 | Chat: Streaming Response | PASS/FAIL | [count or —] |
| T4 | Search: No Duplicate Titles | PASS/FAIL | [count or —] |
| T5 | Calendar: Events Display | PASS/FAIL | [count or —] |
| T6 | Calendar: Add to Calendar | PASS/FAIL | [count or —] |
| T7 | Articles: Skeletons & Filters | PASS/FAIL | [count or —] |
| T8 | Community: Phone Links | PASS/FAIL | [count or —] |
| T9 | Live Widgets | PASS/FAIL | [count or —] |
| T10 | Releases: Markdown Stripped | PASS/FAIL | [count or —] |
| T11 | Service Worker | PASS/FAIL | [count or —] |
| T12 | Calendar: Pluralization | PASS/FAIL | [count or —] |
| T13 | Mobile: Homepage Search | PASS/FAIL | [count or —] |

### Per-Test Details

For each test, produce a section like this:

## T1 — Homepage: Single Search Bar [PASS or FAIL emoji]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | [assertion] | [expected] | [what you observed] | PASS/FAIL |

[If there are warnings, add them as blockquotes:]
> **Warning:** [description of the warning]

[If a screenshot was captured, embed it:]
![T1 — description](path/to/t1_description.png)

---

### Raw JSON

At the very end, include a machine-readable JSON block:

```json
{
  "run_timestamp": "[ISO 8601]",
  "base_url": "https://staging.needhamnavigator.com",
  "summary": {
    "total": 13,
    "passed": 0,
    "failed": 0,
    "warnings": 0
  },
  "tests": [
    {
      "id": "T1",
      "name": "Homepage: Single Search Bar",
      "status": "pass|fail",
      "assertions": [
        {
          "step": 1,
          "description": "[assertion text]",
          "status": "pass|fail",
          "expected": "[expected]",
          "actual": "[observed]"
        }
      ],
      "warnings": [],
      "screenshot_paths": []
    }
  ]
}
```
