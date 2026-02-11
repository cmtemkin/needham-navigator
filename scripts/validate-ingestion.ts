/**
 * scripts/validate-ingestion.ts — Post-ingestion data quality validation
 *
 * Validates:
 * 1. All chunks have required metadata fields
 * 2. No duplicate chunks (same content_hash)
 * 3. Embedding dimensions are correct (1536)
 * 4. Coverage report (departments with <3 chunks)
 * 5. Orphaned chunks (document_id references non-existent document)
 *
 * Run after ingestion to verify data quality.
 */

import { getSupabaseServiceClient } from "../src/lib/supabase";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalDocuments: number;
    totalChunks: number;
    documentTypes: Record<string, number>;
    departmentCoverage: Record<string, number>;
    avgChunksPerDocument: number;
    documentsWithoutChunks: number;
  };
}

interface DocumentChunk {
  id: string;
  chunk_text: string;
  embedding: string | null;
  metadata: Record<string, unknown>;
  document_id: string;
}

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

/**
 * Validate required metadata fields
 */
function validateMetadata(
  chunks: DocumentChunk[],
  errors: string[],
  warnings: string[]
): void {
  const requiredFields = [
    "document_title",
    "document_type",
    "document_url",
    "chunk_type",
    "contains_table",
    "cross_references",
    "keywords",
  ];

  const optionalButRecommended = ["department", "section_number", "section_title"];

  let missingRequiredCount = 0;
  let missingRecommendedCount = 0;

  for (const chunk of chunks) {
    const missing = requiredFields.filter((f) => !(f in chunk.metadata));

    if (missing.length > 0) {
      missingRequiredCount++;
      if (missingRequiredCount <= 5) {
        // Only show first 5 to avoid spam
        errors.push(`Chunk ${chunk.id} missing fields: ${missing.join(", ")}`);
      }
    }

    const missingRecommended = optionalButRecommended.filter(
      (f) => !(f in chunk.metadata)
    );
    if (missingRecommended.length > 0) {
      missingRecommendedCount++;
    }
  }

  if (missingRequiredCount > 5) {
    errors.push(
      `... and ${missingRequiredCount - 5} more chunks with missing required fields`
    );
  }

  if (missingRecommendedCount > 0) {
    warnings.push(
      `${missingRecommendedCount} chunks missing recommended fields (department, section_number, section_title)`
    );
  }
}

/**
 * Detect duplicate chunks
 */
function detectDuplicates(chunks: DocumentChunk[], warnings: string[]): void {
  const contentHashes = new Map<string, string[]>();

  for (const chunk of chunks) {
    const hash = createHash("sha256").update(chunk.chunk_text).digest("hex");

    if (!contentHashes.has(hash)) {
      contentHashes.set(hash, []);
    }
    contentHashes.get(hash)!.push(chunk.id);
  }

  let duplicateCount = 0;
  for (const [hash, ids] of contentHashes.entries()) {
    if (ids.length > 1) {
      duplicateCount++;
      if (duplicateCount <= 3) {
        // Only show first 3
        warnings.push(
          `Duplicate content found: ${ids.length} chunks with hash ${hash.substring(0, 8)}...`
        );
      }
    }
  }

  if (duplicateCount > 3) {
    warnings.push(
      `... and ${duplicateCount - 3} more sets of duplicate chunks found`
    );
  }
}

/**
 * Validate embedding dimensions
 */
function validateEmbeddings(chunks: DocumentChunk[], errors: string[]): void {
  let missingEmbeddingCount = 0;
  let wrongDimensionCount = 0;

  for (const chunk of chunks) {
    if (!chunk.embedding) {
      missingEmbeddingCount++;
      if (missingEmbeddingCount <= 5) {
        errors.push(`Chunk ${chunk.id} has no embedding`);
      }
      continue;
    }

    try {
      const embeddingArray = JSON.parse(chunk.embedding);
      if (!Array.isArray(embeddingArray)) {
        errors.push(`Chunk ${chunk.id} embedding is not an array`);
        continue;
      }

      const dims = embeddingArray.length;
      if (dims !== 1536) {
        wrongDimensionCount++;
        if (wrongDimensionCount <= 5) {
          errors.push(
            `Chunk ${chunk.id} has wrong embedding dimension: ${dims} (expected 1536)`
          );
        }
      }
    } catch (err) {
      errors.push(`Chunk ${chunk.id} has invalid embedding JSON: ${err}`);
    }
  }

  if (missingEmbeddingCount > 5) {
    errors.push(
      `... and ${missingEmbeddingCount - 5} more chunks missing embeddings`
    );
  }

  if (wrongDimensionCount > 5) {
    errors.push(
      `... and ${wrongDimensionCount - 5} more chunks with wrong dimensions`
    );
  }
}

/**
 * Generate coverage report
 */
function generateCoverageReport(
  chunks: DocumentChunk[],
  warnings: string[]
): {
  documentTypes: Record<string, number>;
  departmentCoverage: Record<string, number>;
} {
  const documentTypes: Record<string, number> = {};
  const departmentCoverage: Record<string, number> = {};

  for (const chunk of chunks) {
    const type = (chunk.metadata.document_type as string) || "unknown";
    documentTypes[type] = (documentTypes[type] || 0) + 1;

    const dept = (chunk.metadata.department as string) || "Unknown";
    departmentCoverage[dept] = (departmentCoverage[dept] || 0) + 1;
  }

  // Check for low coverage
  for (const [dept, count] of Object.entries(departmentCoverage)) {
    if (count < 3) {
      warnings.push(`Low coverage for department "${dept}": only ${count} chunks`);
    }
  }

  return { documentTypes, departmentCoverage };
}

/**
 * Check for orphaned chunks
 */
