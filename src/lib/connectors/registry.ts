/**
 * src/lib/connectors/registry.ts — Connector registry and factory
 *
 * Maps connector type strings to factory functions. When the runner needs
 * to instantiate a connector from a source_configs row, it looks up the
 * factory here and creates a SourceConnector instance.
 */

import type {
  ConnectorConfig,
  ConnectorFactory,
  SourceConnector,
} from "./types";

// ---------------------------------------------------------------------------
// Registry — maps connector types to factory functions
// ---------------------------------------------------------------------------

const factories = new Map<string, ConnectorFactory>();

/**
 * Register a connector factory for a given type + optional subtype.
 * Key format: "type" or "type:subtype" for specialized connectors.
 *
 * @example
 *   registerConnector("rss", createRssConnector);
 *   registerConnector("scrape:news", createNewsScraper);
 *   registerConnector("api:mbta", createMbtaConnector);
 */
export function registerConnector(key: string, factory: ConnectorFactory): void {
  factories.set(key, factory);
}

/**
 * Create a SourceConnector instance from a ConnectorConfig.
 *
 * Lookup order:
 *   1. "{connector_type}:{config.config.subtype}" (specialized)
 *   2. "{connector_type}" (generic)
 *
 * This lets you register generic handlers (e.g. "rss") while allowing
 * specialized overrides (e.g. "scrape:news-site", "api:mbta").
 */
export function createConnector(
  townId: string,
  connectorConfig: ConnectorConfig
): SourceConnector {
  const subtype = connectorConfig.config.subtype as string | undefined;
  const specializedKey = subtype
    ? `${connectorConfig.connector_type}:${subtype}`
    : null;

  // Try specialized factory first
  if (specializedKey && factories.has(specializedKey)) {
    return factories.get(specializedKey)!(townId, connectorConfig);
  }

  // Fall back to generic factory
  const genericFactory = factories.get(connectorConfig.connector_type);
  if (!genericFactory) {
    throw new Error(
      `No connector factory registered for type "${connectorConfig.connector_type}"` +
        (subtype ? ` (subtype: "${subtype}")` : "") +
        `. Registered: [${Array.from(factories.keys()).join(", ")}]`
    );
  }

  return genericFactory(townId, connectorConfig);
}

/**
 * List all registered connector type keys.
 */
export function listRegisteredConnectors(): string[] {
  return Array.from(factories.keys());
}
