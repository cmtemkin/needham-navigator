/**
 * scripts/extract-pdf.ts — PDF text extraction
 *
 * Downloads PDFs and extracts text content. Uses a simple fetch + text
 * extraction approach. For complex PDFs with tables/multi-column layouts,
 * delegates to LlamaParse API.
 *
 * Note: Since this is a Node.js/TypeScript project, we use LlamaParse's
 * REST API directly instead of Python's pypdf. For simple PDFs, we use
 * pdf-parse (a Node.js PDF text extractor). For complex ones, LlamaParse.
 */

import { createHash } from "crypto";
import { PDFParse } from "pdf-parse";
import { getSupabaseServiceClient } from "../src/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfExtractionResult {
  url: string;
  title: string;
  text: string;
  pageCount: number;
  contentHash: string;
  fileSizeBytes: number;
  extractionMethod: "simple" | "llamaparse";
  isComplex: boolean;
}

export interface ExtractionOptions {
  townId?: string;
  forceMethod?: "simple" | "llamaparse";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Heuristic-based complexity detection
 * Analyzes simple extraction output to determine if LlamaParse is needed
 */
async function isProbablyComplex(
  pdfBuffer: Buffer,
  url: string,
  title: string
): Promise<boolean> {
  // Keyword-based hints from URL/title
  const keywords = [
    "fee schedule",
    "budget",
    "financial",
    "table of",
    "zoning map",
    "dimensional",
    "schedule of",
  ];
  const lower = `${url} ${title}`.toLowerCase();
  const hasKeywordHint = keywords.some((k) => lower.includes(k));

  // Try simple extraction first
  try {
    const simpleResult = await extractSimple(pdfBuffer);
    const avgCharsPerPage = simpleResult.pageCount > 0
      ? simpleResult.text.length / simpleResult.pageCount
      : simpleResult.text.length;

    // Count markdown table markers (|...|)
    const tableCount = (simpleResult.text.match(/\|.*\|/g) || []).length;

    // Heuristics:
    // 1. Low character count per page (<200) = likely scanned/images
    // 2. High table density (>10 tables) = table-heavy document
    // 3. Nearly empty extraction (<100 chars) = likely failed simple extraction
    // 4. Keyword hint from URL/title

    const isComplex =
      avgCharsPerPage < 200 ||
      tableCount > 10 ||
      simpleResult.text.trim().length < 100 ||
      (hasKeywordHint && tableCount > 3);

    return isComplex;
  } catch (err) {
    // If simple extraction fails, assume complex
    console.log(`[extract-pdf] Simple extraction failed, assuming complex: ${err}`);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Download PDF
// ---------------------------------------------------------------------------

async function downloadPdf(url: string): Promise<Buffer> {
  console.log(`[extract-pdf] Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Simple extraction (pdf-parse)
// ---------------------------------------------------------------------------

async function extractSimple(pdfBuffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  try {
    const textResult = await parser.getText();
    return {
      text: textResult.text,
      pageCount: textResult.pages.length,
    };
  } finally {
    await parser.destroy();
  }
}

// ---------------------------------------------------------------------------
// LlamaParse extraction (REST API)
// ---------------------------------------------------------------------------

async function extractWithLlamaParse(
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ text: string; pageCount: number }> {
  const apiKey = process.env.LLAMAPARSE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing environment variable: LLAMAPARSE_API_KEY");
  }

  console.log(`[extract-pdf] Using LlamaParse for ${fileName}`);

  // Upload the file
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, fileName);
  formData.append("result_type", "markdown");
  formData.append("auto_mode", "true");

  const uploadResponse = await fetch(
    "https://api.cloud.llamaindex.ai/api/parsing/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`LlamaParse upload failed: ${uploadResponse.status} — ${errorText}`);
  }

  const uploadResult = await uploadResponse.json();
  const jobId = uploadResult.id;

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes at 5s intervals
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;

    const statusResponse = await fetch(
      `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!statusResponse.ok) continue;

    const status = await statusResponse.json();
    if (status.status === "SUCCESS") {
      // Get the result
      const resultResponse = await fetch(
        `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      if (!resultResponse.ok) {
        throw new Error(`LlamaParse result fetch failed: ${resultResponse.status}`);
      }

      const result = await resultResponse.json();
      return {
        text: result.markdown || result.text || "",
        pageCount: status.num_pages || 0,
      };
    } else if (status.status === "ERROR") {
      throw new Error(`LlamaParse job failed: ${status.error}`);
    }

    // Still processing, continue polling
  }

  throw new Error("LlamaParse job timed out after 5 minutes");
}

/**
 * Validate extraction quality
 */
interface ExtractionValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

function validateExtraction(result: PdfExtractionResult): ExtractionValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Multi-page PDF with very little text = likely extraction failure
  if (result.pageCount > 1 && result.text.length < 100) {
    errors.push(
      `Multi-page PDF (${result.pageCount} pages) extracted <100 chars - likely extraction failure`
    );
  }

  // Check for common extraction artifacts (non-printable characters)
  const nonPrintableCount = (result.text.match(/[^\x20-\x7E\n\r]/g) || []).length;
  if (nonPrintableCount > result.text.length * 0.1) {
    warnings.push("High density of non-printable characters detected");
  }

  // Fee schedules should have table markers
  if (result.url.toLowerCase().includes("fee") && !result.text.includes("|")) {
    warnings.push("Fee schedule PDF has no detected tables");
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function extractPdf(
  url: string,
  options: ExtractionOptions = {}
): Promise<PdfExtractionResult> {
  const { forceMethod } = options;

  const pdfBuffer = await downloadPdf(url);
  const fileName = url.split("/").pop() || "document.pdf";
  const title = fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");

  const isComplex = forceMethod
    ? forceMethod === "llamaparse"
    : await isProbablyComplex(pdfBuffer, url, title);

  let text: string;
  let pageCount: number;
  let method: "simple" | "llamaparse";

  if (isComplex || forceMethod === "llamaparse") {
    try {
      const result = await extractWithLlamaParse(pdfBuffer, fileName);
      text = result.text;
      pageCount = result.pageCount;
      method = "llamaparse";
    } catch (err) {
      console.warn(`[extract-pdf] LlamaParse failed, trying simple: ${err}`);
      const result = await extractSimple(pdfBuffer);
      text = result.text;
      pageCount = result.pageCount;
      method = "simple";
    }
  } else {
    try {
      const result = await extractSimple(pdfBuffer);
      text = result.text;
      pageCount = result.pageCount;
      method = "simple";
    } catch (err) {
      // Fallback to LlamaParse
      console.warn(`[extract-pdf] Simple extraction failed, trying LlamaParse: ${err}`);
      const result = await extractWithLlamaParse(pdfBuffer, fileName);
      text = result.text;
      pageCount = result.pageCount;
      method = "llamaparse";
    }
  }

  const extractionResult: PdfExtractionResult = {
    url,
    title,
    text,
    pageCount,
    contentHash: hashContent(text),
    fileSizeBytes: pdfBuffer.length,
    extractionMethod: method,
    isComplex,
  };

  // Validate extraction
  const validation = validateExtraction(extractionResult);
  if (!validation.isValid) {
    console.error(`[extract-pdf] ❌ ${fileName} validation failed:`, validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.warn(`[extract-pdf] ⚠️  ${fileName} warnings:`, validation.warnings);
  }

  console.log(
    `[extract-pdf] Extracted ${pageCount} pages from ${fileName} (${method})`
  );

  return extractionResult;
}

// ---------------------------------------------------------------------------
// Batch extraction with parallel processing
// ---------------------------------------------------------------------------

export async function extractPdfs(
  urls: string[],
  options: ExtractionOptions & { concurrency?: number } = {}
): Promise<PdfExtractionResult[]> {
  const { townId = "needham", concurrency = 3 } = options;
  const results: PdfExtractionResult[] = [];
  const supabase = getSupabaseServiceClient();

  console.log(`[extract-pdf] Processing ${urls.length} PDFs with concurrency ${concurrency}`);

  // Process in batches for parallelization
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);

    const batchPromises = batch.map(async (url) => {
      try {
        // Check if content has changed via hash
        const { data: existing } = await supabase
          .from("documents")
          .select("content_hash")
          .eq("town_id", townId)
          .eq("url", url)
          .single();

        const result = await extractPdf(url, options);

        if (existing?.content_hash === result.contentHash) {
          console.log(`[extract-pdf] Skipping ${url} (unchanged)`);
          return null;
        }

        // Store document record
        await supabase.from("documents").upsert(
          {
            town_id: townId,
            url,
            title: result.title,
            source_type: "pdf",
            content_hash: result.contentHash,
            file_size_bytes: result.fileSizeBytes,
            downloaded_at: new Date().toISOString(),
            metadata: {
              page_count: result.pageCount,
              extraction_method: result.extractionMethod,
              is_complex: result.isComplex,
            },
          },
          { onConflict: "town_id,url" }
        );

        return result;
      } catch (err) {
        console.error(`[extract-pdf] Failed to extract ${url}:`, err);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((r): r is PdfExtractionResult => r !== null));

    console.log(
      `[extract-pdf] Batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)} complete`
    );
  }

  console.log(
    `[extract-pdf] Extracted ${results.length}/${urls.length} PDFs`
  );
  return results;
}
