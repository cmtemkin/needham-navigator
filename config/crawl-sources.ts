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
    | "community"
    | "news"
    | "utilities"
    | "regional"
    | "social_media"
    | "faith"
    | "business_reviews"
    | "real_estate";
  priority: 1 | 2 | 3 | 4 | 5; // 5 = highest priority
  updateFrequency: "daily" | "weekly" | "monthly" | "annually";
  documentType?: DocumentType; // Hint for chunking
  maxDepth?: number; // Crawl depth limit
  maxPages?: number; // Max pages to crawl from this source
  crawlMode?: "single" | "recursive" | "sitemap"; // How to crawl this source
  status?: "active" | "blocked" | "requires_api"; // Source accessibility
  contentType?: string; // Content type hint for RAG (e.g., "local_business")
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

  // -------------------------------------------------------------------------
  // LOCAL NEWS (3 sources)
  // -------------------------------------------------------------------------
  {
    id: "patch-needham",
    url: "https://patch.com/massachusetts/needham",
    category: "news",
    priority: 3,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 2,
    maxPages: 100,
    contentType: "news",
  },
  {
    id: "wicked-local-needham",
    url: "https://www.wickedlocal.com/needham",
    category: "news",
    priority: 3,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 2,
    maxPages: 100,
    contentType: "news",
  },
  {
    id: "needham-channel",
    url: "https://www.needhamchannel.org/",
    category: "news",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 50,
    contentType: "news",
  },

  // -------------------------------------------------------------------------
  // ADDITIONAL COMMUNITY ORGS (8 sources)
  // -------------------------------------------------------------------------
  {
    id: "needham-history-center",
    url: "https://needhamhistory.org/",
    category: "community",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 30,
  },
  {
    id: "needham-community-farm",
    url: "https://www.needhamcommunityfarm.org/",
    category: "community",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 30,
  },
  {
    id: "needham-business-association",
    url: "https://www.needhamba.com/",
    category: "community",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 50,
    contentType: "business_directory",
  },
  {
    id: "needham-ymca",
    url: "https://ymcaboston.org/needham",
    category: "recreation",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 20,
  },
  {
    id: "needham-garden-club",
    url: "https://needhamgardenclub.com/",
    category: "community",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-womens-club",
    url: "https://www.needhamwomensclub.org/",
    category: "community",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-sportsmans-club",
    url: "https://www.needhamsportsmansclub.com/",
    category: "recreation",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-youth-commission",
    url: "https://www.needhamma.gov/640/Youth-Commission",
    category: "community",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // EMERGENCY SERVICES - DEEP CRAWL (4 sources)
  // -------------------------------------------------------------------------
  {
    id: "needham-police-deep",
    url: "https://www.needhamma.gov/188/Police-Department",
    category: "public_safety",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 3,
    maxPages: 50,
  },
  {
    id: "needham-fire-deep",
    url: "https://www.needhamma.gov/184/Fire-Department",
    category: "public_safety",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 3,
    maxPages: 50,
  },
  {
    id: "needham-police-facebook",
    url: "https://www.facebook.com/needhampolice",
    category: "social_media",
    priority: 2,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 0,
    maxPages: 5,
    status: "blocked", // Requires login for full access
    contentType: "social_media",
  },
  {
    id: "needham-fire-facebook",
    url: "https://www.facebook.com/needhamfire",
    category: "social_media",
    priority: 2,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 0,
    maxPages: 5,
    status: "blocked", // Requires login for full access
    contentType: "social_media",
  },

  // -------------------------------------------------------------------------
  // REGIONAL & TRANSPORTATION (10 sources)
  // -------------------------------------------------------------------------
  {
    id: "mbta-needham-junction",
    url: "https://www.mbta.com/stops/place-NEC-2203",
    category: "transportation",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 1,
  },
  {
    id: "mbta-needham-center",
    url: "https://www.mbta.com/stops/place-NEC-2173",
    category: "transportation",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 1,
  },
  {
    id: "mbta-needham-heights",
    url: "https://www.mbta.com/stops/place-NEC-2139",
    category: "transportation",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 1,
  },
  {
    id: "norfolk-county",
    url: "https://www.norfolkcountyma.gov/",
    category: "regional",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 20,
  },
  {
    id: "mass-gov-resources",
    url: "https://www.mass.gov/",
    category: "regional",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 50,
  },
  {
    id: "wellesley-homepage",
    url: "https://www.wellesleyma.gov/",
    category: "regional",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 10,
  },
  {
    id: "newton-homepage",
    url: "https://www.newtonma.gov/",
    category: "regional",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 10,
  },
  {
    id: "dedham-homepage",
    url: "https://www.dedham-ma.gov/",
    category: "regional",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 10,
  },
  {
    id: "dover-homepage",
    url: "https://www.doverma.gov/",
    category: "regional",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 10,
  },
  {
    id: "westwood-homepage",
    url: "https://www.townhall.westwood.ma.us/",
    category: "regional",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 10,
  },

  // -------------------------------------------------------------------------
  // UTILITIES (6 sources)
  // -------------------------------------------------------------------------
  {
    id: "eversource-needham",
    url: "https://www.eversource.com/",
    category: "utilities",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 20,
  },
  {
    id: "needham-water-sewer",
    url: "https://www.needhamma.gov/291/Water-Sewer-Drains-Division",
    category: "utilities",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "public_works",
    maxDepth: 2,
  },
  {
    id: "verizon-fios-needham",
    url: "https://www.verizon.com/home/fios/",
    category: "utilities",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 5,
  },
  {
    id: "comcast-xfinity-needham",
    url: "https://www.xfinity.com/",
    category: "utilities",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 5,
  },
  {
    id: "trash-recycling-schedule",
    url: "https://www.needhamma.gov/326/Trash-Recycling",
    category: "utilities",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "public_works",
    maxDepth: 2,
  },
  {
    id: "transfer-station",
    url: "https://www.needhamma.gov/87/Recycling-and-Transfer-Station",
    category: "utilities",
    priority: 4,
    updateFrequency: "monthly",
    documentType: "public_works",
    maxDepth: 2,
  },

  // -------------------------------------------------------------------------
  // HEALTH & HUMAN SERVICES - EXPANDED (5 sources)
  // -------------------------------------------------------------------------
  {
    id: "council-on-aging",
    url: "https://www.needhamma.gov/84/Council-on-Aging",
    category: "health",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 30,
  },
  {
    id: "beth-israel-needham",
    url: "https://www.bidneedham.org/",
    category: "health",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 30,
  },
  {
    id: "needham-mental-health",
    url: "https://www.needhamma.gov/2835/Mental-Health-Resources",
    category: "health",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "veterans-services",
    url: "https://www.needhamma.gov/519/Veterans-Services",
    category: "health",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "disability-services",
    url: "https://www.needhamma.gov/1110/Commission-on-Disability",
    category: "health",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },

  // -------------------------------------------------------------------------
  // RECREATION & CULTURE - EXPANDED (7 sources)
  // -------------------------------------------------------------------------
  {
    id: "needham-golf-course",
    url: "https://www.needhamma.gov/1034/Needham-Golf-Course",
    category: "recreation",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "needham-youth-soccer",
    url: "https://needhamyouthsoccer.com/",
    category: "recreation",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-youth-lacrosse",
    url: "https://www.needhamyouthlacrosse.org/",
    category: "recreation",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-youth-hockey",
    url: "https://www.needhamhockey.com/",
    category: "recreation",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-arts-council",
    url: "https://www.needhamma.gov/1104/Arts-Council",
    category: "recreation",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
  },
  {
    id: "needham-community-theatre",
    url: "https://www.needhamcommunitytheatre.org/",
    category: "recreation",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-public-library-deep",
    url: "https://www.needhamlibrary.org/",
    category: "recreation",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 50,
  },

  // -------------------------------------------------------------------------
  // HOUSES OF WORSHIP (12 sources - major congregations, public pages only)
  // -------------------------------------------------------------------------
  {
    id: "first-baptist-church-needham",
    url: "https://www.fbcneedham.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "first-congregational-needham",
    url: "https://www.firstcongregationalneedham.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "st-josephs-needham",
    url: "https://www.stjosephsneedham.com/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "temple-aliyah-needham",
    url: "https://www.templealiyah.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "temple-beth-shalom-needham",
    url: "https://www.tbshalom.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "christ-church-needham",
    url: "https://www.christchurchneedham.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "first-parish-needham",
    url: "https://www.firstparishneedham.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "channing-church-needham",
    url: "https://www.channingchurch.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "newman-center-needham",
    url: "https://www.newmancenteratbabson.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "congregation-shaarei-torah",
    url: "https://www.shaareitorah.org/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "community-fellowship-needham",
    url: "https://www.communityfellowship.church/",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 10,
  },
  {
    id: "needham-christian-science",
    url: "https://christianscience.com/find-us/branch-churches/needham-massachusetts",
    category: "faith",
    priority: 1,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 5,
  },

  // -------------------------------------------------------------------------
  // LOCAL BUSINESS REVIEWS (10 sources - many will be blocked/API-only)
  // -------------------------------------------------------------------------
  {
    id: "yelp-needham",
    url: "https://www.yelp.com/search?find_loc=Needham%2C+MA",
    category: "business_reviews",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 50,
    status: "blocked", // Yelp blocks scrapers, future: Yelp Fusion API
    contentType: "local_business",
  },
  {
    id: "angi-needham",
    url: "https://www.angi.com/needham-ma",
    category: "business_reviews",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 50,
    status: "blocked", // Angi blocks scrapers, may need API
    contentType: "local_business",
  },
  {
    id: "homeadvisor-needham",
    url: "https://www.homeadvisor.com/c.Needham.MA.html",
    category: "business_reviews",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 30,
    status: "blocked", // HomeAdvisor blocks scrapers
    contentType: "local_business",
  },
  {
    id: "thumbtack-needham",
    url: "https://www.thumbtack.com/ma/needham/",
    category: "business_reviews",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 30,
    status: "blocked", // Thumbtack blocks scrapers
    contentType: "local_business",
  },
  {
    id: "bbb-needham",
    url: "https://www.bbb.org/us/ma/needham",
    category: "business_reviews",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 50,
    contentType: "local_business",
  },
  {
    id: "tripadvisor-needham",
    url: "https://www.tripadvisor.com/Tourism-g41926-Needham_Massachusetts-Vacations.html",
    category: "business_reviews",
    priority: 2,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 30,
    status: "blocked", // TripAdvisor blocks scrapers
    contentType: "local_business",
  },
  {
    id: "google-business-needham",
    url: "https://www.google.com/maps/search/businesses+needham+ma",
    category: "business_reviews",
    priority: 3,
    updateFrequency: "weekly",
    documentType: "general",
    maxDepth: 0,
    maxPages: 50,
    status: "requires_api", // Google Maps API required
    contentType: "local_business",
  },
  {
    id: "needham-business-directory",
    url: "https://www.needhamba.com/list/",
    category: "business_reviews",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 100,
    contentType: "local_business",
  },
  {
    id: "yellowpages-needham",
    url: "https://www.yellowpages.com/needham-ma",
    category: "business_reviews",
    priority: 2,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 1,
    maxPages: 50,
    contentType: "local_business",
  },
  {
    id: "nextdoor-needham",
    url: "https://nextdoor.com/neighborhood/needham--needham--ma/",
    category: "social_media",
    priority: 2,
    updateFrequency: "daily",
    documentType: "general",
    maxDepth: 0,
    maxPages: 5,
    status: "blocked", // Requires login
    contentType: "local_business",
  },

  // -------------------------------------------------------------------------
  // REAL ESTATE & DEVELOPMENT - EXPANDED (5 sources)
  // -------------------------------------------------------------------------
  {
    id: "assessor-database",
    url: "https://www.needhamma.gov/57/Assessing",
    category: "real_estate",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
  },
  {
    id: "planning-board-deep",
    url: "https://www.needhamma.gov/1114/Planning-Board",
    category: "real_estate",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "planning_board",
    maxDepth: 3,
  },
  {
    id: "housing-authority-deep",
    url: "https://needhamhousing.org/",
    category: "real_estate",
    priority: 3,
    updateFrequency: "monthly",
    documentType: "general",
    maxDepth: 2,
    maxPages: 30,
  },
  {
    id: "building-department-deep",
    url: "https://www.needhamma.gov/1098/Building-Department",
    category: "real_estate",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "building_permits",
    maxDepth: 3,
  },
  {
    id: "zoning-board-deep",
    url: "https://www.needhamma.gov/1101/Board-of-Appeals",
    category: "real_estate",
    priority: 4,
    updateFrequency: "weekly",
    documentType: "planning_board",
    maxDepth: 3,
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
