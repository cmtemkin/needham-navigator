/**
 * src/lib/connectors/register-all.ts — Register all connector factories
 *
 * Import this module to register every connector type with the registry.
 * The cron route imports this to ensure all factories are available
 * before the runner tries to instantiate connectors.
 */

import { registerConnector } from "./registry";
import { createRssConnector } from "./rss";
import { createICalConnector } from "./ical";
import { createScraperConnector } from "./scraper";

// Generic connector types
registerConnector("rss", createRssConnector);
registerConnector("ical", createICalConnector);
registerConnector("scrape", createScraperConnector);

// Specialized connector types will be registered here as they're built:
// registerConnector("api:mbta", createMbtaConnector);
// registerConnector("api:weather", createWeatherConnector);
// registerConnector("scrape:news", createNewsScraper);
// registerConnector("scrape:police-blotter", createPoliceBlotterScraper);
// registerConnector("scrape:dining", createDiningConnector);
