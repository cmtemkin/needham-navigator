# Needham Navigator

**AI-powered municipal information hub for Needham, MA**

Needham Navigator is an intelligent municipal information system that helps residents get instant, accurate answers to questions about town services, permits, zoning regulations, schools, and more — all backed by official municipal data with source citations.

🔗 **Live Demo:** [needhamnavigator.com](https://needhamnavigator.com)

---

## What It Does

Needham Navigator transforms how residents interact with local government information. Instead of hunting through multiple municipal websites and PDFs, residents can ask natural language questions and receive accurate, sourced answers powered by AI.

The system continuously monitors official town websites, ingests new content, and maintains an up-to-date knowledge base that combines semantic search with traditional full-text search for optimal retrieval accuracy.

---

## Key Features

- **AI-Powered Q&A with Source Citations** — Every answer includes links to the official source documents, ensuring transparency and trustworthiness
- **Hybrid Search with Multi-Factor Reranking** — Combines semantic similarity (pgvector) and keyword matching (full-text search) with confidence scoring for optimal result quality
- **Custom Web Scraper for CivicPlus Sites** — Purpose-built scraper using Cheerio, Mozilla Readability, and Turndown to cleanly extract content from municipal websites
- **Automated Daily Content Monitoring** — Cron jobs detect when municipal content changes and automatically re-ingest updated pages
- **Multi-Tenant Architecture** — Designed to support multiple towns from a single codebase with per-town theming and configuration
- **Confidence Scoring & Verification Badges** — Each answer includes confidence metrics and source verification to help users assess answer quality

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + pgvector for semantic search)
- **AI/ML:** OpenAI GPT-4o-mini for chat completions, text-embedding-3-large for embeddings
- **Search:** Hybrid search combining pgvector similarity and PostgreSQL full-text search with custom reranking
- **Web Scraping:** Custom scraper (Cheerio + Mozilla Readability + Turndown)
- **Hosting:** Vercel (frontend + API routes)
- **CI/CD:** GitHub Actions with automated testing and deployment

---

## Architecture Overview

Needham Navigator uses a **RAG (Retrieval-Augmented Generation)** pipeline:

1. **Scrape** — Custom scraper crawls municipal websites (CivicPlus platform), extracting clean markdown from HTML
2. **Chunk** — Documents are split into semantically meaningful chunks with metadata preservation
3. **Embed** — Each chunk is converted to a 1536-dimensional vector using OpenAI's text-embedding-3-large model
4. **Store** — Vectors and metadata are stored in Supabase PostgreSQL with pgvector extension
5. **Hybrid Search** — User queries trigger both semantic search (pgvector cosine similarity) and keyword search (PostgreSQL full-text search)
6. **Rerank** — Results are scored using multiple factors: semantic similarity, keyword match, recency, source authority, and category relevance
7. **Generate** — Top-ranked chunks are passed to GPT-4o-mini as context to generate accurate, cited answers

The system includes automated monitoring that detects content changes on source websites and triggers re-ingestion to keep the knowledge base current.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cmtemkin/needham-navigator.git
   cd needham-navigator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   - `OPENAI_API_KEY` — Your OpenAI API key ([get one here](https://platform.openai.com))
   - `SUPABASE_URL` — Your Supabase project URL
   - `SUPABASE_ANON_KEY` — Your Supabase anonymous key
   - `SUPABASE_SERVICE_KEY` — Your Supabase service role key
   - `ADMIN_PASSWORD` — Password for the admin dashboard

   Optional:
   - `LLAMAPARSE_API_KEY` — For complex PDF parsing (fallback only)
   - `NEXT_PUBLIC_USE_MOCK_DATA=true` — Use mock data for testing without API calls

4. **Set up the database**

   Run the Supabase migrations:
   ```bash
   # Install Supabase CLI if you haven't already
   npm install -g supabase

   # Link your Supabase project
   supabase link --project-ref your-project-ref

   # Run migrations
   supabase db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000/needham](http://localhost:3000/needham) to see the app.

### Ingesting Content

To populate the knowledge base with municipal content:

```bash
# Crawl and ingest content from configured sources
npm run ingest

# Monitor for content changes (run as a cron job)
npm run monitor

# Validate ingestion results
npm run validate
```

---

## Project Structure

```
needham-navigator/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── [town]/       # Multi-tenant routes (chat, permits, news, etc.)
│   │   ├── admin/        # Admin dashboard
│   │   └── api/          # API routes (chat, search, feedback, cron jobs)
│   ├── components/       # React components
│   └── lib/              # Utilities (Supabase client, embeddings, reranking, etc.)
├── scripts/              # Data ingestion and monitoring scripts
│   ├── scraper.ts        # Custom web scraper
│   ├── ingest.ts         # Content ingestion pipeline
│   ├── monitor.ts        # Change detection
│   └── validate-ingestion.ts  # Ingestion validation
├── config/               # Town configurations and theming
├── supabase/
│   └── migrations/       # Database schema and migrations
├── __tests__/            # Jest unit tests
└── docs/                 # User guide and release notes
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Charlie Temkin**

Built as an open-source portfolio project demonstrating modern AI application architecture, RAG pipelines, and full-stack TypeScript development.

---

## Contributing

This is primarily a portfolio project, but suggestions and bug reports are welcome! Please open an issue before submitting a PR.

---

## Roadmap

- [ ] Support for additional Massachusetts towns
- [ ] Real-time event monitoring and automated news generation
- [ ] Multi-language support (Spanish, Portuguese, Chinese)
- [ ] Mobile app (React Native)
- [ ] Integration with town notification systems

---

*Questions or feedback? Open an issue or reach out via the repository.*

---

## RAG Quality Evaluation

The project includes a golden test dataset and evaluation tooling to measure RAG pipeline quality against verified ground-truth answers from needhamma.gov.

### Golden Test Dataset

`docs/golden-test-dataset-verified.json` contains 73 questions spanning 14 categories (Transfer Station, Taxes, Schools, Zoning, Permits, etc.) with:
- **Verified answer facts** — specific strings the response should contain
- **Verification status** — `verified`, `partially_verified`
- **Difficulty levels** — Easy, Medium, Hard
- **Persona context** — New Resident, Concerned Citizen, Homeowner, Real Estate Agent, Small Business Owner

### Running the Evaluation

1. Start the dev server: `npm run dev`
2. Run the eval: `npm run eval` — sends each question to the Chat API, scores responses, saves results to `docs/eval-results-YYYY-MM-DD.json`
3. Generate the scorecard: `npm run eval:scorecard` — produces `docs/eval-scorecard-YYYY-MM-DD.md` with category breakdowns, worst/best questions, response time stats, and improvement recommendations

### Scorecard Sections

- **Overall score** (0–100%) with fact-level precision
- **Score by category** — identifies weak topic areas
- **Score by difficulty** — Easy vs Medium vs Hard
- **Score by verification status** — verified vs partially_verified
- **Top 10 worst questions** — with missing facts listed
- **Top 10 best questions**
- **Response time stats** — avg, P50, P95, slowest
- **Recommendations** — actionable next steps for RAG improvement
