import crypto from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { MessageType, SourceDocument } from "@/lib/types";

export function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function queryHash(query: string) {
  return crypto.createHash("sha256").update(normalizeQuery(query)).digest("hex");
}

export async function getCachedResponse(tenantId: string, query: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("semantic_cache")
    .select("response, message_type, sources")
    .eq("tenant_id", tenantId)
    .eq("query_hash", queryHash(query))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

export async function setCachedResponse(input: {
  tenantId: string;
  query: string;
  response: string;
  messageType: MessageType;
  sources?: SourceDocument[];
  ttlMinutes?: number;
}) {
  const supabase = createSupabaseServiceClient();
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 60) * 60_000).toISOString();
  await supabase.from("semantic_cache").insert({
    tenant_id: input.tenantId,
    query_hash: queryHash(input.query),
    normalized_query: normalizeQuery(input.query),
    response: input.response,
    message_type: input.messageType,
    sources: input.sources ?? [],
    expires_at: expiresAt,
  });
}
