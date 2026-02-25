/**
 * scripts/seed-event-sources.ts — Seed event source configs
 *
 * Inserts/updates source_configs for the three Needham event sources:
 * 1. Town Calendar (CivicPlus iCal feeds - confirmed working)
 * 2. Library Events (Assabet Interactive - needs scraper, no iCal)
 * 3. School Calendar (SharpSchool - needs manual iCal URL discovery)
 *
 * Run: npx tsx scripts/seed-event-sources.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EVENT_SOURCES = [
  // Town Calendar - Public Meetings (confirmed working iCal feed)
  {
    id: "needham:town-meetings",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    enabled: true,
    should_embed: false,
    config: {
      feedUrl: "https://www.needhamma.gov/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar",
      sourceName: "Town of Needham - Public Meetings",
      daysAhead: 90,
    },
  },
  // Town Calendar - Community Events (confirmed working iCal feed)
  {
    id: "needham:town-community",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    enabled: true,
    should_embed: false,
    config: {
      feedUrl: "https://www.needhamma.gov/common/modules/iCalendar/iCalendar.aspx?catID=84&feed=calendar",
      sourceName: "Town of Needham - Community Events",
      daysAhead: 90,
    },
  },
  // Town Calendar - Park and Recreation (confirmed working iCal feed)
  {
    id: "needham:town-parks-rec",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    enabled: true,
    should_embed: false,
    config: {
      feedUrl: "https://www.needhamma.gov/common/modules/iCalendar/iCalendar.aspx?catID=15&feed=calendar",
      sourceName: "Town of Needham - Parks & Recreation",
      daysAhead: 90,
    },
  },
  // Library Events - Assabet Interactive (no iCal feed, needs scraper)
  // Leaving disabled until a JSON-LD scraper connector is built
  {
    id: "needham:library-events",
    town_id: "needham",
    connector_type: "scrape",
    category: "events",
    schedule: "daily",
    enabled: false,
    should_embed: false,
    config: {
      baseUrl: "https://needhamma.assabetinteractive.com/calendar/",
      sourceName: "Needham Public Library",
      daysAhead: 90,
      note: "Needs custom JSON-LD scraper - structured data available in page <script type='application/ld+json'> tags",
    },
  },
  // School Calendar - SharpSchool (iCal URL needs manual discovery)
  // Leaving disabled until iCal feed URL is confirmed
  {
    id: "needham:school-calendar",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    enabled: false,
    should_embed: false,
    config: {
      feedUrl: "",
      sourceName: "Needham Public Schools",
      daysAhead: 90,
      note: "SharpSchool iCal feed URL is JS-rendered. Visit the subscription page in a browser to capture the URL.",
    },
  },
];

async function main() {
  console.log("Seeding event source configs...\n");

  for (const source of EVENT_SOURCES) {
    const { error } = await supabase
      .from("source_configs")
      .upsert(source, { onConflict: "id" });

    if (error) {
      console.error(`  ERROR seeding ${source.id}: ${error.message}`);
    } else {
      const status = source.enabled ? "ENABLED" : "DISABLED (needs setup)";
      console.log(`  ${status}: ${source.id} (${source.connector_type})`);
    }
  }

  console.log("\nDone! Run the ingest cron to fetch events:");
  console.log('  curl -H "Authorization: Bearer $CRON_SECRET" "https://staging.needhamnavigator.com/api/cron/ingest?force=true"\n');
}

main().catch(console.error);
