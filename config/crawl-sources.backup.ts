/**
 * config/crawl-sources.ts — Comprehensive URL registry for Needham data sources
 *
 * Registry of all 40+ data sources from the Research Report with structured
 * metadata for crawling, prioritization, and document type hints.
 */

import type { DocumentType } from "../scripts/chunk";

export interface CrawlSource {
  id: string;
  url: string;
  category:
    | "government"
    | "zoning"
    | "permits"
    | "public_works"
    | "schools"
    | "recreation"
    | "public_safety"
    | "health"
    | "transportation"
    | "property"
    | "community";
  priority: 1 | 2 | 3 | 4 | 5; // 5 = highest priority
  updateFrequency: "daily" | "weekly" | "monthly" | "annually";
  documentType?: DocumentType; // Hint for chunking
  maxDepth?: number; // Crawl depth limit
}

/**
 * Comprehensive registry of all data sources for Needham, MA
 * Based on the Research Report inventory of 40+ sources
 */
export const CRAWL_SOURCES: CrawlSource[] = [
  // -------------------------------------------------------------------------
  // GOVERNMENT & ADMINISTRATION (7 sources)
  // -------------------------------------------------------------------------
  {
    id: "town-homepage",
    url: "https://www.needhamma.gov/",
    category: "government",
    priority: 5,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "town-meeting",
    url: "https://www.needhamma.gov/507/Agendas-Minutes",
    category: "government",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "meeting_minutes",
    maxDepth: 2,
  },
  {
    id: "select-board",
    url: "https://www.needhamma.gov/488/Select-Board",
    category: "government",
    priority: 5,
    updateFrequency: "weekly",
    documentType: "meeting_minutes",
    maxDepth: 2,
  },
  {
    id: "general-bylaws",
    url: "https://www.needhamma.gov/3294/General-By-Laws",
    category: "government",
    priority: 3,
    updateFrequency: "annually",
    documentType: "general_bylaws",
    maxDepth: 1,
  },
  {
    id: "budget-documents",
    url: "https://www.needhamma.gov/4092/Budget-Documents",
    category: "government",
    priority: 3,
    updateFrequency: "annually",
    documentType: "budget",
    maxDepth: 2,
  },
  {
    id: "voter-registration",
    url: "https://www.needhamma.gov/524/Voter-Registration-Information",
    category: "government",
    priority: 2,
    updateFrequency: "annually",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "town-directory",
    url: "https://www.needhamma.gov/Directory.aspx",
    category: "government",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // ZONING, PLANNING & DEVELOPMENT (7 sources)
  // -------------------------------------------------------------------------
  {
    id: "zoning-bylaws",
    url: "https://www.needhamma.gov/1614/Zoning-By-Laws",
    category: "zoning",
    priority: 5,
    updateFrequency: "annually",
    documentType: "zoning_bylaws",
    maxDepth: 2,
  },
  {
    id: "zoning-gis",
    url: "https://www.needhamma.gov/1905/Geographic-Information-Systems-GIS",
    category: "zoning",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "mbta-communities",
    url: "https://www.needhamma.gov/5572/MBTA-Communities-Zoning-Proposal",
    category: "zoning",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "planning-board",
    url: "https://www.needhamma.gov/1114/Planning-Board",
    category: "zoning",
    priority: 5,
    updateFrequency: "weekly",
    documentType: "planning_board",
    maxDepth: 2,
  },
  {
    id: "zoning-board-appeals",
    url: "https://www.needhamma.gov/1101/Board-of-Appeals",
    category: "zoning",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "planning_board",
    maxDepth: 2,
  },
  {
    id: "conservation-commission",
    url: "https://www.needhamma.gov/457/Conservation-Commission",
    category: "zoning",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "historic-district-regulations",
    url: "https://www.needhamma.gov/1473/By-Laws-Regulations",
    category: "zoning",
    priority: 2,
    updateFrequency: "annually",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // PERMITTING & BUILDING (4 sources)
  // -------------------------------------------------------------------------
  {
    id: "building-permits",
    url: "https://www.needhamma.gov/4644/Building-Construction-Permits",
    category: "permits",
    priority: 5,
    updateFrequency: "weekly",
    documentType: "building_permits",
    maxDepth: 2,
  },
  {
    id: "permit-fees",
    url: "https://www.needhamma.gov/4546/Fees",
    category: "permits",
    priority: 5,
    updateFrequency: "annually",
    documentType: "fee_schedules",
    maxDepth: 1,
  },
  {
    id: "permits-issued-log",
    url: "https://www.needhamma.gov/5024/Building-Permits-Issued",
    category: "permits",
    priority: 3,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "inspection-schedule",
    url: "https://www.needhamma.gov/2840/Inspection-Schedule",
    category: "permits",
    priority: 4,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // PUBLIC WORKS & UTILITIES (3 sources)
  // -------------------------------------------------------------------------
  {
    id: "public-works-rts",
    url: "https://www.needhamma.gov/87/Public-Works",
    category: "public_works",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "public_works",
    maxDepth: 2,
  },
  {
    id: "water-sewer-drains",
    url: "https://www.needhamma.gov/291/Water-Sewer-Drains-Division",
    category: "public_works",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "public_works",
    maxDepth: 2,
  },
  {
    id: "stormwater-management",
    url: "https://www.needhamma.gov/321/Storm-Drain-System",
    category: "public_works",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "public_works",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // SCHOOLS & EDUCATION (2 sources)
  // -------------------------------------------------------------------------
  {
    id: "needham-public-schools",
    url: "https://www.needham.k12.ma.us/",
    category: "schools",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "community-education",
    url: "https://www.needham.k12.ma.us/community_ed",
    category: "schools",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // RECREATION & COMMUNITY (3 sources)
  // -------------------------------------------------------------------------
  {
    id: "parks-recreation",
    url: "https://www.needhamma.gov/5699/Park-Recreation",
    category: "recreation",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "needham-library",
    url: "https://needhamlibrary.org/",
    category: "recreation",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "senior-center",
    url: "https://www.needhamma.gov/79/Youth-Family-Services",
    category: "recreation",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // PUBLIC SAFETY (2 sources)
  // -------------------------------------------------------------------------
  {
    id: "police-department",
    url: "https://www.needhamma.gov/205/Police-Fire-Details",
    category: "public_safety",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "fire-department",
    url: "https://www.needhamma.gov/205/Police-Fire-Details",
    category: "public_safety",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // HEALTH & HUMAN SERVICES (2 sources)
  // -------------------------------------------------------------------------
  {
    id: "board-of-health",
    url: "https://www.needhamma.gov/1103/Board-of-Health",
    category: "health",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "board_of_health",
    maxDepth: 2,
  },
  {
    id: "youth-family-services",
    url: "https://www.needhamma.gov/79/Youth-Family-Services",
    category: "health",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // TRANSPORTATION (2 sources)
  // -------------------------------------------------------------------------
  {
    id: "mbta-needham-line",
    url: "https://www.mbta.com/schedules/CR-Needham",
    category: "transportation",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "traffic-regulations",
    url: "https://needhamma.gov/DocumentCenter/View/2443/TON-Traffic-Rules--Regulations",
    category: "transportation",
    priority: 3,
    updateFrequency: "annually",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // PROPERTY & TAX INFORMATION (1 source)
  // -------------------------------------------------------------------------
  {
    id: "property-assessment",
    url: "https://www.needhamma.gov/57/Assessing",
    category: "property",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // COMMUNITY RESOURCES (5 sources)
  // -------------------------------------------------------------------------
  {
    id: "needham-community-council",
    url: "https://needhamcouncil.org/",
    category: "community",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "needham-channel",
    url: "https://www.needhamchannel.org/",
    category: "community",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "needham-housing-authority",
    url: "https://needhamhousing.org/",
    category: "community",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "document-center",
    url: "https://www.needhamma.gov/DocumentCenter",
    category: "community",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 3,
  },
  {
    id: "archive-center",
    url: "https://www.needhamma.gov/Archive.aspx",
    category: "community",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
];

/**
 * Get sources by priority level
 */
export function getSourcesByPriority(priority: 1 | 2 | 3 | 4 | 5): CrawlSource[] {
  return CRAWL_SOURCES.filter((s) => s.priority === priority);
}

/**
 * Get sources by category
 */
export function getSourcesByCategory(
  category: CrawlSource["category"]
): CrawlSource[] {
  return CRAWL_SOURCES.filter((s) => s.category === category);
}

/**
 * Get sources by update frequency
 */
export function getSourcesByFrequency(
  frequency: CrawlSource["updateFrequency"]
): CrawlSource[] {
  return CRAWL_SOURCES.filter((s) => s.updateFrequency === frequency);
}

/**
 * Get high-priority sources (priority 4 or 5)
 */
export function getHighPrioritySources(): CrawlSource[] {
  return CRAWL_SOURCES.filter((s) => s.priority >= 4);
}

/**
 * Get sources that should be checked frequently (daily or weekly)
 */
export function getFrequentUpdateSources(): CrawlSource[] {
  return CRAWL_SOURCES.filter(
    (s) => s.updateFrequency === "daily" || s.updateFrequency === "weekly"
  );
}
