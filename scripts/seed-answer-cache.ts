#!/usr/bin/env tsx
/**
 * Cache Seeding Script
 *
 * Pre-populates the answer cache by sending golden test dataset questions
 * to the local chat API and storing the responses.
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. In another terminal: npm run seed-cache
 *
 * Rate limit: 1 request per 2 seconds to avoid overwhelming the API
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { setCachedAnswer } from '../src/lib/answer-cache';

const DATASET_PATH = join(__dirname, '..', 'docs', 'golden-test-dataset-verified.json');
const CHAT_API_URL = 'http://localhost:3000/api/chat';
const RATE_LIMIT_MS = 2000; // 2 seconds between requests
const TOWN_ID = 'needham';

interface GoldenTestQuestion {
  id: string;
  question: string;
  category: string;
  verification_status: string;
  verified_answer_contains: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  messages?: ChatMessage[];
  error?: string;
}

/**
 * Send a question to the chat API and collect the full response.
 * Returns the response text and sources.
 */
async function askQuestion(question: string): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: question }],
      town_id: TOWN_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API returned ${response.status}: ${await response.text()}`);
  }

  // The chat API returns a streaming response. We need to consume it.
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullText = '';
  const sources: { title: string; url: string }[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        if (!line.startsWith('data: ')) continue;

        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);

          // Collect text deltas
          if (data.type === 'text-delta' && data.delta) {
            fullText += data.delta;
          }

          // Collect sources
          if (data.type === 'data-sources' && Array.isArray(data.data)) {
            for (const source of data.data) {
              if (source.document_title && source.document_url) {
                sources.push({
                  title: source.document_title,
                  url: source.document_url,
                });
              }
            }
          }
        } catch (parseError) {
          // Skip malformed JSON
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { text: fullText.trim(), sources };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🌱 Cache Seeding Script');
  console.log('========================\n');

  // Load dataset
  let dataset: GoldenTestQuestion[];
  try {
    const raw = readFileSync(DATASET_PATH, 'utf-8');
    dataset = JSON.parse(raw);
    console.log(`✓ Loaded ${dataset.length} questions from golden test dataset\n`);
  } catch (error) {
    console.error('❌ Failed to load dataset:', error);
    process.exit(1);
  }

  // Filter to verified questions only
  const verifiedQuestions = dataset.filter(
    (q) => q.verification_status === 'verified'
  );
  console.log(`📋 Processing ${verifiedQuestions.length} verified questions\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < verifiedQuestions.length; i++) {
    const question = verifiedQuestions[i];
    const progress = `[${i + 1}/${verifiedQuestions.length}]`;

    try {
      const start = Date.now();
      console.log(`${progress} Caching: "${question.question.slice(0, 60)}${question.question.length > 60 ? '...' : ''}"`);

      const { text, sources } = await askQuestion(question.question);

      if (!text) {
        console.log(`  ⚠️  Empty response, skipping cache\n`);
        failCount++;
        continue;
      }

      await setCachedAnswer(question.question, TOWN_ID, text, sources);

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ✓ Cached (${elapsed}s, ${sources.length} sources)\n`);
      successCount++;

      // Rate limit
      if (i < verifiedQuestions.length - 1) {
        await sleep(RATE_LIMIT_MS);
      }
    } catch (error) {
      console.log(`  ❌ Failed:`, error instanceof Error ? error.message : String(error));
      console.log();
      failCount++;
    }
  }

  console.log('========================');
  console.log(`✅ Done: ${successCount} cached, ${failCount} failed`);
  console.log();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
