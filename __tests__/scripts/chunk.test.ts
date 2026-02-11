import {
  chunkDocument,
  detectDocumentType,
  CHUNKING_CONFIGS,
  estimateTokens,
  type DocumentType,
} from "../../scripts/chunk";

describe("chunk", () => {
  describe("detectDocumentType", () => {
    it("detects zoning bylaws", () => {
      expect(detectDocumentType("Zoning By-Law", "Chapter 1")).toBe("zoning_bylaws");
    });

    it("detects general bylaws", () => {
      expect(detectDocumentType("General Bylaws", "Article 1")).toBe("general_bylaws");
    });

    it("detects building permits", () => {
      expect(detectDocumentType("Building Permit Application", "")).toBe("building_permits");
    });

    it("detects fee schedules", () => {
      expect(detectDocumentType("Fee Schedule 2024", "")).toBe("fee_schedules");
    });

    it("detects budget documents", () => {
      expect(detectDocumentType("Annual Budget FY2024", "")).toBe("budget");
    });

    it("detects board of health", () => {
      expect(detectDocumentType("Board of Health Regulations", "")).toBe("board_of_health");
    });

    it("detects public works / transfer station", () => {
      expect(detectDocumentType("Transfer Station Info", "RTS hours")).toBe("public_works");
    });

    it("detects meeting minutes", () => {
      expect(detectDocumentType("Meeting Minutes - January 2024", "")).toBe("meeting_minutes");
    });

    it("detects planning board", () => {
      expect(detectDocumentType("Planning Board Decision", "")).toBe("planning_board");
    });

    it("falls back to general for unknown types", () => {
      expect(detectDocumentType("Random Document", "some content")).toBe("general");
    });
  });

  describe("CHUNKING_CONFIGS", () => {
    it("has correct config for zoning bylaws", () => {
      expect(CHUNKING_CONFIGS.zoning_bylaws).toEqual({
        maxTokens: 1024,
        overlapTokens: 256,
        breakStrategy: "section_headers",
      });
    });

    it("has correct config for fee schedules", () => {
      expect(CHUNKING_CONFIGS.fee_schedules).toEqual({
        maxTokens: 384,
        overlapTokens: 96,
        breakStrategy: "table_atomic",
      });
    });

    it("overlap is 25% of max for all types", () => {
      for (const [type, config] of Object.entries(CHUNKING_CONFIGS)) {
        expect(config.overlapTokens / config.maxTokens).toBeCloseTo(0.25, 1);
      }
    });

    it("has configs for all document types", () => {
      const expectedTypes: DocumentType[] = [
        "zoning_bylaws",
        "general_bylaws",
        "building_permits",
        "fee_schedules",
        "budget",
        "board_of_health",
        "public_works",
        "meeting_minutes",
        "planning_board",
        "general",
      ];
      for (const type of expectedTypes) {
        expect(CHUNKING_CONFIGS[type]).toBeDefined();
      }
    });
  });

  describe("estimateTokens", () => {
    it("uses exact js-tiktoken tokenization", () => {
      // "hello world" is exactly 2 tokens in GPT tokenizer
      expect(estimateTokens("hello world")).toBe(2);
    });

    it("handles empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });
  });

  describe("chunkDocument", () => {
    it("chunks a simple document into pieces", () => {
      const text = "# Section 1\n\nThis is section one content.\n\n# Section 2\n\nThis is section two content.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/doc",
        documentTitle: "Test Document",
      });

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].metadata.document_title).toBe("Test Document");
      expect(chunks[0].metadata.document_url).toBe("https://example.com/doc");
    });

    it("uses correct document type config when specified", () => {
      const text = "Section content about zoning setbacks and dimensional requirements.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/zoning",
        documentTitle: "Zoning By-Law",
        documentType: "zoning_bylaws",
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].metadata.document_type).toBe("zoning_bylaws");
    });

    it("auto-detects document type from title", () => {
      const text = "Transfer Station hours and recycling schedule.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/rts",
        documentTitle: "Transfer Station Information",
      });

      expect(chunks[0].metadata.document_type).toBe("public_works");
    });

    it("detects cross-references in chunk text", () => {
      const text = "As specified in Section 4.2 of the Zoning By-Law, setbacks must comply with §5.1.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/doc",
        documentTitle: "General Document",
      });

      expect(chunks[0].metadata.cross_references.length).toBeGreaterThan(0);
    });

    it("detects tables in chunk text", () => {
      // Table followed by blank line so the TABLE_REGEX boundary matches
      const text = "# Fees\n\n| Service | Fee |\n|---------|-----|\n| Permit | $100 |\n| Review | $50 |\n\nAdditional notes.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/fees",
        documentTitle: "Fee Schedule",
        documentType: "fee_schedules",
      });

      const hasTable = chunks.some(
        (c) => c.metadata.contains_table || c.metadata.chunk_type === "table"
      );
      expect(hasTable).toBe(true);
    });

    it("extracts keywords from content", () => {
      const text = "The permit fee for residential setback variance is $200.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/doc",
        documentTitle: "Permit Info",
      });

      expect(chunks[0].metadata.keywords.length).toBeGreaterThan(0);
    });

    it("extracts zone codes from content", () => {
      const text = "Properties in SRB and GRA districts require a minimum 20-foot setback.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/doc",
        documentTitle: "Zoning By-Law",
        documentType: "zoning_bylaws",
      });

      expect(chunks[0].metadata.applies_to).toContain("SRB");
      expect(chunks[0].metadata.applies_to).toContain("GRA");
    });

    it("assigns correct chunk type based on document type", () => {
      const text = "Regulatory content about building permits.";
      const chunks = chunkDocument(text, {
        documentUrl: "https://example.com/doc",
        documentTitle: "Zoning By-Law",
        documentType: "zoning_bylaws",
      });

      expect(chunks[0].metadata.chunk_type).toBe("regulation");
    });

    it("handles empty text gracefully", () => {
      const chunks = chunkDocument("", {
        documentUrl: "https://example.com/doc",
        documentTitle: "Empty Doc",
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("respects document metadata passthrough", () => {
      const chunks = chunkDocument("Some content", {
        documentId: "test-id",
        documentUrl: "https://example.com/doc",
        documentTitle: "Test",
        department: "Planning",
        effectiveDate: "2024-01-01",
        documentDate: "2024-01-01",
      });

      expect(chunks[0].metadata.document_id).toBe("test-id");
      expect(chunks[0].metadata.department).toBe("Planning");
      expect(chunks[0].metadata.effective_date).toBe("2024-01-01");
    });
  });
});
