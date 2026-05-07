import { describe, expect, it } from "vitest";
import { chunkText, sanitizeFileName } from "@/lib/services/documentService";

describe("documentService", () => {
  it("sanitizes uploaded file names", () => {
    expect(sanitizeFileName("../../Leave Policy 2026.pdf")).toBe(".._.._Leave_Policy_2026.pdf");
  });

  it("chunks text with overlap", () => {
    const chunks = chunkText("a".repeat(1000), 400, 100);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[1].length).toBeLessThanOrEqual(400);
  });
});
