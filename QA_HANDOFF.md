# QA Test Plan — Library Events & Search UX Polish

## Setup
- Start dev server: `npx next dev -p 3000`
- Base URL: http://localhost:3000
- Town URL: http://localhost:3000/needham
- Test with Chrome DevTools open for responsive testing
- No special env vars needed — staging DB is already configured

## What Changed
Recent deployments added library events to the calendar (64 events from Needham Public Library), fixed a critical connector bug that was blocking content ingestion, and added a visual loading state for the search page. This QA pass validates the end-to-end user experience across search, events, and news content.

---

## Tests

### T1 — Chat Page Loads & Layout Stable
**Category:** UI / Visual
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Navigate to the chat page
2. Wait for page to fully load
3. Check the layout and main components
4. Verify no console errors (F12 → Console tab)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 1 | Page URL is correct | `/needham/chat` |
| 2 | Header with "Needham Navigator" text is visible | Present |
| 3 | Search input field is visible | Present and focused |
| 4 | Search button or submit is visible | Present |
| 5 | "Ask anything about Needham" placeholder text visible | Yes |
| 6 | No red error boxes or warnings on page | No errors |
| 7 | Page layout matches desktop viewport (not broken) | Yes |

**Screenshot:** Capture as `t1_chat_page_loaded.png` after page fully loads

---

### T2 — Search Loading State Displays
**Category:** UI / Interaction
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Navigate to chat page
2. Type a question in the search box: "what are library events this week"
3. Click search button or press Enter
4. Observe the page for 1-2 seconds BEFORE results appear (capture the loading state)
5. Wait for results to load fully

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Text appears in search box | "what are library events this week" |
| 4 | Loading skeleton or spinner appears | Yes, visible before results |
| 4 | "Searching..." message or similar visible | Present |
| 5 | Loading state disappears when results arrive | Yes |
| 5 | Result cards appear below search box | At least 1 result |
| 5 | No duplicate results | All unique titles |

**Screenshot:** Capture as `t2_search_loading_state.png` while loading skeleton/spinner visible

---

### T3 — Chat Search Results Quality (Local Question)
**Category:** API / Chat Functionality
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Navigate to chat page
2. Search for: "how do I renew my dog license"
3. Wait for results to load
4. Read the AI answer and check referenced sources

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | AI answer appears | 1-2 paragraph response |
| 3 | Answer mentions specific Needham process or website | Yes |
| 3 | At least 1 source link appears at bottom | Yes |
| 3 | Source links are clickable (hover shows pointer) | Yes |
| 3 | No "error" or "unable to answer" messages | No errors |
| 3 | Results mention dog licenses or animal control | Related to query |

**Screenshot:** Capture as `t3_dog_license_search.png` showing full answer and sources

---

### T4 — Chat Search Results Quality (State Question)
**Category:** API / Chat Functionality
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Navigate to chat page
2. Clear previous search (select all, delete)
3. Search for: "what is the massachusetts property tax rate"
4. Wait for results to load
5. Check if answer includes state-level information from mass.gov

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 4 | AI answer appears | 1-2 paragraph response |
| 4 | Answer mentions Massachusetts or state-level policy | Yes |
| 4 | Sources may include mass.gov | Expected for state question |
| 4 | No archive pages cited (e.g., /archive.aspx) | No archive URLs |
| 4 | Answer is factually reasonable | Yes |

**Screenshot:** Capture as `t4_state_property_tax_search.png`

---

### T5 — Events Page Displays Library Events
**Category:** UI / Content
**URL:** http://localhost:3000/needham/events

**Steps:**
1. Navigate to events page
2. Wait for page to load
3. Scroll down to see list of events
4. Look for library events in the list
5. Click on one library event to see details

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Page title says "Events" or "Needham Events" | Yes |
| 3 | Events list is visible | At least 10+ events |
| 3 | Library event titles appear (e.g., "Kids Coding Club", "Book Club") | Multiple library events |
| 3 | Event dates are in the future or near future | Not in past |
| 3 | Events show times and locations when available | Yes |
| 5 | Clicked event opens modal or detail view | Yes |
| 5 | Modal shows full event details (title, date, time, location, description) | All present |

**Screenshot:** Capture as `t5_events_page_library_events.png` showing event list

---

### T6 — Community Page Shows News Articles
**Category:** UI / Content
**URL:** http://localhost:3000/needham/community

**Steps:**
1. Navigate to community page
2. Wait for content to load
3. Scroll to find news section
4. Verify articles from Needham Observer, Needham Local, or Patch appear

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Page loads without errors | No 404 or error state |
| 3 | News articles section visible | Section with article cards |
| 3 | Article titles are displayed | Multiple articles visible |
| 3 | Article sources labeled (Observer, Local, Patch) | Source attribution present |
| 3 | Articles have publication dates | Dates shown |
| 3 | At least 5+ articles visible | Multiple sources contributing |

**Screenshot:** Capture as `t6_community_news_articles.png`

---

