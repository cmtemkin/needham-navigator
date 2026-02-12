/**
 * src/lib/connectors/types.ts — Core type definitions for the connector framework
 *
 * Every data source (RSS, iCal, API, web scraper, PDF) implements the
 * SourceConnector interface. The runner invokes fetch() + normalize() on
 * a schedule and upserts the resulting ContentItems into Supabase.
 */

// ---------------------------------------------------------------------------
// Content categories — what kind of information this is
// ---------------------------------------------------------------------------

export type ContentCategory =
  | "news"
  | "events"
  | "dining"
  | "safety"
  | "transit"
  | "weather"
  | "government"
  | "community"
  | "sports";

// ---------------------------------------------------------------------------
// Connector types — how the data is fetched
// ---------------------------------------------------------------------------

export type ConnectorType = "rss" | "ical" | "api" | "scrape" | "pdf";

// ---------------------------------------------------------------------------
// Schedules — how often the connector runs
// ---------------------------------------------------------------------------

export type ConnectorSchedule = "5min" | "15min" | "hourly" | "daily" | "weekly";

/** Map schedule names to milliseconds for comparison */
export const SCHEDULE_MS: Record<ConnectorSchedule, number> = {
  "5min": 5 * 60 * 1000,
  "15min": 15 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Raw item — what a connector fetches before normalization
// ---------------------------------------------------------------------------

export interface RawItem {
  /** Connector-specific raw data */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// ContentItem — the normalized, universal item stored in Supabase
// ---------------------------------------------------------------------------

export interface ContentItem {
  /** Source connector ID (e.g. "needham:patch-news") */
  source_id: string;
  /** Content category */
  category: ContentCategory;
  /** Item title */
  title: string;
  /** Full content (markdown or plain text) */
  content: string;
  /** AI-generated summary (filled later if shouldEmbed) */
  summary?: string;
  /** When this item was originally published */
  published_at: Date;
  /** When this item expires (events end, transit alerts clear) */
  expires_at?: Date;
  /** Original URL */
  url?: string;
  /** Image URL for display */
  image_url?: string;
  /** Arbitrary metadata specific to the content type */
  metadata: Record<string, unknown>;
  /** SHA-256 hash for deduplication */
  content_hash: string;
}

// ---------------------------------------------------------------------------
// SourceConnector — the interface every connector implements
// ---------------------------------------------------------------------------

export interface SourceConnector {
  /** Unique connector ID (e.g. "needham:patch-news") */
  id: string;
  /** How data is fetched */
  type: ConnectorType;
  /** What kind of content this produces */
  category: ContentCategory;
  /** How often to run */
  schedule: ConnectorSchedule;
  /** Which town this connector belongs to */
  townId: string;
  /** Whether items should be embedded for RAG search */
  shouldEmbed: boolean;

  /** Fetch raw data from the source */
  fetch(): Promise<RawItem[]>;

  /** Transform raw data into normalized ContentItems */
  normalize(raw: RawItem[]): ContentItem[];
}

// ---------------------------------------------------------------------------
// ConnectorConfig — stored in source_configs table / town config
// ---------------------------------------------------------------------------

export interface ConnectorConfig {
  /** Unique ID: "{townId}:{connectorName}" */
  id: string;
  /** Connector type */
  connector_type: ConnectorType;
  /** Content category */
  category: ContentCategory;
  /** Run schedule */
  schedule: ConnectorSchedule;
  /** Connector-specific configuration (URLs, selectors, API keys, etc.) */
  config: Record<string, unknown>;
  /** Whether this connector is active */
  enabled: boolean;
  /** Whether items should be embedded for vector search */
  shouldEmbed: boolean;
}

// ---------------------------------------------------------------------------
// ConnectorResult — what the runner returns after executing a connector
// ---------------------------------------------------------------------------

export interface ConnectorResult {
  connectorId: string;
  itemsFound: number;
  itemsUpserted: number;
  itemsSkipped: number;
  errors: string[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// ConnectorFactory — creates a connector instance from a config
// ---------------------------------------------------------------------------

export type ConnectorFactory = (
  townId: string,
  config: ConnectorConfig
) => SourceConnector;
