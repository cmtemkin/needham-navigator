// Mock data for standalone frontend development
// This file will be removed after merging with the chat-api branch

export interface MockSource {
  title: string;
  section?: string;
  date?: string;
  url?: string;
}

export interface MockResponse {
  text: string;
  sources: MockSource[];
  confidence: "high" | "medium" | "low";
  followups: string[];
}

export const quickPrompts = [
  { icon: "\u267B\uFE0F", label: "Transfer station hours", question: "When is the transfer station open?" },
  { icon: "\uD83D\uDCB0", label: "Pay my tax bill", question: "How do I pay my property tax bill?" },
  { icon: "\uD83D\uDDF3\uFE0F", label: "Register to vote", question: "How do I register to vote in Needham?" },
  { icon: "\uD83C\uDFEB", label: "School enrollment", question: "What are the school enrollment deadlines?" },
  { icon: "\uD83C\uDFDB\uFE0F", label: "Town Meeting dates", question: "When is the next Town Meeting?" },
  { icon: "\u2744\uFE0F", label: "Snow parking ban", question: "What is the snow parking ban policy?" },
  { icon: "\uD83D\uDC36", label: "Dog license", question: "How do I get a dog license?" },
  { icon: "\uD83D\uDCDA", label: "Library hours", question: "What are the library hours?" },
];

export interface TileData {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  defaultQuestion: string;
  subPrompts: { label: string; question: string }[];
}

export const lifeSituationTiles: TileData[] = [
  {
    icon: "\uD83C\uDFE0",
    iconBg: "#EBF5FF",
    title: "Home & Property",
    description: "Building permits, zoning rules, property taxes, and home renovations",
    defaultQuestion: "What permits do I need to build a deck?",
    subPrompts: [
      { label: "Zoning setback rules", question: "What setback requirements apply to the SRB zoning district?" },
      { label: "Apply for a building permit", question: "How do I apply for a building permit in Needham?" },
      { label: "Property tax info", question: "How is my property tax calculated?" },
    ],
  },
  {
    icon: "\uD83C\uDF93",
    iconBg: "#F0FDF4",
    title: "Schools & Education",
    description: "Enrollment, school calendar, bus routes, and special education services",
    defaultQuestion: "How do I enroll my child in Needham public schools?",
    subPrompts: [
      { label: "School start times", question: "What are the Needham public school start times?" },
      { label: "Bus route info", question: "How do school bus routes work in Needham?" },
      { label: "Special education", question: "What special education services are available?" },
    ],
  },
  {
    icon: "\u267B\uFE0F",
    iconBg: "#FEF9C3",
    title: "Trash & Recycling",
    description: "Transfer station, recycling rules, yard waste, and hazardous materials",
    defaultQuestion: "What days and hours is the transfer station open?",
    subPrompts: [
      { label: "What can I recycle?", question: "What items can I recycle in Needham?" },
      { label: "Get a sticker", question: "How do I get a transfer station sticker?" },
      { label: "Hazardous waste day", question: "When is the next hazardous waste collection day?" },
    ],
  },
  {
    icon: "\u26BD",
    iconBg: "#FEE2E2",
    title: "Parks & Recreation",
    description: "Youth sports, programs, park rentals, pools, and community events",
    defaultQuestion: "What recreation programs are available in Needham?",
    subPrompts: [
      { label: "Youth sports signups", question: "How do I sign up for youth sports in Needham?" },
      { label: "Reserve a field", question: "How do I reserve a park or field in Needham?" },
      { label: "Pool schedule", question: "When does the Rosemary Pool open for the season?" },
    ],
  },
  {
    icon: "\uD83D\uDE8A",
    iconBg: "#EDE9FE",
    title: "Getting Around",
    description: "Commuter rail, bus routes, parking, and transportation services",
    defaultQuestion: "How do I get to Boston from Needham by public transit?",
    subPrompts: [
      { label: "Commuter rail times", question: "What are the MBTA commuter rail times for Needham?" },
      { label: "Parking in town center", question: "Where can I find public parking in Needham Center?" },
    ],
  },
  {
    icon: "\uD83C\uDFDB\uFE0F",
    iconBg: "#FFF1F2",
    title: "Town Government",
    description: "Elections, Town Meeting, committees, budgets, and civic participation",
    defaultQuestion: "How do I register to vote in Needham?",
    subPrompts: [
      { label: "Town Meeting info", question: "When is the next Town Meeting and how do I attend?" },
      { label: "Town budget", question: "What is the current Needham town budget?" },
    ],
  },
  {
    icon: "\uD83D\uDEA8",
    iconBg: "#FEF3C7",
    title: "Safety & Emergencies",
    description: "Police, fire, emergency alerts, and public safety resources",
    defaultQuestion: "What emergency numbers should I know in Needham?",
    subPrompts: [
      { label: "Emergency alerts", question: "How do I sign up for Needham emergency alerts?" },
      { label: "File a police report", question: "How do I file a police report in Needham?" },
    ],
  },
  {
    icon: "\uD83D\uDCE6",
    iconBg: "#DBEAFE",
    title: "New to Needham",
    description: "Moving checklist, utilities, registrations, and getting settled",
    defaultQuestion: "I just moved to Needham. What do I need to know?",
    subPrompts: [
      { label: "Set up utilities", question: "How do I set up water and sewer service in Needham?" },
      { label: "Get a library card", question: "How do I get a library card in Needham?" },
    ],
  },
];