async function checkOrphanedChunks(
  chunks: DocumentChunk[],
  townId: string,
  errors: string[]
): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("id")
    .eq("town_id", townId);

  const validDocIds = new Set((documents || []).map((d) => d.id));

  const orphanedChunks = chunks.filter((c) => !validDocIds.has(c.document_id));

  if (orphanedChunks.length > 0) {
    errors.push(
      `Found ${orphanedChunks.length} orphaned chunks (document_id not found in documents table)`
    );
    // Show first few orphaned chunk IDs
    const sample = orphanedChunks.slice(0, 3).map((c) => c.id);
    errors.push(`  Sample orphaned chunk IDs: ${sample.join(", ")}`);
  }
}

/**
 * Check for documents without chunks
 */
async function checkDocumentsWithoutChunks(
  townId: string,
  warnings: string[]
): Promise<number> {
  const supabase = getSupabaseServiceClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, url, chunk_count")
    .eq("town_id", townId);

  const documentsWithoutChunks = (documents || []).filter(
    (d) => !d.chunk_count || d.chunk_count === 0
  );

  if (documentsWithoutChunks.length > 0) {
    warnings.push(
      `${documentsWithoutChunks.length} documents have no chunks (may be pending processing)`
    );
    // Show first few
    const sample = documentsWithoutChunks.slice(0, 3).map((d) => d.title || d.url);
    warnings.push(`  Sample: ${sample.join(", ")}`);
  }

  return documentsWithoutChunks.length;
}

// ---------------------------------------------------------------------------
// Main Validation
// ---------------------------------------------------------------------------

export async function validateIngestion(
  townId: string = "needham"
): Promise<ValidationResult> {
  const supabase = getSupabaseServiceClient();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`\n[validate] Starting validation for town: ${townId}\n`);

  // Fetch all chunks
  const { data: chunks, error: fetchError } = await supabase
    .from("document_chunks")
    .select("id, chunk_text, metadata, embedding, document_id")
    .eq("town_id", townId);

  if (fetchError) {
    errors.push(`Failed to fetch chunks: ${fetchError.message}`);
    return {
      passed: false,
      errors,
      warnings,
      stats: {
        totalDocuments: 0,
        totalChunks: 0,
        documentTypes: {},
        departmentCoverage: {},
        avgChunksPerDocument: 0,
        documentsWithoutChunks: 0,
      },
    };
  }

  const typedChunks = (chunks || []) as DocumentChunk[];

  console.log(`[validate] Found ${typedChunks.length} chunks to validate`);

  // Validation 1: Required metadata fields
  console.log("[validate] Checking required metadata fields...");
  validateMetadata(typedChunks, errors, warnings);

  // Validation 2: Duplicate detection
  console.log("[validate] Detecting duplicates...");
  detectDuplicates(typedChunks, warnings);

  // Validation 3: Embedding dimensions
  console.log("[validate] Validating embeddings...");
  validateEmbeddings(typedChunks, errors);

  // Validation 4: Coverage report
  console.log("[validate] Generating coverage report...");
  const { documentTypes, departmentCoverage } = generateCoverageReport(
    typedChunks,
    warnings
  );

  // Validation 5: Orphaned chunks
  console.log("[validate] Checking for orphaned chunks...");
  await checkOrphanedChunks(typedChunks, townId, errors);

  // Validation 6: Documents without chunks
  console.log("[validate] Checking for documents without chunks...");
  const documentsWithoutChunks = await checkDocumentsWithoutChunks(townId, warnings);

  // Get total documents count
  const { count: totalDocuments } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("town_id", townId);

  const avgChunksPerDocument =
    totalDocuments && totalDocuments > 0
      ? Math.round((typedChunks.length / totalDocuments) * 10) / 10
      : 0;

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalDocuments: totalDocuments || 0,
      totalChunks: typedChunks.length,
      documentTypes,
      departmentCoverage,
      avgChunksPerDocument,
      documentsWithoutChunks,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI Entrypoint
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const townId = process.argv[2] || "needham";

    try {
      const result = await validateIngestion(townId);

      console.log("\n========================================");
      console.log("   INGESTION VALIDATION REPORT");
      console.log("========================================\n");

      console.log(`Town: ${townId}`);
      console.log(`Total Documents: ${result.stats.totalDocuments}`);
      console.log(`Total Chunks: ${result.stats.totalChunks}`);
      console.log(
        `Avg Chunks/Document: ${result.stats.avgChunksPerDocument}`
      );
      console.log(
        `Documents Without Chunks: ${result.stats.documentsWithoutChunks}\n`
      );

      console.log("Document Types:");
      const sortedTypes = Object.entries(result.stats.documentTypes).sort(
        ([, a], [, b]) => b - a
      );
      for (const [type, count] of sortedTypes) {
        console.log(`  ${type.padEnd(20)} ${count.toString().padStart(5)}`);
      }

      console.log("\nDepartment Coverage:");
      const sortedDepts = Object.entries(result.stats.departmentCoverage).sort(
        ([, a], [, b]) => b - a
      );
      for (const [dept, count] of sortedDepts) {
        const displayDept = dept === "Unknown" ? "(Unknown Department)" : dept;
        console.log(`  ${displayDept.padEnd(40)} ${count.toString().padStart(5)} chunks`);
      }

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${result.warnings.length}):`);
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }

      if (result.errors.length > 0) {
        console.log(`\n❌ ERRORS (${result.errors.length}):`);
        for (const error of result.errors) {
          console.log(`  - ${error}`);
        }
        console.log("\n❌ Validation FAILED\n");
        process.exit(1);
      }

      console.log("\n✅ Validation PASSED\n");
    } catch (err) {
      console.error("\n❌ Validation failed with exception:", err);
      process.exit(1);
    }
  })();
}
