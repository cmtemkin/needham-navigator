/**
 * Article generation script — run nightly via GitHub Actions or manually.
 * Run with: npx tsx scripts/generate-articles.ts
 *
 * Generates articles ONLY from real ingested documents in the Supabase database.
 * Articles without sufficient real source material are skipped, not hallucinated.
 */

import {
  generateFromMeetingMinutes,
  generateFromPublicRecord,
  summarizeExternalArticle,
  generateDailyBrief,
} from '../src/lib/article-generator';

async function main() {
  console.log('🗞️  Needham Navigator — Article Generation\n');
  console.log(`Running at: ${new Date().toISOString()}\n`);

  let totalGenerated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // Step 1: Meeting minutes
  console.log('📋 Generating from meeting minutes...');
  try {
    const articles = await generateFromMeetingMinutes();
    console.log(`   ✅ ${articles.length} article${articles.length !== 1 ? 's' : ''} generated`);
    totalGenerated += articles.length;
    if (articles.length === 0) totalSkipped++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${msg}`);
    errors.push(`Meeting minutes: ${msg}`);
  }

  // Step 2: Public records (permits, DPW, health, etc.)
  console.log('\n📄 Generating from public records...');
  try {
    const articles = await generateFromPublicRecord();
    console.log(`   ✅ ${articles.length} article${articles.length !== 1 ? 's' : ''} generated`);
    totalGenerated += articles.length;
    if (articles.length === 0) totalSkipped++;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${msg}`);
    errors.push(`Public records: ${msg}`);
  }

  // Step 3: External articles (RSS/scrape → AI summary)
  console.log('\n📰 Summarizing external articles...');
  try {
    const articles = await summarizeExternalArticle();
    console.log(
      articles.length > 0
        ? `   ✅ ${articles.length} summaries generated`
        : '   ℹ️  No new external articles to process'
    );
    totalGenerated += articles.length;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${msg}`);
    errors.push(`External articles: ${msg}`);
  }

  // Step 4: Daily brief
  console.log('\n📅 Generating daily brief...');
  try {
    const brief = await generateDailyBrief();
    if (brief) {
      console.log(`   ✅ Daily brief generated: "${brief.title}"`);
      totalGenerated += 1;
    } else {
      console.log('   ℹ️  Daily brief skipped (already exists for today or no new content)');
      totalSkipped += 1;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${msg}`);
    errors.push(`Daily brief: ${msg}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(40));
  console.log('📊 Generation Summary');
  console.log('═'.repeat(40));
  console.log(`✅ Generated:  ${totalGenerated} article${totalGenerated !== 1 ? 's' : ''}`);
  console.log(`⏭️  Skipped:   ${totalSkipped} (no data or already exists)`);
  console.log(`❌ Errors:     ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nError details:');
    errors.forEach((e) => console.log(`  • ${e}`));
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