export interface PopularQuestion {
  rank: number;
  question: string;
  chatQuestion: string;
  category: string;
}

export const popularQuestions: PopularQuestion[] = [
  { rank: 1, question: "When is the transfer station open?", chatQuestion: "When is the transfer station open and where is it located?", category: "Trash & Recycling" },
  { rank: 2, question: "What permits do I need for a renovation?", chatQuestion: "What permits do I need to renovate my kitchen?", category: "Home & Property" },
  { rank: 3, question: "How do I pay my property tax?", chatQuestion: "How do I pay my property tax bill online?", category: "Town Government" },
  { rank: 4, question: "When does school start?", chatQuestion: "When does school start in the fall?", category: "Schools" },
  { rank: 5, question: "Is there a snow parking ban?", chatQuestion: "Is there a snow parking ban in effect?", category: "Getting Around" },
  { rank: 6, question: "How do I register my dog?", chatQuestion: "How do I register my dog in Needham?", category: "Town Services" },
];

export interface DepartmentChip {
  icon: string;
  name: string;
  phone: string;
  question: string;
}

export const departments: DepartmentChip[] = [
  { icon: "\uD83C\uDFE2", name: "Town Hall", phone: "(781) 455-7500", question: "What services does Needham Town Hall provide and what are the hours?" },
  { icon: "\uD83C\uDFD7\uFE0F", name: "Building Dept.", phone: "(781) 455-7550", question: "How do I contact the Needham Building Department and what do they handle?" },
  { icon: "\uD83D\uDCD0", name: "Planning & Dev.", phone: "(781) 455-7550", question: "What does the Needham Planning Department handle?" },
  { icon: "\uD83D\uDEE0\uFE0F", name: "Public Works", phone: "(781) 455-7550", question: "What services does Needham Public Works provide?" },
  { icon: "\uD83D\uDC6E", name: "Police", phone: "(781) 455-7570", question: "How do I contact Needham police for a non-emergency?" },
  { icon: "\uD83D\uDE92", name: "Fire Dept.", phone: "(781) 455-7580", question: "How do I contact the Needham Fire Department?" },
  { icon: "\uD83C\uDFBE", name: "Parks & Rec", phone: "(781) 455-7550", question: "What programs does Needham Parks and Recreation offer?" },
];

export const chatWelcomeSuggestions = [
  { icon: "\uD83C\uDFE0", label: "Permits for a deck", question: "What permits do I need for a deck?" },
  { icon: "\u267B\uFE0F", label: "Transfer station hours", question: "When is the transfer station open?" },
  { icon: "\uD83C\uDF93", label: "School enrollment", question: "How do I enroll my child in school?" },
  { icon: "\uD83D\uDCB0", label: "Pay my taxes", question: "How do I pay my tax bill?" },
  { icon: "\uD83D\uDCE6", label: "New resident guide", question: "I just moved to Needham" },
  { icon: "\uD83D\uDCD0", label: "Check my zoning", question: "What is my zoning district?" },
];