### T7 — Mobile Responsiveness (Chat Page)
**Category:** Mobile / Responsive
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Open DevTools (F12)
2. Click device toggle (top-left) to enable mobile mode
3. Select iPhone 12 or similar (375x812 viewport)
4. Navigate to chat page
5. Try a search on mobile
6. Check layout adapts correctly

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 4 | Chat page loads in mobile viewport | Yes |
| 4 | Search input is full-width and tappable | Yes |
| 4 | Header doesn't overflow | Fits mobile width |
| 5 | Results are readable on mobile | Single column, no horizontal scroll |
| 5 | Loading state visible on mobile | Skeleton displays well |
| 6 | Source links are tappable (large enough) | Button size ≥ 44px |

**Screenshot:** Capture as `t7_mobile_chat_375w.png` (in mobile viewport)

---

### T8 — Mobile Responsiveness (Events Page)
**Category:** Mobile / Responsive
**URL:** http://localhost:3000/needham/events

**Steps:**
1. Keep mobile DevTools open (375x812 viewport)
2. Navigate to events page
3. Scroll through event list
4. Tap on an event to open modal/details

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Events page loads in mobile viewport | Yes |
| 3 | Event cards are single-column on mobile | No side-by-side layout |
| 3 | Event titles and dates are readable | No text cutoff |
| 3 | No horizontal scroll | Content fits width |
| 4 | Modal opens and content is readable | All details visible |
| 4 | Close button (X) is easily tappable | Large enough to tap |

**Screenshot:** Capture as `t8_mobile_events_375w.png`

---

### T9 — Search with Special Characters & Edge Cases
**Category:** API / Robustness
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Navigate to chat page
2. Search for: "what about COVID-19 regulations?" (special chars, numbers)
3. Wait for results
4. Clear and try: "recycling" (simple word)
5. Clear and try: "1" (single digit)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Search with special chars works | Results appear or "no results" gracefully |
| 3 | No JavaScript errors in console | No red errors |
| 4 | Single-word query returns results | At least 1 result or "no results" message |
| 5 | Single digit query doesn't crash page | Graceful handling |
| 5 | All searches show loading state before results | Consistent UX |

**Screenshot:** Capture as `t9_edge_case_searches.png` showing one successful edge case

---

### T10 — No Archived Pages in Results
**Category:** Quality / Data Integrity
**URL:** http://localhost:3000/needham/chat

**Steps:**
1. Navigate to chat page
2. Perform 3 different searches:
   - "old documents"
   - "archive"
   - "town meetings 2023"
3. Examine all source links in results
4. Check that no links point to `/archive.aspx` or `/ArchiveCenter/`

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Searches return results | At least 1 result per search |
| 4 | No source links contain "archive" in URL | Clean results |
| 4 | All cited documents are current/relevant | No stale content |
| 4 | Results focus on current town info | Not historical data |

**Screenshot:** Capture as `t10_no_archive_pages.png` showing results with source links

---

## Report Format

After running all tests, please produce your report in the following format:

### Summary Table
| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Chat Page Loads & Layout Stable | PASS/FAIL | — |
| T2 | Search Loading State Displays | PASS/FAIL | — |
| T3 | Chat Search Results Quality (Local) | PASS/FAIL | — |
| T4 | Chat Search Results Quality (State) | PASS/FAIL | — |
| T5 | Events Page Displays Library Events | PASS/FAIL | — |
| T6 | Community Page Shows News Articles | PASS/FAIL | — |
| T7 | Mobile Responsiveness (Chat Page) | PASS/FAIL | — |
| T8 | Mobile Responsiveness (Events Page) | PASS/FAIL | — |
| T9 | Search with Special Characters | PASS/FAIL | — |
| T10 | No Archived Pages in Results | PASS/FAIL | — |

### Per-Test Details

For each test, produce a section like this:

## T1 — [Test Name] ✅ or ❌

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | [assertion] | [expected] | [what you observed] | PASS/FAIL |
| 2 | [assertion] | [expected] | [what you observed] | PASS/FAIL |

[If there are warnings:]
> **Warning:** [description of unexpected behavior, if any]

[Embed screenshot if captured:]
![T1 description](path/to/t1_screenshot.png)

---

### Raw JSON

At the very end, include:

```json
{
  "run_timestamp": "[ISO 8601 when you finished]",
  "base_url": "http://localhost:3000",
  "summary": {
    "total": 10,
    "passed": [number],
    "failed": [number],
    "warnings": [number]
  },
  "tests": [
    {
      "id": "T1",
      "name": "Chat Page Loads & Layout Stable",
      "status": "pass",
      "assertions": [
        {
          "step": 1,
          "description": "Page URL is correct",
          "status": "pass",
          "expected": "/needham/chat",
          "actual": "[what you saw]"
        }
      ],
      "warnings": [],
      "screenshot_paths": ["t1_chat_page_loaded.png"]
    }
  ]
}
```

---

## Notes for IDE Agent

- **No database seeding required** — content is already live in staging DB
- **Dev server should be running** on port 3000 before tests begin
- **Console errors are critical** — check DevTools Console for any red errors
- **Screenshot naming** — use exact format `tN_description.png` for tracking
- **Mobile testing** — toggle DevTools to device mode, select iPhone 12
- **If a test fails**, try again once. If it fails twice, mark as FAIL and move on.
- **Be thorough on search results** — check not just presence but relevance and accuracy
