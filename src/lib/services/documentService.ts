import path from "node:path";
import mammoth from "mammoth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { embedText } from "@/lib/services/ragService";
import { estimateCost } from "@/lib/services/costService";
import { logUsage } from "@/lib/services/usageService";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import type { DocumentCategory } from "@/lib/types";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}

export function validateDocumentFile(file: File, limits: { maxBytes: number }) {
  if (!allowedMimeTypes.has(file.type)) throw new Error("Unsupported file type.");
  if (file.size > limits.maxBytes) throw new Error("File exceeds tenant storage limit.");
}

export function chunkText(text: string, maxChars = 2800, overlapChars = 400) {
  const normalized = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + maxChars, normalized.length);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }
  return chunks.filter(Boolean);
}

export async function extractTextFromFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
  return buffer.toString("utf8");
}

export async function createDocumentRecord(input: {
  tenantId: string;
  uploadedBy?: string | null;
  file: File;
  category: DocumentCategory;
}) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: input.tenantId,
      uploaded_by: input.uploadedBy ?? null,
      file_name: sanitizeFileName(input.file.name),
      file_type: input.file.type,
      file_size_bytes: input.file.size,
      document_category: input.category,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function uploadDocumentFile(input: { tenantId: string; documentId: string; file: File }) {
  const supabase = createSupabaseServiceClient();
  const fileName = sanitizeFileName(input.file.name);
  const storagePath = path.posix.join("tenants", input.tenantId, "documents", input.documentId, fileName);
  const { error } = await supabase.storage.from("tenant-documents").upload(storagePath, input.file, { upsert: true });
  if (error) throw error;
  await supabase.from("documents").update({ storage_path: storagePath }).eq("id", input.documentId);
  return storagePath;
}

export async function processDocument(input: { tenantId: string; documentId: string; file: File }) {
  const supabase = createSupabaseServiceClient();
  await supabase.from("documents").update({ status: "processing", processing_error: null }).eq("id", input.documentId);
  try {
    const aiSettings = await getTenantAiSettings(input.tenantId);
    const text = await extractTextFromFile(input.file);
    const chunks = chunkText(text);
    await supabase.from("document_chunks").delete().eq("document_id", input.documentId);

    for (const [index, content] of chunks.entries()) {
      const embedding = await embedText(content, input.tenantId);
      await supabase.from("document_chunks").insert({
        tenant_id: input.tenantId,
        document_id: input.documentId,
        chunk_index: index,
        content,
        embedding,
        token_count: Math.ceil(content.length / 4),
        metadata: { section: `Chunk ${index + 1}` },
      });
      const estimated = await estimateCost(aiSettings.embedding_model, Math.ceil(content.length / 4), 0);
      await logUsage({
        tenantId: input.tenantId,
        modelUsed: aiSettings.embedding_model,
        requestType: "embedding",
        inputTokens: Math.ceil(content.length / 4),
        outputTokens: 0,
        totalTokens: Math.ceil(content.length / 4),
        estimatedCostUsd: estimated,
      });
    }

    await supabase.from("documents").update({ status: "ready" }).eq("id", input.documentId);
    return { chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed.";
    await supabase.from("documents").update({ status: "failed", processing_error: message }).eq("id", input.documentId);
    throw error;
  }
}
