/**
 * scripts/build-business-index.ts — Business Review Index Builder
 *
 * Extracts structured business records from ingested review data:
 * - Parses business name, category, rating, contact info from chunks
 * - Deduplicates businesses across platforms (same name + address)
 * - Enriches chunks with structured metadata for better RAG results
 * - Uses standard category taxonomy (works for any location)
 *
 * Usage:
 *   npx tsx scripts/build-business-index.ts                     # Process all local_business chunks
 *   npx tsx scripts/build-business-index.ts --dry-run           # Preview without updating database
 *   npx tsx scripts/build-business-index.ts --limit=50          # Process only 50 chunks
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BusinessRecord {
  name: string;
  category: BusinessCategory;
  subcategory?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  website?: string;
  sourceUrl: string;
  sourcePlatform: string;
  chunkId: string;
}

type BusinessCategory =
  | "Home Services"
  | "Food & Dining"
  | "Health & Wellness"
  | "Professional Services"
  | "Automotive"
  | "Personal Care"
  | "Education"
  | "Retail"
  | "Entertainment"
  | "Other";

interface BusinessExtractionResult {
  business_name: string | null;
  business_category: BusinessCategory | null;
  business_subcategory?: string;
  business_rating?: number;
  business_review_count?: number;
  business_address?: string;
  business_phone?: string;
  business_website?: string;
}

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Business data extraction via GPT
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `Extract structured business information from this text. Return ONLY valid JSON matching this schema:

{
  "business_name": string | null,
  "business_category": "Home Services" | "Food & Dining" | "Health & Wellness" | "Professional Services" | "Automotive" | "Personal Care" | "Education" | "Retail" | "Entertainment" | "Other" | null,
  "business_subcategory": string | null,
  "business_rating": number | null,
  "business_review_count": number | null,
  "business_address": string | null,
  "business_phone": string | null,
  "business_website": string | null
}

Category definitions:
- Home Services: plumbers, electricians, landscaping, contractors, handymen, pest control, cleaning, HVAC
- Food & Dining: restaurants, cafes, bars, catering, food delivery
- Health & Wellness: doctors, dentists, gyms, yoga, therapy, hospitals, urgent care
- Professional Services: lawyers, accountants, real estate agents, financial advisors, consultants
- Automotive: auto repair, car wash, dealerships, towing
- Personal Care: hair salons, spas, nail salons, barbershops
- Education: tutoring, music lessons, schools, daycare
- Retail: stores, shops, boutiques
- Entertainment: theaters, museums, events, activities
- Other: anything that doesn't fit above

If a field is not found in the text, use null. Do not guess or make up data.`;

async function extractBusinessData(
  text: string,
  sourceUrl: string
): Promise<BusinessExtractionResult | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap for extraction
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Source URL: ${sourceUrl}\n\nText:\n${text.substring(0, 2000)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Validate that we got at least a business name
    if (!result.business_name) {
      return null;
    }

    return result as BusinessExtractionResult;
  } catch (err) {
    console.error(`[business-index] Extraction failed for ${sourceUrl}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\b(inc|llc|corp|ltd|co)\b\.?/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(address: string | undefined): string {
  if (!address) return "";
  return address
    .toLowerCase()
    .trim()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln)\b\.?/gi, "st")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function areBusinessesSame(a: BusinessRecord, b: BusinessRecord): boolean {
  const nameA = normalizeBusinessName(a.name);
  const nameB = normalizeBusinessName(b.name);
  const addrA = normalizeAddress(a.address);
  const addrB = normalizeAddress(b.address);

  // Same normalized name + same normalized address = same business
  if (nameA === nameB && addrA && addrB && addrA === addrB) {
    return true;
  }

  // Same normalized name + same phone = same business
  if (nameA === nameB && a.phone && b.phone && a.phone === b.phone) {
    return true;
  }

  // Same website = same business
  if (a.website && b.website && a.website === b.website) {
    return true;
  }

  return false;
}

function deduplicateBusinesses(businesses: BusinessRecord[]): BusinessRecord[] {
  const unique: BusinessRecord[] = [];
  const seen = new Set<string>();

  for (const biz of businesses) {
    // Check if this business is a duplicate of any existing one
    const isDuplicate = unique.some((existing) => areBusinessesSame(biz, existing));

    if (!isDuplicate) {
      unique.push(biz);
      const key = `${normalizeBusinessName(biz.name)}:${normalizeAddress(biz.address)}`;
      seen.add(key);
    } else {
      console.log(`  [business-index] Duplicate found: ${biz.name} (${biz.sourcePlatform})`);
    }
  }

  return unique;
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("yelp.com")) return "yelp";
  if (urlLower.includes("angi.com") || urlLower.includes("angieslist.com")) return "angi";
  if (urlLower.includes("homeadvisor.com")) return "homeadvisor";
  if (urlLower.includes("thumbtack.com")) return "thumbtack";
  if (urlLower.includes("bbb.org")) return "bbb";
  if (urlLower.includes("tripadvisor.com")) return "tripadvisor";
  if (urlLower.includes("google.com")) return "google";
  if (urlLower.includes("yellowpages.com")) return "yellowpages";
  if (urlLower.includes("needhamba.com")) return "needham_business_association";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function buildBusinessIndex(options: {
  dryRun?: boolean;
  limit?: number;
}): Promise<void> {
  const { dryRun = false, limit } = options;
  const supabase = getSupabaseServiceClient();

  console.log("=".repeat(60));
  console.log("[business-index] Building business recommendation index");
  if (dryRun) console.log("  DRY RUN — no database updates");
  if (limit) console.log(`  Processing limit: ${limit} chunks`);
  console.log("=".repeat(60));

  // Step 1: Fetch all chunks with local_business content type or business-related URLs
  console.log("\n[business-index] Fetching business-related chunks...");
  let query = supabase
    .from("document_chunks")
    .select("chunk_id, text, metadata, document_id")
    .or(
      "metadata->>content_type.eq.local_business,metadata->>document_url.ilike.%yelp%,metadata->>document_url.ilike.%angi%,metadata->>document_url.ilike.%bbb%,metadata->>document_url.ilike.%needhamba%"
    );

  if (limit) {
    query = query.limit(limit);
  }

  const { data: chunks, error } = await query;

  if (error) {
    console.error("[business-index] Error fetching chunks:", error);
    process.exit(1);
  }

  if (!chunks || chunks.length === 0) {
    console.log("[business-index] No business chunks found. Run ingestion first.");
    return;
  }

  console.log(`[business-index] Found ${chunks.length} potential business chunks`);

  // Step 2: Extract structured business data from each chunk
  console.log("\n[business-index] Extracting business data...");
  const businesses: BusinessRecord[] = [];
  let extracted = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const metadata = chunk.metadata as any;
    const sourceUrl = metadata.document_url || "";
    const sourcePlatform = detectPlatform(sourceUrl);

    console.log(`  [${extracted + failed + 1}/${chunks.length}] Processing: ${sourceUrl}`);

    const businessData = await extractBusinessData(chunk.text, sourceUrl);

    if (businessData && businessData.business_name) {
      businesses.push({
        name: businessData.business_name,
        category: businessData.business_category || "Other",
        subcategory: businessData.business_subcategory,
        rating: businessData.business_rating,
        reviewCount: businessData.business_review_count,
        address: businessData.business_address,
        phone: businessData.business_phone,
        website: businessData.business_website,
        sourceUrl,
        sourcePlatform,
        chunkId: chunk.chunk_id,
      });
      extracted++;
    } else {
      failed++;
    }

    // Rate limit: 1 request per second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n[business-index] Extraction complete: ${extracted} businesses, ${failed} failed`);

  // Step 3: Deduplicate businesses
  console.log("\n[business-index] Deduplicating businesses...");
  const uniqueBusinesses = deduplicateBusinesses(businesses);
  console.log(`[business-index] ${uniqueBusinesses.length} unique businesses (${businesses.length - uniqueBusinesses.length} duplicates removed)`);

  // Step 4: Update chunk metadata with structured business data
  if (!dryRun) {
    console.log("\n[business-index] Updating chunk metadata...");
    let updated = 0;

    for (const biz of uniqueBusinesses) {
      const { data: chunk } = await supabase
        .from("document_chunks")
        .select("metadata")
        .eq("chunk_id", biz.chunkId)
        .single();

      if (chunk) {
        const existingMetadata = chunk.metadata as any;
        const updatedMetadata = {
          ...existingMetadata,
          business_name: biz.name,
          business_category: biz.category,
          business_subcategory: biz.subcategory,
          business_rating: biz.rating,
          business_review_count: biz.reviewCount,
          business_address: biz.address,
          business_phone: biz.phone,
          business_website: biz.website,
          source_platform: biz.sourcePlatform,
          content_type: "local_business",
        };

        const { error: updateError } = await supabase
          .from("document_chunks")
          .update({ metadata: updatedMetadata })
          .eq("chunk_id", biz.chunkId);

        if (updateError) {
          console.error(`  [business-index] Error updating ${biz.chunkId}:`, updateError);
        } else {
          updated++;
        }
      }
    }

    console.log(`[business-index] Updated ${updated} chunks with structured business data`);
  }

  // Step 5: Report summary
  console.log("\n" + "=".repeat(60));
  console.log("[business-index] SUMMARY");
  console.log(`  Total chunks processed: ${chunks.length}`);
  console.log(`  Businesses extracted: ${extracted}`);
  console.log(`  Extraction failures: ${failed}`);
  console.log(`  Unique businesses: ${uniqueBusinesses.length}`);
  console.log(`  Duplicates removed: ${businesses.length - uniqueBusinesses.length}`);
  if (dryRun) {
    console.log("  (DRY RUN — no database changes made)");
  } else {
    console.log(`  Chunks updated: ${uniqueBusinesses.length}`);
  }

  // Category breakdown
  const categoryCount: Record<string, number> = {};
  for (const biz of uniqueBusinesses) {
    categoryCount[biz.category] = (categoryCount[biz.category] || 0) + 1;
  }
  console.log("\n  Business by category:");
  for (const [category, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${category}: ${count}`);
  }

  // Sample businesses
  console.log("\n  Sample businesses:");
  for (const biz of uniqueBusinesses.slice(0, 5)) {
    console.log(`    - ${biz.name} (${biz.category}${biz.subcategory ? ` - ${biz.subcategory}` : ""}) [${biz.sourcePlatform}]`);
    if (biz.rating) console.log(`      Rating: ${biz.rating} (${biz.reviewCount || 0} reviews)`);
    if (biz.address) console.log(`      ${biz.address}`);
  }

  console.log("=".repeat(60));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;

  (async () => {
    try {
      await buildBusinessIndex({ dryRun, limit });
    } catch (err) {
      console.error("[business-index] Fatal error:", err);
      process.exit(1);
    }
  })();
}
