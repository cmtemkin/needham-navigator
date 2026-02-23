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
