# QA Report — Design System Extraction (Visual Regression)

**Run:** 2026-02-24T20:32:35-05:00  
**Base URL:** https://dev.charlie-temkin.com  
**Scope:** Zero-visual-change DRY refactor — TagChip, DetailSectionHeading, SectionWrapper extraction + FeaturedCard → ProjectCard `variant="featured"`

---

## Summary Table

| # | Test | Status | Warnings |
|---|------|--------|----------|
| T1 | Homepage Sections Layout | ✅ PASS | — |
| T2 | Homepage Featured Cards | ✅ PASS | — |
| T3 | Media Page Featured Card + Grid | ⚠️ FAIL | 1 |
| T4 | Apps Page Featured Card | ✅ PASS | — |
| T5 | Video Page Featured Card | ✅ PASS | — |
| T6 | Writing Page Layout | ✅ PASS | — |
| T7 | Data Page Layout | ✅ PASS | — |
| T8 | App Detail Page Section Headings | ✅ PASS | — |
| T9 | YouTube Detail Page Section Headings | ✅ PASS | — |
| T10 | TikTok Detail Page | ✅ PASS | — |
| T11 | Writing Detail Page | ✅ PASS | — |
| T12 | Detail Page Hero Tags (All Types) | ✅ PASS | — |
| T13 | Mobile Responsive Check | ✅ PASS | — |

**12 PASS / 1 FAIL / 1 Warning**

---

## Per-Test Details

## T1 — Homepage Sections Layout ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | No console errors | No console errors | No console errors detected | ✅ PASS |
| 2 | Experience section consistent padding (~80px top/bottom) | ~80px top/bottom | 80px top/bottom, 32px left/right observed | ✅ PASS |
| 3 | About section has `id="about"` and proper spacing | Properly spaced & anchored | `id="about"` confirmed, 80px padding | ✅ PASS |
| 4 | Education section has tag chips as small gray rounded pills | `bg-bg-subtle` gray pills | Gray rounded pills with text ("Delta Tau Delta", "Order of the Omega") confirmed, `rgb(243, 244, 246)` background | ✅ PASS |

![T1 — Homepage Education Section (desktop 1280×800)](t1_homepage_sections_1771983250575.png)

![T1 — Homepage Mobile (375×812)](t1_homepage_mobile_1771983265339.png)

---

## T2 — Homepage Featured Cards ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Featured project cards render in scrollable row | Thumbnails, titles, descriptions visible | Cards render correctly with thumbnails and "View project" links | ✅ PASS |
| 3 | No purple/primary border on homepage cards | Standard card appearance | No purple border found; subtle standard border used | ✅ PASS |

![T2 — Homepage Featured Cards carousel](t2_homepage_featured_1771983284650.png)

---

## T3 — Media Page Featured Card + Grid ⚠️ FAIL

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | First card is visually distinct (featured variant) | Purple border, subtle gradient background | First card ("Why Mini Disc Failed") has purple border and gradient | ✅ PASS |
| 3 | Featured card border is purple/indigo | `border-primary` color visible | Purple border confirmed on featured card | ✅ PASS |
| 4 | "Featured" label appears above platform badge | Small uppercase purple text | "Featured" label in uppercase purple confirmed above "YouTube" badge | ✅ PASS |
| 5 | Non-featured cards have light gray borders | Standard `border-border` color | Gray borders observed on all other cards | ✅ PASS |
| 6 | Tag chips render on all cards | Small gray rounded pills on all cards | Tag chips only present on featured card; other cards show tags embedded in description text (hashtag style), not as separate pill chips | ❌ FAIL |

> **Warning:** Tag chips (`TagChip` component) appear to be rendering correctly only on the **featured card**. Non-featured media cards ([T3 scrolled view](t3_media_page_scrolled_1771983345405.png)) show tag text within the description rather than as separate styled pill components. This suggests either the `TagChip` extraction did not propagate to all card types on the Media page, or this was the pre-existing behavior for non-featured cards and the tagged data structure differs.

![T3 — Media page featuring featured card and grid](t3_media_page_1771983314242.png)

---

