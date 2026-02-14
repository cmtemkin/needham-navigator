/**
 * RAG Quality Scorecard Generator
 *
 * Reads a docs/eval-results-*.json file (most recent by default) and produces
 * a markdown scorecard at docs/eval-scorecard-YYYY-MM-DD.md.
 *
 * Usage:  npx tsx scripts/eval-scorecard.ts [path-to-eval-results.json]
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Types (mirrors eval-golden-test.ts output)
// ---------------------------------------------------------------------------

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
// Helpers
// ---------------------------------------------------------------------------

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

function emoji(score: number): string {
  if (score >= 0.8) return "🟢";
  if (score >= 0.5) return "🟡";
  return "🔴";
}

// ---------------------------------------------------------------------------
// Find most recent eval results file
// ---------------------------------------------------------------------------

function findLatestResults(): string {
  const docsDir = resolve(__dirname, "../docs");
  const files = readdirSync(docsDir)
    .filter((f) => f.startsWith("eval-results-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(
      "No eval-results-*.json files found in docs/. Run `npm run eval` first.",
    );
  }

  return resolve(docsDir, files[0]);
}

// ---------------------------------------------------------------------------
// Build scorecard
// ---------------------------------------------------------------------------

function buildScorecard(data: EvalResults): string {
  const { results } = data;
  const overallScore = avg(results.map((r) => r.score));
  const totalFacts = results.reduce((s, r) => s + r.total_facts, 0);
  const totalFound = results.reduce((s, r) => s + r.facts_found, 0);
  const times = results.filter((r) => !r.error).map((r) => r.response_time_ms);
  const errors = results.filter((r) => r.error);

  const lines: string[] = [];

  // Header
  lines.push("# RAG Quality Evaluation Scorecard");
  lines.push("");
  lines.push(`**Run Date:** ${data.run_date}`);
  lines.push(`**API:** ${data.api_url}`);
  lines.push(`**Town:** ${data.town_id}`);
  lines.push(`**Questions:** ${data.total_questions}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Overall score
  lines.push("## Overall Score");
  lines.push("");
  lines.push(
    `### ${emoji(overallScore)} ${pct(overallScore)} (${totalFound} / ${totalFacts} facts found)`,
  );
  lines.push("");

  const passCount = results.filter((r) => r.score >= 0.5).length;
  const fullPassCount = results.filter((r) => r.score === 1).length;
  lines.push(`- **Pass rate (≥50% facts):** ${passCount}/${results.length} (${pct(passCount / results.length)})`);
  lines.push(`- **Perfect score (100%):** ${fullPassCount}/${results.length} (${pct(fullPassCount / results.length)})`);
  if (errors.length > 0) {
    lines.push(`- **Errors:** ${errors.length} questions failed to get a response`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Score by category
  lines.push("## Score by Category");
  lines.push("");
  lines.push("| Category | Questions | Avg Score | Facts Found | Pass Rate |");
  lines.push("|----------|-----------|-----------|-------------|-----------|");

  const byCategory = groupBy(results, (r) => r.category);
  const sortedCategories = Array.from(byCategory.entries()).sort(
    (a, b) => avg(a[1].map((r) => r.score)) - avg(b[1].map((r) => r.score)),
  );

  for (const [category, items] of sortedCategories) {
    const catScore = avg(items.map((r) => r.score));
    const catFacts = items.reduce((s, r) => s + r.facts_found, 0);
    const catTotal = items.reduce((s, r) => s + r.total_facts, 0);
    const catPass = items.filter((r) => r.score >= 0.5).length;
    lines.push(
      `| ${emoji(catScore)} ${category} | ${items.length} | ${pct(catScore)} | ${catFacts}/${catTotal} | ${catPass}/${items.length} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Score by difficulty
  lines.push("## Score by Difficulty");
  lines.push("");
  lines.push("| Difficulty | Questions | Avg Score | Pass Rate |");
  lines.push("|------------|-----------|-----------|-----------|");

  const byDifficulty = groupBy(results, (r) => r.difficulty);
  for (const diff of ["Easy", "Medium", "Hard"]) {
    const items = byDifficulty.get(diff) ?? [];
    if (items.length === 0) continue;
    const diffScore = avg(items.map((r) => r.score));
    const diffPass = items.filter((r) => r.score >= 0.5).length;
    lines.push(
      `| ${emoji(diffScore)} ${diff} | ${items.length} | ${pct(diffScore)} | ${diffPass}/${items.length} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Score by verification status
  lines.push("## Score by Verification Status");
  lines.push("");
  lines.push("| Status | Questions | Avg Score | Pass Rate |");
  lines.push("|--------|-----------|-----------|-----------|");

  const byStatus = groupBy(results, (r) => r.verification_status);
  for (const [status, items] of byStatus.entries()) {
    const statusScore = avg(items.map((r) => r.score));
    const statusPass = items.filter((r) => r.score >= 0.5).length;
    lines.push(
      `| ${emoji(statusScore)} ${status} | ${items.length} | ${pct(statusScore)} | ${statusPass}/${items.length} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Top 10 worst questions
  lines.push("## Top 10 Worst Questions");
  lines.push("");
  const worst = [...results].sort((a, b) => a.score - b.score).slice(0, 10);

  for (const r of worst) {
    const missingFacts = r.facts
      .filter((f) => !f.found)
      .map((f) => f.fact);
    lines.push(`### ${r.id} — ${pct(r.score)} (${r.facts_found}/${r.total_facts})`);
    lines.push(`**Q:** ${r.question}`);
    lines.push(`**Category:** ${r.category} | **Difficulty:** ${r.difficulty}`);
    if (missingFacts.length > 0) {
      lines.push(`**Missing facts:**`);
      for (const fact of missingFacts) {
        lines.push(`- ${fact}`);
      }
    }
    if (r.error) {
      lines.push(`**Error:** ${r.error}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Top 10 best questions
  lines.push("## Top 10 Best Questions");
  lines.push("");
  const best = [...results].sort((a, b) => b.score - a.score).slice(0, 10);

  for (const r of best) {
    lines.push(
      `- ${emoji(r.score)} **${r.id}** — ${pct(r.score)} (${r.facts_found}/${r.total_facts}) — "${r.question.slice(0, 70)}"`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Response time stats
  lines.push("## Response Time Statistics");
  lines.push("");
  if (times.length > 0) {
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Average | ${Math.round(avg(times))}ms |`);
    lines.push(`| Median (P50) | ${Math.round(median(times))}ms |`);
    lines.push(`| P95 | ${Math.round(percentile(times, 95))}ms |`);
    lines.push(`| Slowest | ${Math.round(Math.max(...times))}ms |`);
    lines.push(`| Fastest | ${Math.round(Math.min(...times))}ms |`);
  } else {
    lines.push("No response time data available (all requests errored).");
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Recommendations
  lines.push("## Recommendations for RAG Improvement");
  lines.push("");

  // Analyze weak categories
  const weakCategories = sortedCategories
    .filter(([, items]) => avg(items.map((r) => r.score)) < 0.5)
    .map(([cat]) => cat);

  if (weakCategories.length > 0) {
    lines.push("### Weak Categories (below 50% avg score)");
    lines.push("");
    for (const cat of weakCategories) {
      lines.push(`- **${cat}** — Consider adding more source documents or improving chunk quality for this topic area`);
    }
    lines.push("");
  }

  // Common missing facts
  const allMissing = results.flatMap((r) =>
    r.facts.filter((f) => !f.found).map((f) => ({
      fact: f.fact,
      category: r.category,
      id: r.id,
    })),
  );

  if (allMissing.length > 0) {
    lines.push("### Missing Fact Patterns");
    lines.push("");

    // Group by category to find patterns
    const missingByCategory = groupBy(allMissing, (m) => m.category);
    for (const [cat, items] of missingByCategory.entries()) {
      if (items.length >= 3) {
        lines.push(`- **${cat}**: ${items.length} missing facts across ${new Set(items.map((i) => i.id)).size} questions`);
      }
    }
    lines.push("");
  }

  // General recommendations
  lines.push("### General Recommendations");
  lines.push("");

  if (overallScore < 0.5) {
    lines.push("1. **Critical:** Overall score below 50%. Review source document coverage and chunking strategy");
  }

  const slowP95 = times.length > 0 ? percentile(times, 95) : 0;
  if (slowP95 > 5000) {
    lines.push(`1. **Performance:** P95 response time is ${Math.round(slowP95)}ms. Consider optimizing embedding generation or reducing chunk count`);
  }

  if (errors.length > 0) {
    lines.push(`1. **Reliability:** ${errors.length} questions returned errors. Investigate API stability`);
  }

  const hardScore = avg((byDifficulty.get("Hard") ?? []).map((r) => r.score));
  if (hardScore < 0.4) {
    lines.push("1. **Hard questions underperforming:** Consider adding more detailed source documents for complex multi-part topics");
  }

  const partiallyVerified = byStatus.get("partially_verified") ?? [];
  const pvScore = avg(partiallyVerified.map((r) => r.score));
  if (partiallyVerified.length > 0 && pvScore < 0.4) {
    lines.push("1. **Partially-verified questions scoring low:** These questions may need more specific source documents or better chunking");
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Generated by `npm run eval:scorecard`*");
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const inputPath = process.argv[2]
    ? resolve(process.argv[2])
    : findLatestResults();

  console.log(`Reading: ${inputPath}`);

  const data: EvalResults = JSON.parse(readFileSync(inputPath, "utf-8"));
  const scorecard = buildScorecard(data);

  const dateStr = data.run_date.split("T")[0];
  const outputPath = resolve(__dirname, `../docs/eval-scorecard-${dateStr}.md`);

  writeFileSync(outputPath, scorecard);
  console.log(`Scorecard written to: ${outputPath}`);
  console.log(`\nOverall score: ${pct(avg(data.results.map((r) => r.score)))}`);
}

main();
