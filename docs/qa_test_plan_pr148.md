# QA Test Plan — Transit Timezone Fix + Preferred Stop Selector

## Setup
- Base URL: https://staging.needhamnavigator.com
- No dev server needed — testing against live staging deployment
- Browser timezone: Use your default timezone first, then test with override (see T7)

## What Changed
Transit times were displaying using UTC instead of Eastern time for the MBTA API filter and for all time display across transit, events, and community pages. A new shared timezone utility pins all times to America/New_York (handles EST/EDT). Additionally, a "My stop" dropdown was added to the transit page that saves the user's preferred Needham commuter rail stop in localStorage, filtering departures accordingly. The home page KPI widget also reads the preferred stop to show the next relevant departure.

## Tests

### T1 — Transit page loads with departure times
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Navigate to the transit page
2. Wait for data to load (skeleton should appear then resolve)
3. Observe the "Upcoming Departures" section

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Page loads without error | No error state shown, schedule data appears |
| 3 | Departure times are displayed | Times shown in format like "2:30 PM" (12-hour, Eastern) |
| 3 | Stop names are shown | Each row shows a station name (e.g., "Needham Heights", "Back Bay") |
| 3 | Direction labels shown | Each row shows "Inbound" or "Outbound" |

**Screenshot:** Capture as `t1_transit_page_departures.png` after data loads

---

### T2 — Stop selector dropdown appears and is populated
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Navigate to the transit page and wait for data to load
2. Look for the "My stop:" label with a dropdown/select element above the departures list
3. Click the dropdown to expand it
4. Check the options listed

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Stop selector is visible | A MapPin icon, "My stop:" label, and `<select>` dropdown are shown |
| 3 | Dropdown has options | "All Stops" is the first/default option |
| 4 | Stops are alphabetically sorted | Station names appear in A-Z order |
| 4 | Needham stops are present | Should include Needham Heights, Needham Center, Needham Junction at minimum |

**Screenshot:** Capture as `t2_stop_selector_dropdown.png` with dropdown expanded

---

### T3 — Selecting a preferred stop filters departures
**Category:** UI + Interaction
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Navigate to the transit page and wait for data to load
2. Note the total number of departure rows shown
3. Select a specific stop (e.g., "Needham Heights") from the "My stop:" dropdown
4. Observe the departure list updates
5. Check that only departures from the selected stop are shown

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Dropdown value changes | Selected stop name appears in the dropdown |
| 4 | List filters immediately | Fewer rows shown than "All Stops" view |
| 5 | All visible rows match selected stop | Every departure row shows the stop name you selected |

**Screenshot:** Capture as `t3_filtered_by_stop.png` after selecting a specific stop

---

### T4 — Preferred stop persists after page refresh
**Category:** UI + localStorage
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Navigate to the transit page
2. Select a specific stop (e.g., "Needham Center") from the dropdown
3. Hard-refresh the page (Ctrl/Cmd+Shift+R)
4. Wait for data to load
5. Check the dropdown value and the displayed departures

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 5 | Dropdown shows previously selected stop | "Needham Center" (or whichever was selected) is pre-selected |
| 5 | Departures are filtered | Only departures from the saved stop are shown |

**Screenshot:** Capture as `t4_stop_persists_refresh.png` after refresh

---

### T5 — Resetting to "All Stops" clears preference
**Category:** UI + localStorage
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. With a preferred stop already selected (from T4), navigate to the transit page
2. Change the dropdown back to "All Stops"
3. Verify all departures reappear
4. Open browser DevTools > Application > Local Storage
5. Check that `nn_preferred_stop` key is removed

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Dropdown shows "All Stops" | Default option selected |
| 3 | Full departure list returns | All stops visible again, more rows than filtered view |
| 5 | localStorage cleared | `nn_preferred_stop` key does not exist (or is removed) |

**Screenshot:** Capture as `t5_all_stops_reset.png` showing all departures

---

### T6 — KPI widget shows preferred stop departure
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. First, go to `/needham/transit` and select a specific stop (e.g., "Needham Heights")
2. Navigate to the home page at `/needham`
3. Find the "Commuter Rail" KPI widget card (in the "Right Now in Needham" section)
4. Observe the time, stop name, and direction shown

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | KPI widget is visible | "Commuter Rail" card with train icon appears |
| 4 | Time is shown in Eastern format | Time like "2:30 PM" (not UTC, not 24-hour) |
| 4 | Stop name appears in subtitle | Text shows "Next train · Needham Heights · Inbound" (or similar with direction) |
| 4 | Direction is shown | "Inbound" or "Outbound" appears in the subtitle |

**Screenshot:** Capture as `t6_kpi_preferred_stop.png` showing the KPI widget

---

### T7 — Times show Eastern regardless of browser timezone
**Category:** UI + Timezone
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Open browser DevTools
2. Press Ctrl/Cmd+Shift+P, type "timezone", select "Override timezone" and set to "America/Los_Angeles" (Pacific)
3. Navigate to the transit page
4. Compare displayed times with those shown on https://www.mbta.com/schedules/CR-Needham
5. Verify times match Eastern timezone (not Pacific — should NOT be 3 hours behind)

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 4 | Times match MBTA.com | Departure times on the page should match MBTA.com's Needham line schedule |
| 5 | Times are in Eastern | e.g., if MBTA.com says 5:30 PM, the page also says 5:30 PM (not 2:30 PM Pacific) |

