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

// Patterns indicating a PDF likely needs LlamaParse
const COMPLEX_PDF_INDICATORS = [
  "fee schedule",
  "budget",
  "financial",
  "table of",
  "zoning map",
  "dimensional",
  "schedule of",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function isProbablyComplex(url: string, title: string): boolean {
  const lower = `${url} ${title}`.toLowerCase();
  return COMPLEX_PDF_INDICATORS.some((indicator) => lower.includes(indicator));
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
    : isProbablyComplex(url, title);

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
    } catch {
      // Fallback to LlamaParse
      const result = await extractWithLlamaParse(pdfBuffer, fileName);
      text = result.text;
      pageCount = result.pageCount;
      method = "llamaparse";
    }
  }

  console.log(
    `[extract-pdf] Extracted ${pageCount} pages from ${fileName} (${method})`
  );

  return {
    url,
    title,
    text,
    pageCount,
    contentHash: hashContent(text),
    fileSizeBytes: pdfBuffer.length,
    extractionMethod: method,
    isComplex,
  };
}

// ---------------------------------------------------------------------------
// Batch extraction
// ---------------------------------------------------------------------------

export async function extractPdfs(
  urls: string[],
  options: ExtractionOptions = {}
): Promise<PdfExtractionResult[]> {
  const { townId = "needham" } = options;
  const results: PdfExtractionResult[] = [];
  const supabase = getSupabaseServiceClient();

  for (const url of urls) {
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
        continue;
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

      results.push(result);
    } catch (err) {
      console.error(`[extract-pdf] Failed to extract ${url}:`, err);
    }
  }

  console.log(
    `[extract-pdf] Extracted ${results.length}/${urls.length} PDFs`
  );
  return results;
}