## T4 — Apps Page Featured Card ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Featured app card is visually distinct with purple border | Purple border, gradient background | "Needham Navigator" shows purple border and gradient background | ✅ PASS |
| 3 | Featured label shows "Featured — Live" | Label includes "Live" if app has external URL | "Featured — Live" label confirmed | ✅ PASS |
| 4 | Filter pills and sort dropdown visible | UI controls render properly | Filter pills and sort dropdown present and visible | ✅ PASS |
| 5 | Grid filters correctly on filter click | Cards update without errors | Clicking "Replit" filter correctly hid GitHub-only projects ("Needham Navigator") and showed only Replit projects | ✅ PASS |

![T4 — Apps page after clicking Replit filter](t4_apps_page_filtered_1771983492292.png)

---

## T5 — Video Page Featured Card ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Featured card shows YouTube thumbnail, purple border, "Featured" label | Image loads, purple border visible | Featured card confirmed: YouTube thumbnail, purple border, "Featured" label | ✅ PASS |
| 3 | Filter pills visible: All, YouTube, TikTok | Three filter options render | All three filter pills confirmed | ✅ PASS |
| 4 | Only TikTok videos show after clicking TikTok filter | Grid updates to show only TikTok content | After clicking TikTok, grid updated to show only TikTok videos (e.g., "Melania", "Diddy"); featured YouTube card correctly hidden | ✅ PASS |

![T5 — Video page after TikTok filter active](t5_video_page_filtered_1771983513544.png)

---

## T6 — Writing Page Layout ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | Page loads without errors | No console errors | No console errors | ✅ PASS |
| 2 | Content within 1100px max-width, ~80px vertical padding | Normal layout | 1100px max-width confirmed via JS; standard padding observed | ✅ PASS |
| 3 | Writing cards render with titles, descriptions, badges | Cards display properly | Compact cards with titles ("The Prompt Whisperer", "I Accidentally Went Viral"), descriptions, and badges (AI, Pop Culture, Tech History) | ✅ PASS |
| 4 | "More on Substack" button visible at bottom | Button renders and is clickable | "More on Substack" button confirmed at bottom | ✅ PASS |

![T6 — Writing page layout](t6_writing_page_1771984033230.png)

*(Note: T6 subagent screenshot file was captured but saved under the writing page path — the data above reflects confirmed observations.)*

---

## T7 — Data Page Layout ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 1 | Page loads without errors | No console errors | No console errors | ✅ PASS |
| 2 | Content within 1100px max-width, standard padding | Layout matches other pages | 1100px container confirmed; padding matches Writing page | ✅ PASS |
| 3 | Sort dropdown opens and reorders cards | Cards reorder properly | Changed to "Title A-Z": cards reordered alphabetically (first: "I Accidentally Went Viral") | ✅ PASS |

![T7 — Data page with sort applied](t7_data_page_1771983941262.png)

---

## T8 — App Detail Page Section Headings ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Section headings render with bottom border | Gray horizontal line under each heading | All h2 headings confirmed with `1px solid rgb(229, 231, 235)` border-bottom | ✅ PASS |
| 3 | Headings are font-semibold, ~1.3rem | Consistent heading style | `font-weight: 600`, `20.8px` (1.3rem) confirmed via JS | ✅ PASS |
| 4 | "More Like This" heading has same border + project cards below | Heading + card grid renders | "More Like This" heading uses same border style; project cards render below | ✅ PASS |

![T8 — App detail page section headings](t8_app_detail_1771984078409.png)

---

## T9 — YouTube Detail Page Section Headings ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | "About This Video" heading has bottom border | Consistent with other detail pages | Bottom border and `spaceGrotesk` heading font confirmed | ✅ PASS |
| 3 | Key Topics chips are larger bordered pills (from TechStack) | Bordered pills with semibold text, NOT small gray pills | Chips render as `8px 16px` padded bordered pills — distinct from TagChip | ✅ PASS |
| 4 | Related projects render with cards | Cards display properly | Related project cards render at bottom | ✅ PASS |

![T9 — YouTube detail page](t9_youtube_detail_1771984152692.png)

---