**Screenshot:** Capture as `t7_timezone_override_pacific.png` with DevTools timezone override visible

---

### T8 — Events page times display in Eastern timezone
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/events

**Steps:**
1. Navigate to the events page
2. Click on a day that has events (look for colored dots on the calendar)
3. Observe the event detail cards that appear below the calendar
4. Check the time display format on event cards

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Events display with time | Clock icon with time in "2:30 PM" format |
| 4 | Date format includes timezone-correct date | Date like "Tue, Feb 25, 2026" matches the calendar day clicked |
| 4 | End time shown if available | Format like "2:30 PM – 4:00 PM" for events with end times |

**Screenshot:** Capture as `t8_events_eastern_time.png` showing event cards with times

---

### T9 — Community page event times in Eastern
**Category:** UI
**URL:** https://staging.needhamnavigator.com/needham/community

**Steps:**
1. Navigate to the community page
2. Scroll to the Events section (should show upcoming events)
3. Check time formatting on event items

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 2 | Events section is visible | Events are listed with titles and timestamps |
| 3 | Times are in AM/PM format | Times shown as "2:30 PM" style (Eastern) |

**Screenshot:** Capture as `t9_community_event_times.png` showing the events section

---

### T10 — Transit page empty state with filtered stop
**Category:** UI + Edge case
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Navigate to the transit page
2. Select a stop that may have no upcoming departures (try a distant stop or test late at night)
3. Observe the empty state message

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Contextual empty message | Shows "No upcoming departures from this stop today." (NOT the generic "No upcoming departures found for today.") |

**Screenshot:** Capture as `t10_empty_state_filtered.png` if empty state is triggered

> Note: This test may not trigger if all stops have upcoming departures. If you can't trigger it, note as SKIP with explanation.

---

### T11 — Transit page mobile layout
**Category:** Mobile / Responsive
**URL:** https://staging.needhamnavigator.com/needham/transit

**Steps:**
1. Set browser viewport to 375x812 (iPhone SE / mobile)
2. Navigate to the transit page
3. Check that the stop selector dropdown fits within the viewport
4. Check that departure rows are readable and not truncated
5. Check that alert cards (if present) stack properly

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 3 | Stop selector fits | Dropdown does not overflow, label and select are visible |
| 4 | Departure rows readable | Stop name, direction, and time all visible without horizontal scroll |
| 5 | Alerts stack vertically | If alerts exist, they appear above the schedule in a single column |

**Screenshot:** Capture as `t11_transit_mobile.png` at 375x812 viewport

---

### T12 — KPI widget without preferred stop
**Category:** UI + Edge case
**URL:** https://staging.needhamnavigator.com/needham

**Steps:**
1. Open browser DevTools > Application > Local Storage
2. Delete the `nn_preferred_stop` key if it exists
3. Refresh the home page
4. Find the "Commuter Rail" KPI widget
5. Observe what departure it shows

**Assertions:**
| Step | Assertion | Expected |
|------|-----------|----------|
| 4 | KPI widget still shows a departure | Time displayed (falls back to first overall departure) |
| 5 | Subtitle says "Next train" | Shows "Next train · [stop name] · [direction]" with the first available stop |

**Screenshot:** Capture as `t12_kpi_no_preference.png` showing the fallback behavior

---

## Report Format

After running all tests, produce your report in EXACTLY this format:

### Summary Table
| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Transit page loads with departure times | PASS/FAIL | [count or —] |
| T2 | Stop selector dropdown appears and is populated | PASS/FAIL | [count or —] |
| T3 | Selecting a preferred stop filters departures | PASS/FAIL | [count or —] |
| T4 | Preferred stop persists after page refresh | PASS/FAIL | [count or —] |
| T5 | Resetting to "All Stops" clears preference | PASS/FAIL | [count or —] |
| T6 | KPI widget shows preferred stop departure | PASS/FAIL | [count or —] |
| T7 | Times show Eastern regardless of browser timezone | PASS/FAIL | [count or —] |
| T8 | Events page times display in Eastern timezone | PASS/FAIL | [count or —] |
| T9 | Community page event times in Eastern | PASS/FAIL | [count or —] |
| T10 | Transit page empty state with filtered stop | PASS/FAIL/SKIP | [count or —] |
| T11 | Transit page mobile layout | PASS/FAIL | [count or —] |
| T12 | KPI widget without preferred stop | PASS/FAIL | [count or —] |

### Per-Test Details

For each test, produce a section like this:

## T1 — Transit page loads with departure times [PASS emoji or FAIL emoji]

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | [assertion] | [expected] | [what you observed] | PASS/FAIL |

[If there are warnings, add them as blockquotes:]
> **Warning:** [description of the warning]

[If a screenshot was captured, embed it:]
![T1 — description](path/to/t1_transit_page_departures.png)

---

### Raw JSON

At the very end, include a machine-readable JSON block:

```json
{
  "run_timestamp": "[ISO 8601]",
  "base_url": "https://staging.needhamnavigator.com",
  "summary": {
    "total": 12,
    "passed": 0,
    "failed": 0,
    "warnings": 0
  },
  "tests": [
    {
      "id": "T1",
      "name": "Transit page loads with departure times",
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
      "warnings": ["[warning text if any]"],
      "screenshot_paths": ["[path if captured]"]
    }
  ]
}
```
