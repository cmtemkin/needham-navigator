/**
 * Bulk article generation — generates articles from ALL categorizable ingested
 * documents, not just the last 30 days. Use this for initial content seeding
 * or backfill.
 *
 * Usage: npx tsx --env-file=.env.local scripts/generate-articles-bulk.ts
 */

import {
  generateFromAllDocuments,
  generateDailyBrief,
} from '../src/lib/article-generator';

const DAYS_BACK = 365; // Look at ALL documents from the past year

async function main() {
  console.log('🗞️  Needham Navigator — Bulk Article Generation\n');
  console.log(`Looking back ${DAYS_BACK} days for uncovered documents...\n`);

  let generated = 0;
  let skipped = 0;

  try {
    console.log('📰 Generating from all categorizable documents...');
    const articles = await generateFromAllDocuments({ daysBack: DAYS_BACK });
    console.log(`   ✅ ${articles.length} articles generated\n`);
    generated += articles.length;

    console.log('📅 Generating daily brief...');
    const brief = await generateDailyBrief();
    if (brief) {
      console.log(`   ✅ Daily brief generated: "${brief.title}"\n`);
      generated += 1;
    } else {
      console.log('   ℹ️  Skipped (already exists or no new content)\n');
      skipped += 1;
    }
  } catch (error) {
    console.error('❌ Error during generation:', error);
    process.exit(1);
  }

  console.log('════════════════════════════════════════');
  console.log('📊 Bulk Generation Summary');
  console.log('════════════════════════════════════════');
  console.log(`✅ Generated:  ${generated} articles`);
  console.log(`⏭️  Skipped:   ${skipped}`);

  process.exit(0);
}

void main();
