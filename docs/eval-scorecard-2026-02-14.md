# RAG Quality Evaluation Scorecard

**Run Date:** 2026-02-14T20:24:46.114Z
**API:** http://localhost:3000/api/chat
**Town:** needham
**Questions:** 73

---

## Overall Score

### 🔴 42% (112 / 287 facts found)

- **Pass rate (≥50% facts):** 33/73 (45%)
- **Perfect score (100%):** 13/73 (18%)

---

## Score by Category

| Category | Questions | Avg Score | Facts Found | Pass Rate |
|----------|-----------|-----------|-------------|-----------|
| 🔴 Wrong Assumptions | 2 | 13% | 1/8 | 0/2 |
| 🔴 Health Department / Food Permits | 4 | 13% | 2/19 | 1/4 |
| 🔴 Information System May Not Have | 2 | 13% | 1/7 | 0/2 |
| 🔴 Schools | 5 | 13% | 2/17 | 1/5 |
| 🔴 Zoning & Dimensional Regulations | 11 | 22% | 11/52 | 2/11 |
| 🔴 Public Safety | 3 | 22% | 2/9 | 0/3 |
| 🔴 General 'Where Do I...' Questions | 5 | 23% | 4/17 | 2/5 |
| 🔴 Vague Questions | 2 | 25% | 3/10 | 1/2 |
| 🔴 Out-of-Scope / Graceful Fallback | 3 | 33% | 3/9 | 0/3 |
| 🔴 Town Meetings & Government | 5 | 42% | 8/20 | 3/5 |
| 🔴 Parks & Recreation | 3 | 47% | 8/18 | 1/3 |
| 🔴 Multi-Part Questions | 2 | 48% | 4/9 | 1/2 |
| 🟡 Transportation / MBTA | 4 | 57% | 9/15 | 3/4 |
| 🟡 Context-Dependent Follow-up | 2 | 63% | 4/7 | 1/2 |
| 🟡 Building Permits & Process | 8 | 63% | 17/28 | 6/8 |
| 🟡 Property Taxes & Assessments | 5 | 78% | 11/15 | 4/5 |
| 🟢 Transfer Station / Trash | 5 | 82% | 14/18 | 5/5 |
| 🟢 Edge Cases | 2 | 90% | 8/9 | 2/2 |

---

## Score by Difficulty

| Difficulty | Questions | Avg Score | Pass Rate |
|------------|-----------|-----------|-----------|
| 🔴 Easy | 41 | 40% | 18/41 |
| 🔴 Medium | 21 | 41% | 8/21 |
| 🟡 Hard | 11 | 50% | 7/11 |

---

## Score by Verification Status

| Status | Questions | Avg Score | Pass Rate |
|--------|-----------|-----------|-----------|
| 🔴 verified | 52 | 34% | 20/52 |
| 🟡 partially_verified | 21 | 61% | 13/21 |

---

## Top 10 Worst Questions

### WRONGASSUMP-001 — 0% (0/4)
**Q:** Where do I put my trash cans on the curb for pickup?
**Category:** Wrong Assumptions | **Difficulty:** Medium
**Missing facts:**
- Needham does NOT have curbside trash pickup
- residents must bring trash to the Recycling and Transfer Station
- transfer station located at 1421 Central Avenue
- must use Pay-As-You-Throw bags

### SCHOOL-001 — 0% (0/4)
**Q:** What schools are in Needham? Are they good?
**Category:** Schools | **Difficulty:** Easy
**Missing facts:**
- 8 public schools total
- 5 elementary schools: Broadmeadow, Eliot, Mitchell, Sunita L. Williams, Newman
- 2 middle schools: High Rock (grade 6), Pollard (grades 7-8)
- 1 high school: Needham High School (grades 9-12)

### SCHOOL-002 — 0% (0/4)
**Q:** Which school district does this property fall into?
**Category:** Schools | **Difficulty:** Medium
**Missing facts:**
- school assignments depend on property address
- Needham has 5 elementary school zones
- all students attend High Rock (grade 6), Pollard (grades 7-8), and Needham High (9-12)
- contact the school district for address-specific assignment

### SCHOOL-004 — 0% (0/3)
**Q:** How do I register my child for school?
**Category:** Schools | **Difficulty:** Medium
**Missing facts:**
- registration opens January 12, 2026
- registration deadline is April 1, 2026
- register through the Needham Public Schools district office

### SCHOOL-005 — 0% (0/3)
**Q:** What are school lunch costs and do you offer free/reduced lunch?
**Category:** Schools | **Difficulty:** Easy
**Missing facts:**
- ALL students receive FREE breakfast and lunch
- universal free meals program funded by the state of Massachusetts
- no application needed for free meals

### TRANS-004 — 0% (0/3)
**Q:** Where can I park for the MBTA station?
**Category:** Transportation / MBTA | **Difficulty:** Easy
**Missing facts:**
- parking available at Needham Junction station
- weekday rate: $6.00 per day
- weekend rate: $2.00 per day

### GENERAL-001 — 0% (0/3)
**Q:** Where do I get a library card?
**Category:** General 'Where Do I...' Questions | **Difficulty:** Easy
**Missing facts:**
- Needham Free Public Library
- 1139 Highland Avenue
- Hours: Monday-Thursday 9AM-9PM, Friday 9AM-5:30PM, Saturday 9AM-5PM, Sunday 1PM-6PM

