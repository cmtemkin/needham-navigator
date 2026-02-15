/**
 * RAG Evaluation Harness — Keyword & Source Quality Testing
 *
 * Reads scripts/eval/golden-questions.json, sends each question to the chat API,
 * and scores responses on keyword hits, source relevance, forbidden content, and
 * response quality. Outputs a console scorecard and JSON results file.
 *
 * Usage:
 *   npm run eval:new             # test against localhost:3000
 *   npm run eval:new:prod        # test against production
 *   EVAL_BASE_URL=... npm run eval:new  # custom URL
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoldenQuestion = {
  id: string;
  category: string;
  question: string;
  expectedKeywords: string[];
  expectedSourceRelevance: string[];
  forbiddenContent: string[];
  minSourceCount: number;
  maxSourceCount: number;
  notes?: string;
};

type Source = {
  source_id: string;
  citation: string;
  document_title: string;
  document_url?: string;
  section?: string;
  date?: string;
  page_number?: number;
};

type QuestionResult = {
  id: string;
  category: string;
  question: string;
  answer: string;
  sources: Source[];
  keywordHitRate: number;
  sourceRelevanceScore: number;
  forbiddenContentCheck: "PASS" | "FAIL";
  sourceCountCheck: "PASS" | "FAIL";
  responseQualityCheck: "PASS" | "FAIL";
  grade: string;
  responseTimeMs: number;
  error: string | null;
};

type EvalResults = {
  runDate: string;
  targetUrl: string;
  totalQuestions: number;
  overallScore: number;
  avgKeywordHitRate: number;
  avgSourceRelevance: number;
  forbiddenContentPass: number;
  results: QuestionResult[];
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";
const TOWN_ID = "needham";
const DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse UIMessageStream SSE response to extract text and sources.
 */
