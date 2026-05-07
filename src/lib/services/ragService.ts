import OpenAI from "openai";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import type { SourceDocument } from "@/lib/types";

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
  document_name: string;
  document_category: SourceDocument["category"];
}

export async function embedText(text: string, tenantId: string) {
  if (!env.OPENAI_API_KEY) {
    return new Array(1536).fill(0);
  }
  const settings = await getTenantAiSettings(tenantId);
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: settings.embedding_model,
    input: text.slice(0, 8000),
  });
  return response.data[0]?.embedding ?? new Array(1536).fill(0);
}

export async function retrieveChunks(input: { tenantId: string; query: string; matchCount?: number }) {
  const supabase = createSupabaseServiceClient();
  const embedding = await embedText(input.query, input.tenantId);
  const { data, error } = await supabase.rpc("match_document_chunks", {
    target_tenant_id: input.tenantId,
    query_embedding: embedding,
    match_count: input.matchCount ?? 5,
    similarity_threshold: 0.72,
  });
  if (error) throw error;
  return (data ?? []) as RetrievedChunk[];
}

export function buildRagContext(chunks: RetrievedChunk[]) {
  let totalChars = 0;
  const selected: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    if (totalChars + chunk.content.length > 12000) break;
    selected.push(chunk);
    totalChars += chunk.content.length;
  }

  return selected
    .map((chunk, index) => {
      const section = typeof chunk.metadata?.section === "string" ? chunk.metadata.section : null;
      return `[Source ${index + 1}: ${chunk.document_name}${section ? ` / ${section}` : ""}]\n${chunk.content}`;
    })
    .join("\n\n");
}

export function chunksToSources(chunks: RetrievedChunk[]): SourceDocument[] {
  const seen = new Set<string>();
  return chunks
    .map((chunk) => ({
      document_name: chunk.document_name,
      category: chunk.document_category,
      section: typeof chunk.metadata?.section === "string" ? chunk.metadata.section : null,
      score: chunk.similarity,
    }))
    .filter((source) => {
      const key = `${source.document_name}:${source.section ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