## T10 — TikTok Detail Page ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | "About This TikTok" heading has bottom border | Consistent heading style | Gray bottom border confirmed on heading | ✅ PASS |
| 3 | Hero section shows platform badge + tag pills as small gray rounded chips | TagChip components in hero | "TIKTOK" platform badge + "Pop Culture", "Commentary" small gray rounded chips confirmed | ✅ PASS |

![T10 — TikTok detail page hero](t10_tiktok_detail_1771984185647.png)

---

## T11 — Writing Detail Page ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | "About This Project" heading has bottom border | Consistent heading style | Bottom border on heading confirmed | ✅ PASS |
| 3 | Spotify embed iframe is visible | Audio player renders | Spotify embed iframe confirmed visible | ✅ PASS |
| 4 | "Read Full Article on Substack" CTA button visible | Purple button with arrow, clickable | Purple CTA button with arrow confirmed | ✅ PASS |

![T11 — Writing detail page](t11_writing_detail_1771984322946.png)

---

## T12 — Detail Page Hero Tags (All Types) ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 2 | Hero meta row shows badge + tags in flex-wrap row | Items wrap properly | Meta row with badges (GITHUB) and tag chips (Community, Live, Published) confirmed | ✅ PASS |
| 3 | Tag chips match card style: ~0.72rem, gray background, rounded | Pixel-identical to card tag chips | Small gray rounded pill style consistent with card chips | ✅ PASS |

![T12 — Hero meta row with tag chips](t12_hero_tags_1771984354178.png)

---

## T13 — Mobile Responsive Check ✅

| Step | Assertion | Expected | Actual | Status |
|------|-----------|----------|--------|--------|
| 3 | Cards stack in single column at 375px | No horizontal overflow | Single-column card layout confirmed on media page | ✅ PASS |
| 4 | Padding reduced on mobile | Less whitespace than desktop | Tighter padding observed; appropriate for mobile viewport | ✅ PASS |
| 6 | Detail page: headings, tags, content don't overflow | Everything fits within viewport | Section headings, tag chips, action buttons all render within bounds; no overflow | ✅ PASS |

![T13 — Mobile media page (375×812)](t13_mobile_media_1771984369603.png)

![T13 — Mobile detail page (375×812)](t13_mobile_detail_1771984379867.png)

---

## Raw JSON