function parseSSEResponse(raw: string): { text: string; sources: Source[] } {
  const lines = raw.split("\n");
  const textParts: string[] = [];
  const sources: Source[] = [];

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const json = line.slice(6).trim();
    if (!json) continue;

    try {
      const parsed = JSON.parse(json);

      // Extract text deltas
      if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
        textParts.push(parsed.delta);
      }

      // Extract sources
      if (parsed.type === "data-sources" && Array.isArray(parsed.data)) {
        sources.push(...parsed.data);
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return {
    text: textParts.join(""),
    sources,
  };
}

/**
 * Calculate keyword hit rate (0-100%)
 */
function calculateKeywordHitRate(answer: string, keywords: string[]): number {
  if (keywords.length === 0) return 100; // No keywords = automatic pass

  const answerLower = answer.toLowerCase();
  const hits = keywords.filter((kw) =>
    answerLower.includes(kw.toLowerCase())
  ).length;

  return (hits / keywords.length) * 100;
}

/**
 * Calculate source relevance score (0-100%)
 */
function calculateSourceRelevance(
  sources: Source[],
  relevanceKeywords: string[]
): number {
  if (sources.length === 0) return 0;
  if (relevanceKeywords.length === 0) return 100; // No keywords = automatic pass

  const relevantSources = sources.filter((source) => {
    const titleLower = source.document_title.toLowerCase();
    const urlLower = (source.document_url || "").toLowerCase();
    return relevanceKeywords.some(
      (kw) =>
        titleLower.includes(kw.toLowerCase()) ||
        urlLower.includes(kw.toLowerCase())
    );
  });

  return (relevantSources.length / sources.length) * 100;
}

/**
 * Check for forbidden content
 */
function checkForbiddenContent(
  answer: string,
  forbiddenContent: string[]
): "PASS" | "FAIL" {
  if (forbiddenContent.length === 0) return "PASS";

  const answerLower = answer.toLowerCase();
  const hasForbidden = forbiddenContent.some((content) =>
    answerLower.includes(content.toLowerCase())
  );

  return hasForbidden ? "FAIL" : "PASS";
}

/**
 * Check source count
 */
function checkSourceCount(
  sourceCount: number,
  min: number,
  max: number
): "PASS" | "FAIL" {
  return sourceCount >= min && sourceCount <= max ? "PASS" : "FAIL";
}

/**
 * Check response quality
 */
function checkResponseQuality(
  status: number,
  answer: string
): "PASS" | "FAIL" {
  if (status !== 200) return "FAIL";
  if (answer.trim().length === 0) return "FAIL";
  if (answer.length > 2000) return "FAIL"; // Too verbose
  return "PASS";
}

/**
 * Calculate letter grade
 */
function calculateGrade(
  keywordHitRate: number,
  sourceRelevance: number,
  forbiddenCheck: "PASS" | "FAIL",
  sourceCountCheck: "PASS" | "FAIL",
  qualityCheck: "PASS" | "FAIL"
): string {
  // If quality check fails, it's an F
  if (qualityCheck === "FAIL") return "F";

  // If any other check fails, best you can get is C
  if (
    forbiddenCheck === "FAIL" ||
    sourceCountCheck === "FAIL"
  ) {
    if (keywordHitRate >= 25) return "C";
    return "D";
  }

  // All checks pass - grade based on keyword/source scores
  if (keywordHitRate >= 95 && sourceRelevance >= 95) return "A+";
  if (keywordHitRate >= 80 && sourceRelevance >= 75) return "A";
  if (keywordHitRate >= 70 && sourceRelevance >= 70) return "A-";
  if (keywordHitRate >= 50 && sourceRelevance >= 50) return "B";
  if (keywordHitRate >= 25) return "C";
  if (keywordHitRate < 25 && sourceRelevance < 25) return "D";

  return "C";
}

/**
 * Send question to chat API and get response
 */
async function sendQuestion(
  question: string
): Promise<{ text: string; sources: Source[]; timeMs: number; status: number }> {
  const start = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: question }],
        townId: TOWN_ID,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const raw = await res.text();
    const { text, sources } = parseSSEResponse(raw);
    const timeMs = Date.now() - start;

    return { text, sources, timeMs, status: res.status };
  } catch (e) {
    const timeMs = Date.now() - start;
    throw new Error(
      `API request failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * Evaluate a single question
 */
async function evaluateQuestion(q: GoldenQuestion): Promise<QuestionResult> {
  let answer = "";
  let sources: Source[] = [];
  let timeMs = 0;
  let status = 0;
  let error: string | null = null;

  try {
    const result = await sendQuestion(q.question);
    answer = result.text;
    sources = result.sources;
    timeMs = result.timeMs;
    status = result.status;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    status = 500;
  }

  const keywordHitRate = calculateKeywordHitRate(answer, q.expectedKeywords);
  const sourceRelevanceScore = calculateSourceRelevance(
    sources,
    q.expectedSourceRelevance
  );
  const forbiddenContentCheck = checkForbiddenContent(
    answer,
    q.forbiddenContent
  );
  const sourceCountCheck = checkSourceCount(
    sources.length,
    q.minSourceCount,
    q.maxSourceCount
  );
  const responseQualityCheck = checkResponseQuality(status, answer);
  const grade = calculateGrade(
    keywordHitRate,
    sourceRelevanceScore,
    forbiddenContentCheck,
    sourceCountCheck,
    responseQualityCheck
  );

  return {
    id: q.id,
    category: q.category,
    question: q.question,
    answer,
    sources,
    keywordHitRate,
    sourceRelevanceScore,
    forbiddenContentCheck,
    sourceCountCheck,
    responseQualityCheck,
    grade,
    responseTimeMs: timeMs,
    error,
  };
}

/**
 * Format percentage
 */
function pct(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Print console scorecard
 */
function printScorecard(results: EvalResults) {
  const passing = results.results.filter(
    (r) => r.grade !== "F" && r.grade !== "D"
  ).length;

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Needham Navigator RAG Evaluation Report");
  console.log(`  Date: ${results.runDate}`);
  console.log(`  Target: ${results.targetUrl}`);
  console.log("═══════════════════════════════════════════════\n");

  console.log(
    "  ID                    Keywords  Sources  Forbidden  Count  Quality  GRADE"
  );
  console.log(
    "  ─────────────────────────────────────────────────────────────────────────"
  );

  for (const r of results.results) {
    const id = r.id.padEnd(20);
    const keywords = pct(r.keywordHitRate).padStart(7);
    const sources = pct(r.sourceRelevanceScore).padStart(7);
    const forbidden = r.forbiddenContentCheck.padEnd(10);
    const count = r.sourceCountCheck.padEnd(6);
    const quality = r.responseQualityCheck.padEnd(8);
    const grade = r.grade.padStart(5);

    console.log(
      `  ${id}${keywords}  ${sources}  ${forbidden}${count}${quality}${grade}`
    );
  }

  console.log(
    "  ─────────────────────────────────────────────────────────────────────────"
  );
  console.log(
    `  OVERALL SCORE: ${pct(results.overallScore)} (${passing}/${results.totalQuestions} passing)`
  );
  console.log(
    `  Keyword Hit Rate Avg: ${pct(results.avgKeywordHitRate)}`
  );
  console.log(
    `  Source Relevance Avg: ${pct(results.avgSourceRelevance)}`
  );
  console.log(
    `  Forbidden Content: ${results.forbiddenContentPass}/${results.totalQuestions} clean`
  );
  console.log("═══════════════════════════════════════════════\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const datasetPath = resolve(__dirname, "golden-questions.json");

  if (!existsSync(datasetPath)) {
    throw new Error(
      `Golden questions dataset not found at ${datasetPath}`
    );
  }

  const dataset: GoldenQuestion[] = JSON.parse(
    readFileSync(datasetPath, "utf-8")
  );

  console.log(`\n=== RAG Quality Evaluation (Keyword & Source Based) ===`);
  console.log(`Dataset: ${dataset.length} questions`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Town: ${TOWN_ID}\n`);

  const results: QuestionResult[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const q = dataset[i];
    const label = `[${i + 1}/${dataset.length}] ${q.id}`;

    process.stdout.write(`${label}: "${q.question.slice(0, 50)}..." `);

    const result = await evaluateQuestion(q);
    results.push(result);

    if (result.error) {
      console.log(`ERROR: ${result.error}`);
    } else {
      console.log(
        `${result.grade} (kw: ${pct(result.keywordHitRate)}, src: ${pct(result.sourceRelevanceScore)}) ${result.responseTimeMs}ms`
      );
    }

    // Delay between requests to avoid rate limiting
    if (i < dataset.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Calculate overall metrics
  const avgKeywordHitRate =
    results.reduce((sum, r) => sum + r.keywordHitRate, 0) / results.length;
  const avgSourceRelevance =
    results.reduce((sum, r) => sum + r.sourceRelevanceScore, 0) /
    results.length;
  const forbiddenContentPass = results.filter(
    (r) => r.forbiddenContentCheck === "PASS"
  ).length;
  const passing = results.filter(
    (r) => r.grade !== "F" && r.grade !== "D"
  ).length;
  const overallScore = (passing / results.length) * 100;

  const evalResults: EvalResults = {
    runDate: new Date().toISOString(),
    targetUrl: BASE_URL,
    totalQuestions: dataset.length,
    overallScore,
    avgKeywordHitRate,
    avgSourceRelevance,
    forbiddenContentPass,
    results,
  };

  // Print console scorecard
  printScorecard(evalResults);

  // Save JSON results
  const resultsDir = resolve(__dirname, "results");
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = resolve(resultsDir, `eval-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(evalResults, null, 2));

  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
