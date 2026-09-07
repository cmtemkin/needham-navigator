-- Ported from supabase/migrations/20260222_add_events_scraper_source.sql for Neon.
-- No changes required.
-- Regenerate with: npx tsx scripts/port-migrations-to-neon.ts

-- Add Town Calendar as a content source for the events scraper
INSERT INTO source_configs (id, town_id, connector_type, category, schedule, config, enabled, should_embed)
VALUES (
  'needhamma-calendar',
  'needham',
  'scrape',
  'events',
  'daily',
  '{"urls": ["https://www.needhamma.gov/calendar.aspx", "https://www.needhamma.gov/CivicAlerts.aspx"], "sourceName": "Town Calendar"}'::jsonb,
  true,
  false
)
ON CONFLICT (id) DO NOTHING;
