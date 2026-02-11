# Needham Navigator — User Guide

Needham Navigator is an AI-powered municipal information hub that helps residents find answers about town services, permits, zoning, schools, and more.

---

## Getting Started

Visit your town's Navigator page:

| Town | URL |
|------|-----|
| Needham, MA | `/needham` |
| Mock Town, MA (demo) | `/mock-town` |

The home page shows popular questions, life-situation tiles, and department contacts. Click any tile or question to start a conversation.

---

## Features

### AI Chat

Navigate to **Ask a Question** from the header or visit `/<town>/chat`.

- Type any question about town services, permits, zoning, schools, or departments
- The AI responds with sourced answers, confidence levels, and follow-up suggestions
- Click a follow-up suggestion to continue the conversation
- **Feedback**: Every AI response has thumbs up/down buttons — your feedback helps improve answers. You can optionally add a comment.

### Permit Wizard

Navigate to **Permits** from the header or visit `/<town>/permits`.

A guided step-by-step tool that tells you exactly which permits, fees, and documents you need for common home projects:

| Project Type | What It Covers |
|---|---|
| **Build a Deck** | Attached/detached, size, height — determines building permit, zoning review |
| **Install a Fence** | Height, location, material — flags zoning board requirements for tall/front fences |
| **Home Renovation** | Kitchen/bath/other, structural changes, electrical/plumbing — identifies all required permits |
| **Build an Addition** | Size, stories, foundation — comprehensive permit list including conservation review |

**How to use it:**
1. Select your project type
2. Answer 3 questions about your specific situation
3. Get a personalized summary with:
   - Required permits
   - Estimated fees
   - Documents to prepare
   - Expected timeline
   - Department contact info
   - Helpful tips
4. Click **Ask Navigator for More Details** to continue in chat

### Multi-Language Support

Click the language toggle (globe icon) in the header to switch between:
- English
- Spanish (Espanol)
- Chinese (中文)

All navigation, labels, and system text are translated. AI chat responses are currently in English.

### Department Directory

The home page lists key town departments with phone numbers. Click any department to ask the AI about their services.

---

## Admin Dashboard

Visit `/admin` to access:

- **Analytics** — feedback trends, query volume, response quality metrics
- **System Logs** — ingestion status, error tracking, sync history
- **Document Management** — view indexed content and sources

---

## Navigation

| Page | URL | Description |
|------|-----|-------------|
| Home | `/<town>` | Landing page with quick links |
| Chat | `/<town>/chat` | AI-powered Q&A |
| Permits | `/<town>/permits` | Permit wizard |
| Admin | `/admin` | Dashboard (not town-scoped) |

Legacy URLs like `/chat` automatically redirect to the default town.

---

## Tips

- **Be specific** — "What permits do I need for a 6-foot fence on my property line?" gets better answers than "fence permit"
- **Use the Permit Wizard first** — it gives you a structured checklist, then you can ask follow-ups in chat
- **Check confidence levels** — high confidence means strong source matches; low confidence means you should verify with the town directly
- **Always verify** — This is an AI tool. For official decisions, contact the relevant department directly using the phone numbers provided.
