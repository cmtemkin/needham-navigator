export type TownBrandColors = {
  primary: string;
  primary_dark: string;
  primary_light: string;
  accent: string;
  accent_light: string;
  background: string;
  surface: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  border: string;
  border_light: string;
  success: string;
  warning: string;
};

export type TownDepartment = {
  name: string;
  phone: string;
  question: string;
  icon?: string;
  email?: string;
  address?: string;
};

export type TownFeatureFlags = {
  enableZoningMap: boolean;
  enablePermitWizard: boolean;
  enableMultiLanguage: boolean;
  enableDashboard: boolean;
  enableNews: boolean;
  enableEvents: boolean;
  enableDining: boolean;
  enableSafety: boolean;
  enableTransit: boolean;
  enableWeather: boolean;
};

export type TownLocation = {
  lat: number;
  lng: number;
};

export type TownConfig = {
  town_id: string;
  name: string;
  website_url: string;
  brand_colors: TownBrandColors;
  vector_namespace: string;
  departments: TownDepartment[];
  feature_flags: TownFeatureFlags;
  /** Geographic center for weather/geo queries */
  location: TownLocation;
  /** MBTA route ID (e.g. "CR-Needham") */
  transit_route?: string;
};

export const TOWNS: TownConfig[] = [
  {
    town_id: "needham",
    name: "Needham, MA",
    website_url: "https://www.needhamma.gov",
    vector_namespace: "needham-docs-v1",
    brand_colors: {
      primary: "#003F87",
      primary_dark: "#002D62",
      primary_light: "#0052B0",
      accent: "#D4AF37",
      accent_light: "#F0E2A0",
      background: "#FFFFFF",
      surface: "#F7F8FA",
      text_primary: "#1A1A1A",
      text_secondary: "#5A6070",
      text_muted: "#9CA3AF",
      border: "#E2E5EB",
      border_light: "#EFF1F5",
      success: "#059669",
      warning: "#D97706",
    },
    departments: [
      {
        name: "Town Hall",
        phone: "(781) 455-7500",
        question:
          "What services does Needham Town Hall provide and what are the hours?",
      },
      {
        name: "Building Dept.",
        phone: "(781) 455-7550",
        question:
          "How do I contact the Needham Building Department and what do they handle?",
      },
      {
        name: "Planning & Dev.",
        phone: "(781) 455-7550",
        question: "What does the Needham Planning Department handle?",
      },
      {
        name: "Public Works",
        phone: "(781) 455-7550",
        question: "What services does Needham Public Works provide?",
      },
      {
        name: "Police",
        phone: "(781) 455-7570",
        question: "How do I contact Needham police for a non-emergency?",
      },
      {
        name: "Fire Dept.",
        phone: "(781) 455-7580",
        question: "How do I contact the Needham Fire Department?",
      },
      {
        name: "Parks & Rec",
        phone: "(781) 455-7550",
        question: "What programs does Needham Parks and Recreation offer?",
      },
    ],
    feature_flags: {
      enableZoningMap: true,
      enablePermitWizard: true,
      enableMultiLanguage: true,
      enableDashboard: true,
      enableNews: true,
      enableEvents: true,
      enableDining: true,
      enableSafety: true,
      enableTransit: true,
      enableWeather: true,
    },
    location: { lat: 42.2828, lng: -71.2337 },
    transit_route: "CR-Needham",
  },
  // Remove before production deployment — used for multi-tenant testing only
  {
    town_id: "mock-town",
    name: "Mock Town, MA",
    website_url: "https://www.exampletown.gov",
    vector_namespace: "mock-town-docs-v1",
    brand_colors: {
      primary: "#0B3A53",
      primary_dark: "#082A3D",
      primary_light: "#15608A",
      accent: "#E0A43B",
      accent_light: "#F1D7A3",
      background: "#FFFFFF",
      surface: "#F6F9FB",
      text_primary: "#13202B",
      text_secondary: "#475569",
      text_muted: "#94A3B8",
      border: "#D8E2EB",
      border_light: "#E8EEF3",
      success: "#059669",
      warning: "#D97706",
    },
    departments: [
      {
        name: "Town Clerk",
        phone: "(555) 010-1000",
        question: "How do I contact the Town Clerk?",
      },
      {
        name: "Building",
        phone: "(555) 010-1001",
        question: "How do I apply for a building permit?",
      },
      {
        name: "Public Safety",
        phone: "(555) 010-1002",
        question: "How can I contact public safety resources?",
      },
    ],
    feature_flags: {
      enableZoningMap: false,
      enablePermitWizard: false,
      enableMultiLanguage: true,
      enableDashboard: false,
      enableNews: false,
      enableEvents: false,
      enableDining: false,
      enableSafety: false,
      enableTransit: false,
      enableWeather: false,
    },
    location: { lat: 42.0, lng: -71.0 },
  },
];

export const DEFAULT_TOWN_ID = TOWNS[0].town_id;
