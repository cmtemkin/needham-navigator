/**
 * RAG Quality Evaluation — Golden Test Runner
 *
 * Reads docs/golden-test-dataset-verified.json, sends each question to the
 * local Chat API, scores the response using LLM-as-judge (semantic matching),
 * and writes results to docs/eval-results-YYYY-MM-DD.json.
 *
 * Usage:  npx tsx scripts/eval-golden-test.ts
 * Requires:  server running at http://localhost:3000, OPENAI_API_KEY set
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import OpenAI from "openai";

// Load .env.local (Next.js doesn't do this for standalone scripts)
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoldenQuestion = {
  id: string;
  persona: string;
  category: string;
  question: string;
  verified_answer_contains: string[];
  verified_source_urls: string[];
  verification_status: string;
  expected_confidence: string;
  difficulty: string;
  notes: string;
};

type FactResult = {
  fact: string;
  found: boolean;
  method: "llm-judge" | "substring";
};

type QuestionResult = {
  id: string;
  category: string;
  difficulty: string;
  verification_status: string;
  question: string;
  response: string;
  facts: FactResult[];
  facts_found: number;
  total_facts: number;
  score: number;
  response_time_ms: number;
  error: string | null;
};

type EvalResults = {
  run_date: string;
  api_url: string;
  town_id: string;
  scoring_method: string;
  total_questions: number;
  results: QuestionResult[];
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = "http://localhost:3000/api/chat";
const TOWN_ID = "needham";
const DELAY_MS = 3000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5000;
const JUDGE_MODEL = "gpt-4.1-nano";

// ---------------------------------------------------------------------------
// OpenAI client for LLM-as-judge
// ---------------------------------------------------------------------------

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY — needed for LLM-as-judge scoring");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a UIMessageStream SSE response and extract the concatenated text.
 */
function parseSSEText(raw: string): string {
  const lines = raw.split("\n");
  const parts: string[] = [];

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const json = line.slice(6);
    if (!json.trim()) continue;
    try {
      const parsed = JSON.parse(json);
      if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
        parts.push(parsed.delta);
      }
      if (typeof parsed === "string") {
        parts.push(parsed);
      }
    } catch {
      // skip non-JSON lines
    }
  }

  // Also handle "0:text" prefix format
  for (const line of lines) {
    if (line.startsWith("0:")) {
      try {
        const text = JSON.parse(line.slice(2));
        if (typeof text === "string") {
          parts.push(text);
        }
      } catch {
        // skip
      }
    }
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// LLM-as-Judge scoring
// ---------------------------------------------------------------------------

/**
 * Use a cheap LLM to judge whether a response contains a given fact.
 * Handles paraphrasing, different formatting, semantic equivalence.
 * Batches all facts for a single response into one API call for efficiency.
 */
async function judgeFactsBatch(
  question: string,
  response: string,
  facts: string[],
): Promise<FactResult[]> {
  if (!response.trim()) {
    return facts.map((fact) => ({ fact, found: false, method: "llm-judge" as const }));
  }

  const factsListText = facts
    .map((f, i) => `${i + 1}. ${f}`)
    .join("\n");

  const prompt = `You are evaluating whether an AI assistant's response contains specific facts. The response may paraphrase, reformat, or reword the facts — that's fine. What matters is whether the INFORMATION is present, not the exact wording.

QUESTION asked: "${question}"

AI RESPONSE:
"""
${response}
"""

EXPECTED FACTS (check each one):
${factsListText}

For each fact, respond with ONLY "YES" or "NO" — one per line, in order. YES means the response contains or conveys that information (even if worded differently, uses different punctuation, different number format, lists items separately vs grouped, etc.). NO means the information is absent or contradicted.

Example output for 3 facts:
YES
NO
YES`;

  try {
    const client = getOpenAI();
    const completion = await client.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: facts.length * 4 + 20,
    });

    const judgeResponse = completion.choices[0]?.message?.content ?? "";
    const verdicts = judgeResponse
      .split("\n")
      .map((line) => line.trim().toUpperCase())
      .filter((line) => line === "YES" || line === "NO");

    return facts.map((fact, i) => ({
      fact,
      found: verdicts[i] === "YES",
      method: "llm-judge" as const,
    }));
  } catch (e) {
    // If judge fails, fall back to substring matching
    console.log(`\n    [judge fallback: ${e instanceof Error ? e.message : String(e)}]`);
    return facts.map((fact) => ({
      fact,
      found: response.toLowerCase().includes(fact.toLowerCase()),
      method: "substring" as const,
    }));
  }
}

