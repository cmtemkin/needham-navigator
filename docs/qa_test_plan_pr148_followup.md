# QA Test Plan — PR 148 Follow-Up (Gap Coverage)

## Setup
- Base URL: https://staging.needhamnavigator.com
- No dev server needed — testing against live staging deployment
- **Pre-requisite:** This plan covers 3 tests that were INCONCLUSIVE or SKIPPED in the initial QA run because staging lacked event data or all stops had active departures.

## What Changed (Context from PR 148)
Transit times were pinned to Eastern timezone (`America/New_York`) across all pages. A shared `formatEasternTime()` utility replaced local `formatEventTime()` in both `EventDetailPanel.tsx` and `community/page.tsx`. The prior QA run confirmed transit/KPI/timezone changes work, but couldn't verify event time formatting because no events existed on staging.

## Strategy
- T8/T9 require events in the database. If the events page or community page still shows "No events", verify the code path by inspecting the page source for `formatEasternTime` usage, or check if the `/api/content?category=events` endpoint returns data.
- T10 requires finding or creating conditions where a filtered stop has no departures (easiest late at night ET, or pick an uncommon stop).

## Tests

### T1 — Events page time formatting (re-test of original T8)
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Navigate to the events page
2. If the calendar shows any days with colored dots, click one of those days
3. If no events appear on any day, switch to "List" view (if available) to see all upcoming events
4. If still no events visible, call the API directly: open a new tab and go to `https://staging.needhamnavigator.com/api/content?town_id=needham&category=events&limit=5`
5. If the API returns events with `metadata.event_start` fields, note the times. If it returns an empty array, record as INCONCLUSIVE with note "No event data on staging"
6. If events ARE visible on the page, check the time format on event cards (next to the clock icon)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 6 | Times use AM/PM format | Times like "7:00 PM", "10:30 AM" (not "19:00" or missing) |
| 6 | Date shown in Eastern | Date matches the calendar day clicked, formatted as "Tue, Feb 25, 2026" |
| 6 | End times shown when available | If event has end time, format is "7:00 PM – 9:00 PM" |

**Screenshot:** Capture as `t1_events_time_format.png` — capture the event cards if visible, or the API response if no UI events exist

---

### T2 — Community page event time formatting (re-test of original T9)
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/community

**Steps:**
1. Navigate to the community page
2. Scroll down to the "Upcoming Events" section
3. If events are listed, check the time formatting next to the clock icon on each event card
4. If the section shows "No events listed yet. Check back soon!" with an "Ask About Events" button, record as INCONCLUSIVE
5. If events ARE visible, verify times use Eastern AM/PM format

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Clock icon + time visible | Each event shows a clock icon with time like "7:00 PM" |
| 5 | Times are Eastern, not UTC | If an event is scheduled for 7 PM ET, it shows "7:00 PM" (not "12:00 AM" next day or similar UTC artifact) |

**Screenshot:** Capture as `t2_community_event_times.png` — capture the events section whether it has data or shows the empty state

---

### T3 — Transit filtered empty state (re-test of original T10)
**Category:** UI + Edge case
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Navigate to the transit page and wait for data to load
2. Note the current Eastern time (check the departure times displayed to infer)
3. Look at the stop selector dropdown — try to identify a stop that appears to have very few departures (look for stops that appear infrequently in the "All Stops" list)
4. Select that stop from the "My stop:" dropdown
5. If the departures list becomes empty, check the message text
6. If you cannot find a stop with zero departures, try this alternative: Open DevTools Console and run `localStorage.setItem('nn_preferred_stop', 'place-fake-stop-id')` then refresh the page — this sets a non-existent stop ID which should trigger the filtered empty state
7. After the page reloads with the fake stop ID, observe the departures section

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 5 or 7 | Empty state message is contextual | Shows "No upcoming departures from this stop today." |
| 5 or 7 | Message is NOT the generic one | Does NOT say "No upcoming departures found for today." |
| 5 or 7 | Stop selector still visible | The "My stop:" dropdown remains visible even when no results |

**Screenshot:** Capture as `t3_empty_state_filtered.png` when the empty state is triggered

> **Important:** After this test, clean up by running `localStorage.removeItem('nn_preferred_stop')` in the DevTools Console, then refresh.

---

## Report Format

After running all tests, produce your report in EXACTLY this format:

### Summary Table
| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Events page time formatting | PASS/FAIL/INCONCLUSIVE | [count or —] |
| T2 | Community page event times | PASS/FAIL/INCONCLUSIVE | [count or —] |
| T3 | Transit filtered empty state | PASS/FAIL | [count or —] |

### Per-Test Details

For each test, produce a section like this:

## T1 — Events page time formatting [PASS emoji or FAIL emoji or INCONCLUSIVE]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | [assertion] | [expected] | [what you observed] | PASS/FAIL |

[If there are warnings, add them as blockquotes:]
> **Warning:** [description of the warning]

[If a screenshot was captured, embed it:]
![T1 — description](path/to/t1_events_time_format.png)

---

### Raw JSON

At the very end, include a machine-readable JSON block:

```json
{
  "run_timestamp": "[ISO 8601]",
  "base_url": "https://staging.needhamnavigator.com",
  "summary": {
    "total": 3,
    "passed": 0,
    "failed": 0,
    "inconclusive": 0,
    "warnings": 0
  },
  "tests": [
    {
      "id": "T1",
      "name": "Events page time formatting",
      "status": "pass|fail|inconclusive",
      "assertions": [
        {
          "step": 1,
          "description": "[assertion text]",
          "status": "pass|fail",
          "expected": "[expected]",
          "actual": "[observed]"
        }
      ],
      "warnings": ["[warning text if any]"],
      "screenshot_paths": ["[path if captured]"]
    }
  ]
}
```
