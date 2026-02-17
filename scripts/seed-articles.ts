/**
 * Seed Articles Script
 * Run with: npx tsx scripts/seed-articles.ts
 */

import { getSupabaseServiceClient } from '../src/lib/supabase';
import type { CreateArticleInput } from '../src/types/article';

const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const SAMPLE_ARTICLES: CreateArticleInput[] = [
  {
    title: `Today in Needham — ${today}`,
    body: `## What's Happening Today\n\n- **Planning Board Meeting Tonight**: The Planning Board will meet at 7:00 PM at Town Hall to discuss the proposed mixed-use development at 1200 Highland Avenue.\n\n- **DPW Spring Yard Waste Collection Starts March 15**: Residents can begin placing yard waste at curbside starting next week. Use biodegradable bags or clearly marked containers.\n\n- **School Enrollment Opens**: Needham Public Schools announced that enrollment for the 2026-27 school year is now open. Deadline is March 31.\n\n- **New Building Permit Filed**: ABC Builders filed a permit for new construction at 456 Central Avenue, estimated project value $850,000.`,
    summary: 'Planning Board meeting tonight at 7 PM. Spring yard waste collection starts March 15. School enrollment open through March 31. New building permit filed for $850K project.',
    content_type: 'ai_generated',
    category: 'government',
    tags: ['planning', 'dpw', 'schools', 'permits'],
    town: 'needham',
    author: 'Needham Navigator AI',
    is_featured: true,
    is_daily_brief: true,
    model_used: 'gpt-5-nano',
    status: 'published',
  },
  {
    title: 'Planning Board Approves Mixed-Use Development at 1200 Highland Ave',
    subtitle: 'New project will bring 45 residential units and ground-floor retail to Highland Avenue',
    body: `## Development Details\n\nAt last night's Planning Board meeting, members voted 4-1 to approve a special permit for a mixed-use development at 1200 Highland Avenue. The project will replace the vacant former office building with a four-story structure containing 45 residential units and approximately 5,000 square feet of ground-floor retail space.\n\n## Key Features\n\n- **Residential Units**: 45 apartments (mix of 1BR, 2BR, and 3BR)\n- **Retail Space**: 5,000 sq ft of ground-floor commercial space\n- **Parking**: 68 spaces in underground garage\n- **Height**: 48 feet (within zoning limits)\n- **Green Space**: 15% of lot area dedicated to landscaping\n\n## Next Steps\n\nThe project now moves to the Building Department for permit review. Construction is expected to begin in summer 2026.`,
    summary: 'Planning Board approves 4-story, 45-unit mixed-use development at 1200 Highland Ave with ground-floor retail. Project includes underground parking. Traffic study required.',
    content_type: 'ai_generated',
    category: 'development',
    tags: ['planning', 'development', 'housing', 'highland avenue'],
    source_urls: ['https://www.needhamma.gov/planning-board-minutes-feb-2026'],
    source_type: 'meeting_minutes',
    source_names: ['Planning Board Meeting Minutes, Feb 2026'],
    town: 'needham',
    author: 'Needham Navigator AI',
    is_featured: true,
    model_used: 'gpt-5-nano',
    confidence_score: 0.92,
    status: 'published',
  },
  {
    title: 'Needham Public Schools Announce 2026-27 Enrollment Timeline',
    subtitle: 'Registration opens for all grade levels, deadline March 31',
    body: `## Enrollment Opens\n\nNeedham Public Schools has announced the enrollment timeline for the 2026-27 academic year. Registration is now open for all students, including incoming kindergarteners and families new to the district.\n\n## Important Dates\n\n- **Registration Opens**: February 17, 2026\n- **Registration Deadline**: March 31, 2026\n- **School Assignments Sent**: May 1, 2026\n\n## Kindergarten Requirements\n\nChildren must be 5 years old by September 1, 2026 to enroll in kindergarten. Required documents include proof of residency, immunization records, and a physical examination form.\n\n## How to Register\n\nFamilies can register online through the Parent Portal at needham.k12.ma.us or in person at the Central Office (1330 Highland Avenue).`,
    summary: 'Needham Schools enrollment for 2026-27 now open through March 31. Required: birth certificate, proof of residency, immunizations. Register online or in person at Central Office.',
    content_type: 'ai_generated',
    category: 'schools',
    tags: ['schools', 'enrollment', 'kindergarten', 'registration'],
    source_urls: ['https://www.needham.k12.ma.us/enrollment'],
    source_type: 'public_record',
    source_names: ['Needham Public Schools Enrollment Page'],
    town: 'needham',
    author: 'Needham Navigator AI',
    is_featured: true,
    model_used: 'gpt-5-nano',
    confidence_score: 0.95,
    status: 'published',
  },
  {
    title: 'DPW: Spring Yard Waste Collection Begins March 15',
    subtitle: 'Weekly curbside pickup runs through December',
    body: `## Collection Schedule\n\nThe Department of Public Works announces that spring yard waste collection will begin on March 15, 2026. Curbside pickup continues weekly through December 15, 2026.\n\n## What's Accepted\n\n- Grass clippings\n- Leaves\n- Small branches (under 4 feet, bundled)\n- Garden waste\n\n## Collection Guidelines\n\nUse biodegradable kraft paper bags or clearly marked reusable containers (32-gallon max). Place at curbside by 7:00 AM on your regular trash pickup day.\n\n## Transfer Station Option\n\nResidents can also drop off yard waste at the Transfer Station (275 Oak Street). Annual transfer station permits are required ($185/year). Call DPW at (781) 455-7550 for questions.`,
    summary: 'DPW spring yard waste collection starts March 15, runs weekly through December. Use biodegradable bags or marked containers, place at curb by 7 AM on trash day.',
    content_type: 'ai_generated',
    category: 'government',
    tags: ['dpw', 'yard waste', 'recycling', 'transfer station'],
    source_urls: ['https://www.needhamma.gov/dpw/yard-waste'],
    source_type: 'dpw_notice',
    source_names: ['DPW Yard Waste Collection Notice'],
    town: 'needham',
    author: 'Needham Navigator AI',
    model_used: 'gpt-5-nano',
    confidence_score: 0.97,
    status: 'published',
  },
  {
    title: 'Town Meeting Warrant Articles Preview: What to Know Before May Vote',
    subtitle: "A summary of key articles on this year's Town Meeting warrant",
    body: `## Overview\n\nNeedham's Annual Town Meeting is scheduled for May 5, 2026 at 7:00 PM. This year's warrant includes 42 articles covering budget approvals, zoning changes, and capital projects.\n\n## Major Articles\n\n**Article 5: FY2027 Operating Budget** — Total budget: $248.5 million, 4.2% increase from FY2026\n\n**Article 12: Center at the Heights Renovation** — $12.5 million for facility upgrades including HVAC and accessibility improvements\n\n**Article 18: Accessory Dwelling Units (ADUs)** — Allow ADUs by-right in single-family districts, max size 900 sq ft\n\n**Article 24: Solar Array on Town Property** — Install solar panels on DPW facility, estimated 20-year savings $450,000\n\n## How to Participate\n\nRegistered voters can attend Town Meeting in person at Needham High School. Pre-Town Meeting sessions will be held April 28 and May 2.`,
    summary: 'Annual Town Meeting May 5 at NHS. Key articles: $248M budget, $12M Center at Heights renovation, ADU zoning change, solar installation on DPW building.',
    content_type: 'ai_summary',
    category: 'government',
    tags: ['town meeting', 'budget', 'zoning', 'solar'],
    source_urls: ['https://www.needhamma.gov/town-meeting-warrant-2026'],
    source_type: 'public_record',
    source_names: ['Town Meeting Warrant 2026'],
    town: 'needham',
    author: 'Needham Navigator AI',
    model_used: 'gpt-5-nano',
    confidence_score: 0.89,
    status: 'published',
  },
  {
    title: 'Needham Police Department Launches Community Policing Initiative',
    subtitle: 'New program aims to strengthen relationships between officers and residents',
    body: `## Program Details\n\nThe Needham Police Department has launched a new community policing initiative focused on building stronger relationships with residents and local businesses.\n\n## Key Components\n\n**Neighborhood Liaisons** — Each neighborhood assigned a dedicated officer who will attend neighborhood association meetings.\n\n**Coffee with a Cop** — Monthly informal meetups at local coffee shops. The first event is March 8 at Blue Door Café from 8-10 AM.\n\n**Youth Engagement** — Expanded School Resource Officer program and summer youth academy.\n\nPolice Chief John Hart noted: "This program reflects our commitment to being active members of the Needham community." Contact NPD Community Relations at (781) 455-7570.`,
    summary: "NPD launches community policing program with neighborhood liaisons, monthly Coffee with a Cop events, and youth engagement. First event March 8 at Blue Door Café.",
    content_type: 'ai_summary',
    category: 'public_safety',
    tags: ['police', 'community', 'public safety'],
    source_urls: ['https://www.needhamma.gov/police/community-policing'],
    source_type: 'news_article',
    source_names: ['Needham Police Department Press Release'],
    town: 'needham',
    author: 'Needham Navigator AI',
    model_used: 'gpt-5-nano',
    confidence_score: 0.91,
    status: 'published',
  },
  {
    title: 'New Restaurant Opening on Great Plain Avenue',
    subtitle: 'Local entrepreneur brings farm-to-table dining to Needham Center',
    body: `A new farm-to-table restaurant is set to open in Needham Center this spring. "Harvest Table," owned by Needham native Sarah Chen, will occupy the former bank building at 1050 Great Plain Avenue.\n\nThe restaurant will feature seasonal menus using locally-sourced ingredients from Massachusetts farms. Harvest Table is targeting a late April opening, pending final inspections.\n\nRead the full story at Needham Times.`,
    summary: 'New farm-to-table restaurant "Harvest Table" opening at 1050 Great Plain Ave this spring. Chef Sarah Chen features local ingredients.',
    content_type: 'external',
    category: 'business',
    tags: ['business', 'restaurants', 'needham center'],
    source_urls: ['https://needhamtimes.com/harvest-table-opening'],
    source_type: 'news_article',
    source_names: ['Needham Times'],
    town: 'needham',
    author: 'External News Source',
    status: 'published',
  },
  {
    title: 'Needham Library Announces Summer Reading Program',
    subtitle: 'Programs for all ages, starting June 1',
    body: `## Summer Reading 2026\n\nThe Needham Free Public Library announces its Summer Reading Program themed "Adventure Awaits," running June 1 through August 15.\n\n## Programs by Age Group\n\n**Children (Ages 0-12)** — Weekly story times, LEGO club, science workshops\n\n**Teens (Ages 13-18)** — Gaming tournaments, creative writing workshops, volunteer opportunities\n\n**Adults** — Book discussion groups, author talks, technology classes\n\n## Registration\n\nRegistration opens May 1 via needhamlibrary.org. Most programs are free.\n\n## Summer Hours\n\nMonday-Thursday: 9 AM - 9 PM, Friday-Saturday: 9 AM - 5 PM, Sunday: 1 PM - 5 PM`,
    summary: 'Needham Library summer reading program "Adventure Awaits" runs June 1-Aug 15. Programs for all ages, registration opens May 1. Extended summer hours.',
    content_type: 'ai_generated',
    category: 'community',
    tags: ['library', 'summer', 'reading', 'programs'],
    source_urls: ['https://www.needhamlibrary.org/summer-reading'],
    source_type: 'public_record',
    source_names: ['Needham Free Public Library'],
    town: 'needham',
    author: 'Needham Navigator AI',
    model_used: 'gpt-5-nano',
    confidence_score: 0.94,
    status: 'published',
  },
];

async function seedArticles() {
  console.log('🌱 Seeding articles...\n');

  const supabase = getSupabaseServiceClient();

  const { count } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('town', 'needham');

  if (count && count > 0) {
    console.log(`⚠️  Found ${count} existing articles. Deleting and reseeding...`);
    await supabase.from('articles').delete().eq('town', 'needham');
  }

  const articlesWithTimestamps = SAMPLE_ARTICLES.map((article, index) => ({
    ...article,
    published_at: new Date(Date.now() - index * 3600000).toISOString(),
  }));

  const { data, error } = await supabase
    .from('articles')
    .insert(articlesWithTimestamps)
    .select();

  if (error) {
    console.error('❌ Error seeding articles:', error);
    process.exit(1);
  }

  console.log(`✅ Successfully seeded ${data.length} articles!`);
  console.log('\nBy content type:');
  const byType = data.reduce((acc: Record<string, number>, a) => {
    acc[a.content_type] = (acc[a.content_type] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byType).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
}

seedArticles().catch(console.error);