// Mock AI responses keyed by topic keywords
export const mockResponses: Record<string, MockResponse> = {
  "transfer station": {
    text: `The **Needham Transfer Station & Recycling Center** is located at **1421 Central Avenue**.

**Hours of operation:**
- Wednesday: 7:30 AM – 3:30 PM
- Saturday: 7:30 AM – 3:30 PM
- Sunday: 12:00 PM – 3:30 PM

**Important note:** Needham does not have curbside trash pickup. All residents must bring their trash and recycling to the Transfer Station. You'll need a valid **Transfer Station sticker** on your vehicle, which can be purchased at Town Hall or online.

**Cost:** The annual sticker fee is based on vehicle type (typically $200-$365/year for residential).`,
    sources: [
      { title: "Needham DPW Transfer Station Page", url: "https://needhamma.gov/transfer-station" },
      { title: "Town Fee Schedule 2024", section: "Transfer Station Fees" },
    ],
    confidence: "high",
    followups: ["How do I get a transfer station sticker?", "What items can I recycle?", "Where do I dispose of electronics?"],
  },
  permit: {
    text: `For most home improvement projects in Needham, you'll need a **Building Permit** from the Building Department.

**How to apply:**
- Submit electronically via **ViewPoint Cloud** at needhamma.viewpointcloud.com

**Required documents typically include:**
- Plot plan (stamped by registered land surveyor)
- Building plans (stamped and signed)
- Workers' Compensation affidavit
- Debris Removal Form

**Fees:** $10 per $1,000 of estimated construction cost (minimum $150 for residential).

The **Building Department** is at 500 Dedham Avenue. Hours: M/W/Th 7:30-5, Tue 7:30-6, Fri 7:30-12:30.`,
    sources: [
      { title: "Building & Construction Permits Guide" },
      { title: "Permit Fee Schedule", section: "Residential" },
      { title: "ViewPoint Cloud Portal" },
    ],
    confidence: "high",
    followups: ["How long does the permit process take?", "Do I need a permit for a fence?", "What inspections are required?"],
  },
  tax: {
    text: `You can pay your Needham property tax bill in several ways:

**Online:** Visit the Town of Needham payment portal at needhamma.gov and navigate to "Pay Bills Online." You can pay by credit card or ACH bank transfer.

**By mail:** Send a check to the Town of Needham Tax Collector, 1471 Highland Avenue, Needham, MA 02492.

**In person:** Visit Town Hall at 1471 Highland Avenue during business hours (M-F, 8:30 AM - 5:00 PM).

**Tax bills** are issued quarterly. The FY2024 residential tax rate is approximately $11.33 per $1,000 of assessed value.`,
    sources: [
      { title: "Tax Collector Page", url: "https://needhamma.gov/tax-collector" },
      { title: "FY2024 Tax Rate Classification" },
    ],
    confidence: "high",
    followups: ["When are tax bills due?", "How do I apply for a tax exemption?", "What is my property assessed at?"],
  },
  school: {
    text: `To enroll your child in **Needham Public Schools**:

**1. Visit the NPS website** at needham.k12.ma.us and go to "Registration & Enrollment"

**2. Required documents:**
- Proof of residency (deed, lease, or utility bill)
- Child's birth certificate
- Immunization records
- Previous school records (if transferring)

**3. School assignment** is based on your home address. The district has five elementary schools, one middle school (Pollard), and one high school (Needham High).

**Kindergarten:** Children must be 5 years old by September 1 of the enrollment year.

Contact the NPS Central Registration office at **(781) 455-0400 ext. 211**.`,
    sources: [
      { title: "NPS Registration Page" },
      { title: "Needham School Committee Policy" },
      { title: "District Enrollment Guide" },
    ],
    confidence: "high",
    followups: ["What are school start times?", "How do bus routes work?", "What are the school vacation dates?"],
  },
  vote: {
    text: `To **register to vote** in Needham:

**Online:** Visit RegisterToVoteMA.com — the official Massachusetts online voter registration portal. You'll need your MA driver's license or ID number.

**By mail:** Download a mail-in registration form from sec.state.ma.us and send it to the Town Clerk.

**In person:** Visit the Town Clerk's office at Town Hall, 1471 Highland Avenue. Hours: M-F 8:30 AM – 5:00 PM.

**Deadlines:** You must register at least 10 days before an election. Check needhamma.gov/elections for upcoming election dates.`,
    sources: [
      { title: "Town Clerk Voter Registration Page" },
      { title: "MA Secretary of State - Elections Division" },
    ],
    confidence: "high",
    followups: ["When is the next election?", "Where is my polling location?", "How do I request an absentee ballot?"],
  },
  "new to needham": {
    text: `Welcome to Needham! Here's your **new resident checklist**:

**Essentials:**
- **Transfer Station sticker** — No curbside pickup! Get one at Town Hall or online
- **Water/Sewer** — Contact DPW at (781) 455-7550 to set up service
- **Register to vote** — Town Clerk at Town Hall or online at RegisterToVoteMA.com
- **Dog license** — Required annually, available from the Town Clerk
- **Library card** — Free at Needham Free Public Library, 1139 Highland Ave

**Good to know:**
- Needham has an **open Town Meeting** form of government
- The town has 3 MBTA commuter rail stations (Needham Heights, Needham Center, Needham Junction)
- Snow parking bans are announced via the town alert system`,
    sources: [
      { title: "New Resident Guide", url: "https://needhamma.gov/new-residents" },
      { title: "Town Services Directory" },
    ],
    confidence: "high",
    followups: ["How do I sign up for town alerts?", "What are the best parks in Needham?", "Where is the nearest grocery store?"],
  },
  zoning: {
    text: `Needham has several **zoning districts**, each with specific dimensional regulations:

**Common residential districts:**
- **SRA (Single Residence A)** — Min lot: 15,000 sq ft
- **SRB (Single Residence B)** — Min lot: 20,000 sq ft; setbacks: Front 25', Side 15', Rear 25'
- **GRA (General Residence A)** — Min lot: 10,000 sq ft

To find your zoning district, you can:
- Check the **Needham Zoning Map** on the town's GIS viewer
- Call Planning & Community Development at **(781) 455-7550**
- Visit Town Hall with your address`,
    sources: [
      { title: "Zoning By-Law Ch.4, §4.1" },
      { title: "Dimensional Regulations Table" },
      { title: "Needham GIS Zoning Map" },
    ],
    confidence: "high",
    followups: ["What can I build in my zoning district?", "How do I apply for a variance?", "What is the lot coverage limit?"],
  },
  default: {
    text: `I'd be happy to help you with that! Let me look through the official Needham town records to find the most accurate information.

While this is currently running in demo mode, the full Needham Navigator searches through official town documents, zoning by-laws, and department records to give you detailed, sourced answers.

For immediate assistance, you can contact Town Hall at **(781) 455-7500** or visit **needhamma.gov**.`,
    sources: [{ title: "Town of Needham Official Records" }],
    confidence: "medium",
    followups: ["Tell me more about this topic", "What department handles this?", "What forms do I need?"],
  },
};

// Helper to find the best matching mock response
export function findMockResponse(question: string): MockResponse {
  const q = question.toLowerCase();

  if (q.includes("transfer") || q.includes("trash") || q.includes("recycl") || q.includes("sticker")) {
    return mockResponses["transfer station"];
  }
  if (q.includes("permit") || q.includes("build") || q.includes("deck") || q.includes("renovation") || q.includes("renovate")) {
    return mockResponses["permit"];
  }
  if (q.includes("tax") || q.includes("pay") || q.includes("bill")) {
    return mockResponses["tax"];
  }
  if (q.includes("school") || q.includes("enroll") || q.includes("kindergarten") || q.includes("education")) {
    return mockResponses["school"];
  }
  if (q.includes("vote") || q.includes("election") || q.includes("register to")) {
    return mockResponses["vote"];
  }
  if (q.includes("new to") || q.includes("moved") || q.includes("moving") || q.includes("new resident")) {
    return mockResponses["new to needham"];
  }
  if (q.includes("zone") || q.includes("zoning") || q.includes("setback") || q.includes("srb") || q.includes("sra") || q.includes("lot")) {
    return mockResponses["zoning"];
  }

  return mockResponses["default"];
}