// ---------------------------------------------------------------------------
// Chat API caller with retries
// ---------------------------------------------------------------------------

async function sendQuestion(question: string): Promise<{ text: string; timeMs: number }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      process.stdout.write(`\n    retry ${attempt}/${MAX_RETRIES} after ${backoff / 1000}s... `);
      await sleep(backoff);
    }

    const start = Date.now();
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          townId: TOWN_ID,
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        if (res.status >= 500 && attempt < MAX_RETRIES) continue;
        throw new Error(`API returned ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const raw = await res.text();
      const text = parseSSEText(raw);
      const timeMs = Date.now() - start;
      return { text, timeMs };
    } catch (e) {
      if (attempt >= MAX_RETRIES) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("fetch failed") ||
        msg.includes("terminated") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("timeout")
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Exhausted all retries");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const datasetPath = resolve(__dirname, "../docs/golden-test-dataset-verified.json");
  const dataset: GoldenQuestion[] = JSON.parse(readFileSync(datasetPath, "utf-8"));

  // Verify OpenAI key is set for LLM-as-judge
  getOpenAI();

  console.log(`\n=== RAG Quality Evaluation (LLM-as-Judge) ===`);
  console.log(`Dataset: ${dataset.length} questions`);
  console.log(`API: ${API_URL}`);
  console.log(`Town: ${TOWN_ID}`);
  console.log(`Judge model: ${JUDGE_MODEL}\n`);

  const results: QuestionResult[] = [];
  let passCount = 0;

  for (let i = 0; i < dataset.length; i++) {
    const q = dataset[i];
    const label = `[${i + 1}/${dataset.length}] ${q.id}`;

    process.stdout.write(`${label}: "${q.question.slice(0, 60)}..." `);

    let response = "";
    let timeMs = 0;
    let error: string | null = null;

    try {
      const result = await sendQuestion(q.question);
      response = result.text;
      timeMs = result.timeMs;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      console.log(`ERROR: ${error}`);
    }

    // Score using LLM-as-judge
    let facts: FactResult[];
    if (error || !response.trim()) {
      facts = q.verified_answer_contains.map((fact) => ({
        fact,
        found: false,
        method: "substring" as const,
      }));
    } else {
      facts = await judgeFactsBatch(q.question, response, q.verified_answer_contains);
    }

    const factsFound = facts.filter((f) => f.found).length;
    const totalFacts = facts.length;
    const score = totalFacts > 0 ? factsFound / totalFacts : 0;

    if (score >= 0.5) passCount++;

    results.push({
      id: q.id,
      category: q.category,
      difficulty: q.difficulty,
      verification_status: q.verification_status,
      question: q.question,
      response,
      facts,
      facts_found: factsFound,
      total_facts: totalFacts,
      score,
      response_time_ms: timeMs,
      error,
    });

    if (!error) {
      const pct = Math.round(score * 100);
      const bar = pct >= 75 ? "PASS" : pct >= 50 ? "PARTIAL" : "FAIL";
      console.log(`${bar} ${pct}% (${factsFound}/${totalFacts} facts) ${timeMs}ms`);
    }

    // Save progress every 10 questions (in case of crash)
    if ((i + 1) % 10 === 0 || i === dataset.length - 1) {
      const partialOutput: EvalResults = {
        run_date: new Date().toISOString(),
        api_url: API_URL,
        town_id: TOWN_ID,
        scoring_method: `llm-as-judge (${JUDGE_MODEL})`,
        total_questions: dataset.length,
        results,
      };
      const dateStr = new Date().toISOString().split("T")[0];
      const progressPath = resolve(__dirname, `../docs/eval-results-${dateStr}.json`);
      writeFileSync(progressPath, JSON.stringify(partialOutput, null, 2));
      console.log(`  [saved progress: ${results.length}/${dataset.length}]`);
    }

    // Delay between requests
    if (i < dataset.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const overallScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;

  console.log(`\n=== Summary ===`);
  console.log(`Overall Score: ${Math.round(overallScore * 100)}%`);
  console.log(`Pass (>=50%): ${passCount}/${results.length}`);
  console.log(`Query rewriting: enabled (gpt-4.1-nano)`);

  const dateStr = new Date().toISOString().split("T")[0];
  const outputPath = resolve(__dirname, `../docs/eval-results-${dateStr}.json`);

  const output: EvalResults = {
    run_date: new Date().toISOString(),
    api_url: API_URL,
    town_id: TOWN_ID,
    scoring_method: `llm-as-judge (${JUDGE_MODEL})`,
    total_questions: dataset.length,
    results,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
