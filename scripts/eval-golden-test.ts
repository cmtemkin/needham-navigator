/**
 * RAG Quality Evaluation — Golden Test Runner
 *
 * Reads docs/golden-test-dataset-verified.json, sends each question to the
 * local Chat API, scores the response against verified_answer_contains via
 * case-insensitive substring matching, and writes results to
 * docs/eval-results-YYYY-MM-DD.json.
 *
 * Usage:  npx tsx scripts/eval-golden-test.ts
 * Requires:  dev server running at http://localhost:3000
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

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
  total_questions: number;
  results: QuestionResult[];
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = "http://localhost:3000/api/chat";
const TOWN_ID = "needham";
const DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a UIMessageStream SSE response and extract the concatenated text.
 *
 * The stream sends lines like:
 *   data: {"type":"text-delta","id":"...","delta":"some text"}
 *
 * We accumulate all text-delta payloads.
 */
function parseSSEText(raw: string): string {
  const lines = raw.split("\n");
  const parts: string[] = [];

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const json = line.slice(6); // strip "data: "
    if (!json.trim()) continue;
    try {
      const parsed = JSON.parse(json);

      // Vercel AI SDK UIMessageStream text delta
      if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
        parts.push(parsed.delta);
      }

      // Also handle the older "0:" text prefix format just in case
      if (typeof parsed === "string") {
        parts.push(parsed);
      }
    } catch {
      // Some lines may be non-JSON (e.g. empty keepalive), skip them
    }
  }

  // Also handle the "0:text" prefix format used by some AI SDK versions
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

/**
 * Score a response against the expected facts.
 *
 * For "Out-of-Scope" category questions, we check whether the response
 * correctly identifies the question as out of scope (looking for phrases
 * like "outside the scope", "can't help with that", "not something I cover",
 * redirect language, etc.)
 */
function scoreResponse(
  response: string,
  facts: string[],
  category: string,
): FactResult[] {
  const lowerResponse = response.toLowerCase();

  if (category === "Out-of-Scope / Graceful Fallback") {
    const outOfScopeIndicators = [
      "outside the scope",
      "outside of the scope",
      "not something i",
      "can't help with that",
      "i'm here to help with",
      "i am here to help with",
      "not within my scope",
      "beyond the scope",
      "not able to help",
      "town info",
      "town services",
      "municipal",
      "suggest",
      "recommend checking",
      "you'd want to check",
      "consult",
    ];

    return facts.map((fact) => {
      const lowerFact = fact.toLowerCase();

      // First try direct substring match
      if (lowerResponse.includes(lowerFact)) {
        return { fact, found: true };
      }

      // For out-of-scope questions, also check if the response shows
      // awareness that this topic is outside its scope
      const showsOutOfScope = outOfScopeIndicators.some((indicator) =>
        lowerResponse.includes(indicator),
      );

      // If the fact is about being "outside scope" or redirecting, and the
      // response shows that awareness, count it
      if (
        showsOutOfScope &&
        (lowerFact.includes("outside") ||
          lowerFact.includes("scope") ||
          lowerFact.includes("suggest") ||
          lowerFact.includes("navigator can help"))
      ) {
        return { fact, found: true };
      }

      return { fact, found: false };
    });
  }

  // Standard scoring: case-insensitive substring match
  return facts.map((fact) => ({
    fact,
    found: lowerResponse.includes(fact.toLowerCase()),
  }));
}

async function sendQuestion(question: string): Promise<{ text: string; timeMs: number }> {
  const start = Date.now();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      townId: TOWN_ID,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`API returned ${res.status}: ${errBody}`);
  }

  const raw = await res.text();
  const text = parseSSEText(raw);
  const timeMs = Date.now() - start;

  return { text, timeMs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const datasetPath = resolve(__dirname, "../docs/golden-test-dataset-verified.json");
  const dataset: GoldenQuestion[] = JSON.parse(readFileSync(datasetPath, "utf-8"));

  console.log(`\n=== RAG Quality Evaluation ===`);
  console.log(`Dataset: ${dataset.length} questions`);
  console.log(`API: ${API_URL}`);
  console.log(`Town: ${TOWN_ID}\n`);

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

    const facts = scoreResponse(
      response,
      q.verified_answer_contains,
      q.category,
    );
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

    // Delay between requests to avoid overwhelming the API
    if (i < dataset.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const overallScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;

  console.log(`\n=== Summary ===`);
  console.log(`Overall Score: ${Math.round(overallScore * 100)}%`);
  console.log(`Pass (>=50%): ${passCount}/${results.length}`);

  const dateStr = new Date().toISOString().split("T")[0];
  const outputPath = resolve(__dirname, `../docs/eval-results-${dateStr}.json`);

  const output: EvalResults = {
    run_date: new Date().toISOString(),
    api_url: API_URL,
    town_id: TOWN_ID,
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