### GENERAL-002 — 0% (0/4)
**Q:** Where can I get a resident parking permit?
**Category:** General 'Where Do I...' Questions | **Difficulty:** Easy
**Missing facts:**
- Needham offers overnight parking permits
- contact the Department of Public Works
- DPW address: 500 Dedham Avenue
- DPW phone: 781-455-7550

### GENERAL-004 — 0% (0/3)
**Q:** How do I file a complaint about a code violation?
**Category:** General 'Where Do I...' Questions | **Difficulty:** Medium
**Missing facts:**
- Building code violations: contact Building Department at 500 Dedham Avenue, phone 781-455-7550
- Health/food violations: contact Public Health Division at 178 Rosemary Street, phone 781-455-7940
- Building Division enforces state building, electrical, plumbing, gas, mechanical codes and local zoning by-laws

### SAFETY-002 — 0% (0/3)
**Q:** How do I report a crime or emergency?
**Category:** Public Safety | **Difficulty:** Easy
**Missing facts:**
- call 911 for emergencies
- Needham Police non-emergency: 781-444-1212
- Police station: 99 School Street

---

## Top 10 Best Questions

- 🟢 **TRASH-001** — 100% (4/4) — "When is the transfer station open?"
- 🟢 **TRASH-002** — 100% (2/2) — "Where is the transfer station located?"
- 🟢 **TRASH-004** — 100% (3/3) — "What items can't I throw away at the transfer station?"
- 🟢 **TAX-002** — 100% (3/3) — "What's the assessed value of 42 Great Plain Road?"
- 🟢 **TAX-003** — 100% (2/2) — "When are property taxes due?"
- 🟢 **TAX-005** — 100% (3/3) — "What exemptions are available for seniors or disabled residents?"
- 🟢 **TRANS-003** — 100% (3/3) — "Are there local bus routes in Needham?"
- 🟢 **ZON-010** — 100% (5/5) — "Can they build a commercial building near residential areas?"
- 🟢 **PERMIT-004** — 100% (3/3) — "Do I need to hire an architect or engineer for my deck permit?"
- 🟢 **PERMIT-007** — 100% (3/3) — "Do I need a separate electrical permit for my deck addition?"

---

## Response Time Statistics

| Metric | Value |
|--------|-------|
| Average | 19607ms |
| Median (P50) | 20811ms |
| P95 | 35669ms |
| Slowest | 50524ms |
| Fastest | 382ms |

---

## Recommendations for RAG Improvement

### Weak Categories (below 50% avg score)

- **Wrong Assumptions** — Consider adding more source documents or improving chunk quality for this topic area
- **Health Department / Food Permits** — Consider adding more source documents or improving chunk quality for this topic area
- **Information System May Not Have** — Consider adding more source documents or improving chunk quality for this topic area
- **Schools** — Consider adding more source documents or improving chunk quality for this topic area
- **Zoning & Dimensional Regulations** — Consider adding more source documents or improving chunk quality for this topic area
- **Public Safety** — Consider adding more source documents or improving chunk quality for this topic area
- **General 'Where Do I...' Questions** — Consider adding more source documents or improving chunk quality for this topic area
- **Vague Questions** — Consider adding more source documents or improving chunk quality for this topic area
- **Out-of-Scope / Graceful Fallback** — Consider adding more source documents or improving chunk quality for this topic area
- **Town Meetings & Government** — Consider adding more source documents or improving chunk quality for this topic area
- **Parks & Recreation** — Consider adding more source documents or improving chunk quality for this topic area
- **Multi-Part Questions** — Consider adding more source documents or improving chunk quality for this topic area

### Missing Fact Patterns

- **Transfer Station / Trash**: 4 missing facts across 2 questions
- **Wrong Assumptions**: 7 missing facts across 2 questions
- **Property Taxes & Assessments**: 4 missing facts across 2 questions
- **Schools**: 15 missing facts across 5 questions
- **Transportation / MBTA**: 6 missing facts across 3 questions
- **Town Meetings & Government**: 12 missing facts across 5 questions
- **General 'Where Do I...' Questions**: 13 missing facts across 5 questions
- **Public Safety**: 7 missing facts across 3 questions
- **Parks & Recreation**: 10 missing facts across 3 questions
- **Health Department / Food Permits**: 17 missing facts across 4 questions
- **Zoning & Dimensional Regulations**: 41 missing facts across 10 questions
- **Building Permits & Process**: 11 missing facts across 5 questions
- **Vague Questions**: 7 missing facts across 2 questions
- **Multi-Part Questions**: 5 missing facts across 2 questions
- **Context-Dependent Follow-up**: 3 missing facts across 1 questions
- **Information System May Not Have**: 6 missing facts across 2 questions
- **Out-of-Scope / Graceful Fallback**: 6 missing facts across 3 questions

### General Recommendations

1. **Critical:** Overall score below 50%. Review source document coverage and chunking strategy
1. **Performance:** P95 response time is 35669ms. Consider optimizing embedding generation or reducing chunk count

---

*Generated by `npm run eval:scorecard`*
