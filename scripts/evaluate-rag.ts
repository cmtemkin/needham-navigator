#!/usr/bin/env ts-node
/**
 * RAG Quality Evaluation Script
 *
 * Runs golden test queries and evaluates search quality
 * Usage: npx ts-node scripts/evaluate-rag.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const GOLDEN_SET_PATH = path.join(__dirname, '../__tests__/rag-quality/golden-set.json');
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface GoldenQuery {
  query: string;
  expectedKeywords: string[];
  minSimilarity: number;
  expectedGrade: string;
}

interface SearchResult {
  title: string;
  snippet: string;
  similarity: number;
}

interface EvaluationResult {
  query: string;
  resultCount: number;
  topSimilarity: number;
  avgSimilarity: number;
  keywordsFound: number;
  keywordsTotal: number;
  grade: string;
  passed: boolean;
  error?: string;
}

async function runQuery(query: string): Promise<{ results: SearchResult[] }> {
  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, town_id: 'needham' }),
  });

  if (!response.ok) {
    throw new Error(`Search API returned ${response.status}`);
  }

  return response.json();
}

function gradeQuery(golden: GoldenQuery, results: SearchResult[]): EvaluationResult {
  if (results.length === 0) {
    return {
      query: golden.query,
      resultCount: 0,
      topSimilarity: 0,
      avgSimilarity: 0,
      keywordsFound: 0,
      keywordsTotal: golden.expectedKeywords.length,
      grade: 'F',
      passed: false,
      error: 'No results returned',
    };
  }

  const topSimilarity = results[0].similarity;
  const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

  // Check keyword coverage in top 3 results
  const top3Text = results
    .slice(0, 3)
    .map((r) => `${r.title} ${r.snippet}`)
    .join(' ')
    .toLowerCase();

  const keywordsFound = golden.expectedKeywords.filter((keyword) =>
    top3Text.includes(keyword.toLowerCase())
  ).length;

  const keywordCoverage = keywordsFound / golden.expectedKeywords.length;

  // Grading logic
  let grade = 'F';
  let passed = false;

  if (topSimilarity >= golden.minSimilarity && keywordCoverage >= 0.75) {
    grade = 'A';
    passed = true;
  } else if (topSimilarity >= golden.minSimilarity - 0.1 && keywordCoverage >= 0.5) {
    grade = 'B';
    passed = true;
  } else if (topSimilarity >= golden.minSimilarity - 0.2) {
    grade = 'C';
  } else {
    grade = 'D';
  }

  return {
    query: golden.query,
    resultCount: results.length,
    topSimilarity,
    avgSimilarity,
    keywordsFound,
    keywordsTotal: golden.expectedKeywords.length,
    grade,
    passed,
  };
}

async function main() {
  console.log('🔍 RAG Quality Evaluation\n');
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Golden Set: ${GOLDEN_SET_PATH}\n`);

  // Load golden set
  const goldenSet: GoldenQuery[] = JSON.parse(fs.readFileSync(GOLDEN_SET_PATH, 'utf-8'));
  console.log(`Loaded ${goldenSet.length} test queries\n`);

  const results: EvaluationResult[] = [];
  let passCount = 0;

  for (const golden of goldenSet) {
    process.stdout.write(`Testing: "${golden.query}"... `);

    try {
      const searchResults = await runQuery(golden.query);
      const evaluation = gradeQuery(golden, searchResults.results);
      results.push(evaluation);

      if (evaluation.passed) {
        passCount++;
        console.log(`✅ ${evaluation.grade} (similarity: ${evaluation.topSimilarity.toFixed(2)})`);
      } else {
        console.log(`❌ ${evaluation.grade} (similarity: ${evaluation.topSimilarity.toFixed(2)}, keywords: ${evaluation.keywordsFound}/${evaluation.keywordsTotal})`);
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        query: golden.query,
        resultCount: 0,
        topSimilarity: 0,
        avgSimilarity: 0,
        keywordsFound: 0,
        keywordsTotal: golden.expectedKeywords.length,
        grade: 'F',
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Evaluation Summary\n');
  console.log(`Total Queries: ${goldenSet.length}`);
  console.log(`Passed: ${passCount} (${Math.round((passCount / goldenSet.length) * 100)}%)`);
  console.log(`Failed: ${goldenSet.length - passCount}\n`);

  const avgTopSimilarity = results.reduce((sum, r) => sum + r.topSimilarity, 0) / results.length;
  const avgKeywordCoverage = results.reduce((sum, r) => sum + (r.keywordsFound / r.keywordsTotal), 0) / results.length;

  console.log(`Average Top Similarity: ${avgTopSimilarity.toFixed(3)}`);
  console.log(`Average Keyword Coverage: ${(avgKeywordCoverage * 100).toFixed(1)}%\n`);

  // Grade distribution
  const gradeCounts: Record<string, number> = {};
  for (const result of results) {
    gradeCounts[result.grade] = (gradeCounts[result.grade] || 0) + 1;
  }

  console.log('Grade Distribution:');
  for (const grade of ['A', 'B', 'C', 'D', 'F']) {
    const count = gradeCounts[grade] || 0;
    console.log(`  ${grade}: ${'█'.repeat(count)} ${count}`);
  }

  // Fail if pass rate < 70%
  const passRate = passCount / goldenSet.length;
  if (passRate < 0.7) {
    console.log(`\n❌ QUALITY ALERT: Pass rate ${(passRate * 100).toFixed(1)}% is below 70% threshold`);
    process.exit(1);
  } else {
    console.log(`\n✅ Quality check passed (${(passRate * 100).toFixed(1)}%)`);
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
