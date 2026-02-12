/**
 * scripts/seed-sources.ts — Seed source_configs for a town
 *
 * Inserts connector configurations into the source_configs table.
 * Run: npx tsx scripts/seed-sources.ts [--town needham] [--clear]
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Source configurations by town
// ---------------------------------------------------------------------------

interface SourceSeed {
  id: string;
  town_id: string;
  connector_type: string;
  category: string;
  schedule: string;
  config: Record<string, unknown>;
  enabled: boolean;
  should_embed: boolean;
}

const NEEDHAM_SOURCES: SourceSeed[] = [
  // Government RSS
  {
    id: "needham:town-rss",
    town_id: "needham",
    connector_type: "rss",
    category: "government",
    schedule: "daily",
    config: {
      feedUrl: "https://www.needhamma.gov/rss.aspx",
      sourceName: "Town of Needham",
    },
    enabled: true,
    should_embed: true,
  },

  // Local News - Needham Patch
  {
    id: "needham:patch-news",
    town_id: "needham",
    connector_type: "scrape",
    category: "news",
    schedule: "daily",
    config: {
      url: "https://patch.com/massachusetts/needham",
      sourceName: "Needham Patch",
      articleSelector: "a[href]",
      articleUrlPattern: "patch\\.com/massachusetts/needham/.+",
      maxPages: 15,
    },
    enabled: true,
    should_embed: true,
  },

  // Local News - Needham Observer
  {
    id: "needham:observer-news",
    town_id: "needham",
    connector_type: "scrape",
    category: "news",
    schedule: "daily",
    config: {
      url: "https://needhamobserver.com",
      sourceName: "Needham Observer",
      articleSelector: "article a, .entry-title a, h2 a, h3 a",
      maxPages: 15,
    },
    enabled: true,
    should_embed: true,
  },

  // Local News - Needham Local
  {
    id: "needham:needham-local",
    town_id: "needham",
    connector_type: "scrape",
    category: "news",
    schedule: "daily",
    config: {
      url: "https://needhamlocal.org",
      sourceName: "Needham Local",
      articleSelector: "article a, .post-title a, h2 a",
      maxPages: 10,
    },
    enabled: true,
    should_embed: true,
  },

  // Events - School Calendar (placeholder — needs actual iCal URL)
  {
    id: "needham:school-calendar",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    config: {
      feedUrl: "https://www.needham.k12.ma.us/calendar/ical",
      sourceName: "Needham Public Schools",
      daysAhead: 90,
    },
    enabled: false, // disabled until we confirm the iCal URL
    should_embed: true,
  },

  // Events - Library
  {
    id: "needham:library-events",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    config: {
      feedUrl: "https://needhamlibrary.org/events/?ical=1",
      sourceName: "Needham Free Public Library",
      daysAhead: 90,
    },
    enabled: false, // disabled until we confirm the iCal URL
    should_embed: true,
  },

  // Events - Town Community Calendar
  {
    id: "needham:community-calendar",
    town_id: "needham",
    connector_type: "ical",
    category: "events",
    schedule: "daily",
    config: {
      feedUrl: "https://www.needhamma.gov/calendar.aspx?CID=84",
      sourceName: "Town of Needham Events",
      daysAhead: 90,
    },
    enabled: false, // disabled until we confirm the iCal URL
    should_embed: true,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const townId = args.includes("--town")
    ? args[args.indexOf("--town") + 1]
    : "needham";
  const shouldClear = args.includes("--clear");

  console.log(`\nSeeding source_configs for town: ${townId}`);

  if (shouldClear) {
    console.log("Clearing existing configs...");
    const { error } = await supabase
      .from("source_configs")
      .delete()
      .eq("town_id", townId);
    if (error) {
      console.error("Failed to clear:", error.message);
      process.exit(1);
    }
    console.log("Cleared.");
  }

  const sources = NEEDHAM_SOURCES.filter((s) => s.town_id === townId);

  if (sources.length === 0) {
    console.log(`No sources defined for town "${townId}"`);
    process.exit(0);
  }

  let inserted = 0;
  let skipped = 0;

  for (const source of sources) {
    const { error } = await supabase
      .from("source_configs")
      .upsert(source, { onConflict: "id" });

    if (error) {
      console.error(`  Failed: ${source.id} — ${error.message}`);
      skipped++;
    } else {
      const status = source.enabled ? "enabled" : "disabled";
      console.log(`  ${source.id} (${source.connector_type}/${source.category}) — ${status}`);
      inserted++;
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} failed`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