```json
{
  "run_timestamp": "2026-02-25T01:32:35Z",
  "base_url": "https://dev.charlie-temkin.com",
  "summary": {
    "total": 13,
    "passed": 12,
    "failed": 1,
    "warnings": 1
  },
  "tests": [
    {
      "id": "T1",
      "name": "Homepage Sections Layout",
      "status": "pass",
      "assertions": [
        { "step": 1, "description": "No console errors", "status": "pass", "expected": "No console errors", "actual": "No console errors detected" },
        { "step": 2, "description": "Experience section ~80px vertical padding", "status": "pass", "expected": "~80px top/bottom", "actual": "80px top/bottom, 32px horizontal" },
        { "step": 3, "description": "About section id='about' and proper spacing", "status": "pass", "expected": "id=about, 80px padding", "actual": "id=about confirmed, 80px padding" },
        { "step": 4, "description": "Education tag chips as gray rounded pills", "status": "pass", "expected": "bg-bg-subtle gray pills", "actual": "Gray rounded pills with bg rgb(243,244,246)" }
      ],
      "warnings": [],
      "screenshot_paths": [
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t1_homepage_sections_1771983250575.png",
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t1_homepage_mobile_1771983265339.png"
      ]
    },
    {
      "id": "T2",
      "name": "Homepage Featured Cards",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Featured cards render in scrollable row", "status": "pass", "expected": "Thumbnails, titles, descriptions", "actual": "Cards render correctly with thumbnails and view links" },
        { "step": 3, "description": "No purple border on homepage cards", "status": "pass", "expected": "Standard card appearance", "actual": "No purple border; subtle standard borders only" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t2_homepage_featured_1771983284650.png"]
    },
    {
      "id": "T3",
      "name": "Media Page Featured Card + Grid",
      "status": "fail",
      "assertions": [
        { "step": 2, "description": "First card is visually distinct featured", "status": "pass", "expected": "Purple border, gradient background", "actual": "Purple border and gradient on first card confirmed" },
        { "step": 3, "description": "Featured card border is purple/indigo", "status": "pass", "expected": "border-primary color", "actual": "Purple border confirmed" },
        { "step": 4, "description": "Featured label above platform badge", "status": "pass", "expected": "Small uppercase purple 'Featured' text", "actual": "Featured label in uppercase purple above YouTube badge" },
        { "step": 5, "description": "Non-featured cards have light gray borders", "status": "pass", "expected": "Standard border-border color", "actual": "Gray borders on non-featured cards" },
        { "step": 6, "description": "Tag chips on all cards as gray rounded pills", "status": "fail", "expected": "Small gray rounded pills on all cards", "actual": "Tag chips present only on featured card; other cards display tags as inline description text, not as separate pill chips" }
      ],
      "warnings": ["Tag chips (TagChip component) appear only on the featured card. Non-featured media grid cards show tag text embedded in description rather than as pill components. Investigate whether non-featured MediaCard/ProjectCard renders TagChip or has a different tag display path."],
      "screenshot_paths": [
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t3_media_page_1771983314242.png",
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t3_media_page_scrolled_1771983345405.png"
      ]
    },
    {
      "id": "T4",
      "name": "Apps Page Featured Card",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Featured app card visually distinct", "status": "pass", "expected": "Purple border, gradient background", "actual": "Needham Navigator: purple border and gradient" },
        { "step": 3, "description": "Featured label shows 'Featured — Live'", "status": "pass", "expected": "Label includes 'Live'", "actual": "'Featured — Live' label confirmed" },
        { "step": 4, "description": "Filter pills and sort dropdown visible", "status": "pass", "expected": "UI controls render", "actual": "Filter pills and sort dropdown present" },
        { "step": 5, "description": "Grid filters correctly on click", "status": "pass", "expected": "Cards update without errors", "actual": "Replit filter correctly hid GitHub projects" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t4_apps_page_filtered_1771983492292.png"]
    },
    {
      "id": "T5",
      "name": "Video Page Featured Card",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Featured card has YouTube thumbnail, purple border, label", "status": "pass", "expected": "Image, purple border, Featured label", "actual": "All confirmed" },
        { "step": 3, "description": "Filter pills: All, YouTube, TikTok visible", "status": "pass", "expected": "Three filter options", "actual": "All three filter pills present" },
        { "step": 4, "description": "TikTok filter shows only TikTok content", "status": "pass", "expected": "Grid updates to TikTok only", "actual": "Featured YouTube card hidden; only TikTok cards shown" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t5_video_page_filtered_1771983513544.png"]
    },
    {
      "id": "T6",
      "name": "Writing Page Layout",
      "status": "pass",
      "assertions": [
        { "step": 1, "description": "Page loads without errors", "status": "pass", "expected": "No console errors", "actual": "No console errors" },
        { "step": 2, "description": "1100px max-width, ~80px vertical padding", "status": "pass", "expected": "Normal layout", "actual": "1100px confirmed via JS; standard padding" },
        { "step": 3, "description": "Writing cards render with titles, descriptions, badges", "status": "pass", "expected": "Cards display properly", "actual": "Compact cards with titles and category badges" },
        { "step": 4, "description": "'More on Substack' button at bottom", "status": "pass", "expected": "Button renders", "actual": "'More on Substack' confirmed at bottom" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t6_writing_page_1771984033230.png"]
    },
    {
      "id": "T7",
      "name": "Data Page Layout",
      "status": "pass",
      "assertions": [
        { "step": 1, "description": "Page loads without errors", "status": "pass", "expected": "No console errors", "actual": "No console errors" },
        { "step": 2, "description": "1100px max-width, standard padding", "status": "pass", "expected": "Layout matches other pages", "actual": "1100px container; padding matches Writing page" },
        { "step": 3, "description": "Sort dropdown reorders cards", "status": "pass", "expected": "Cards reorder properly", "actual": "Title A-Z sort applied; alphabetical order confirmed" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t7_data_page_1771983941262.png"]
    },
    {
      "id": "T8",
      "name": "App Detail Page Section Headings",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Section headings render with bottom border", "status": "pass", "expected": "Gray horizontal line under each", "actual": "1px solid rgb(229,231,235) border-bottom on all h2 headings" },
        { "step": 3, "description": "Headings are font-semibold, ~1.3rem", "status": "pass", "expected": "Consistent heading style", "actual": "font-weight:600, 20.8px (1.3rem) confirmed" },
        { "step": 4, "description": "'More Like This' heading same style + cards", "status": "pass", "expected": "Heading + card grid", "actual": "More Like This heading with border; project cards below" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t8_app_detail_1771984078409.png"]
    },
    {
      "id": "T9",
      "name": "YouTube Detail Page Section Headings",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "'About This Video' heading has bottom border", "status": "pass", "expected": "Consistent with other detail pages", "actual": "Bottom border and spaceGrotesk font confirmed" },
        { "step": 3, "description": "Key Topics as larger bordered pill chips", "status": "pass", "expected": "Bordered pills, semibold, NOT small gray pills", "actual": "8px 16px padded bordered pills; distinct from TagChip" },
        { "step": 4, "description": "Related projects render with cards", "status": "pass", "expected": "Cards display", "actual": "Project cards render at bottom" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t9_youtube_detail_1771984152692.png"]
    },
    {
      "id": "T10",
      "name": "TikTok Detail Page",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "'About This TikTok' heading has bottom border", "status": "pass", "expected": "Consistent heading style", "actual": "Gray bottom border on heading confirmed" },
        { "step": 3, "description": "Hero shows platform badge + gray rounded tag chips", "status": "pass", "expected": "TagChip components", "actual": "'TIKTOK' badge + 'Pop Culture', 'Commentary' small gray rounded chips" }
      ],
      "warnings": [],
      "screenshot_paths": [
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t10_tiktok_detail_1771984185647.png",
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t10_tiktok_hero_chips_1771984199186.png"
      ]
    },
    {
      "id": "T11",
      "name": "Writing Detail Page",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "'About This Project' heading has bottom border", "status": "pass", "expected": "Consistent heading style", "actual": "Bottom border on heading confirmed" },
        { "step": 3, "description": "Spotify embed iframe visible", "status": "pass", "expected": "Audio player renders", "actual": "Spotify embed iframe confirmed visible" },
        { "step": 4, "description": "'Read Full Article on Substack' CTA visible", "status": "pass", "expected": "Purple button with arrow", "actual": "Purple CTA button with arrow confirmed" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t11_writing_detail_1771984322946.png"]
    },
    {
      "id": "T12",
      "name": "Detail Page Hero Tags (All Types)",
      "status": "pass",
      "assertions": [
        { "step": 2, "description": "Hero meta row shows badge + tags in flex-wrap", "status": "pass", "expected": "Items wrap properly", "actual": "GITHUB badge + Community, Live, Published chips in flex-wrap row" },
        { "step": 3, "description": "Tag chips match card style: ~0.72rem, gray, rounded", "status": "pass", "expected": "Pixel-identical to card tag chips", "actual": "Small gray rounded pills consistent with card chip style" }
      ],
      "warnings": [],
      "screenshot_paths": ["/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t12_hero_tags_1771984354178.png"]
    },
    {
      "id": "T13",
      "name": "Mobile Responsive Check",
      "status": "pass",
      "assertions": [
        { "step": 3, "description": "Cards stack in single column at 375px", "status": "pass", "expected": "No horizontal overflow", "actual": "Single-column confirmed, no overflow" },
        { "step": 4, "description": "Padding reduced on mobile", "status": "pass", "expected": "Less whitespace than desktop", "actual": "Tighter padding observed on mobile" },
        { "step": 6, "description": "Detail page content stays within viewport", "status": "pass", "expected": "No overflow on any element", "actual": "Headings, tags, buttons all within bounds" }
      ],
      "warnings": [],
      "screenshot_paths": [
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t13_mobile_media_1771984369603.png",
        "/Users/cmtemkin/.gemini/antigravity/brain/eb1b6b16-223d-4aa3-ba63-79d82262a9f0/t13_mobile_detail_1771984379867.png"
      ]
    }
  ]
}
```
