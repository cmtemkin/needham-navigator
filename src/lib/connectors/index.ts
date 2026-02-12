/**
 * src/lib/connectors/index.ts — Public API for the connector framework
 */

export type {
  ContentCategory,
  ConnectorType,
  ConnectorSchedule,
  RawItem,
  ContentItem,
  SourceConnector,
  ConnectorConfig,
  ConnectorResult,
  ConnectorFactory,
} from "./types";

export { SCHEDULE_MS } from "./types";
export { registerConnector, createConnector, listRegisteredConnectors } from "./registry";
export { runConnectors, hashContent } from "./runner";
export type { RunOptions } from "./runner";
