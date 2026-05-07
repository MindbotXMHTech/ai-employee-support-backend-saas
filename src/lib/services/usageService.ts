import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { MessageRole, MessageType, RequestType, SafetyLevel, SourceDocument } from "@/lib/types";

export async function logMessage(input: {
  tenantId: string;
  conversationId?: string | null;
  externalUserId?: string | null;
  role: MessageRole;
  content: string;
  messageType?: MessageType;
  modelUsed?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  safetyLevel?: SafetyLevel | null;
  sources?: SourceDocument[] | null;
  metadata?: Record<string, unknown> | null;
}) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId ?? null,
      external_user_id: input.externalUserId ?? null,
      role: input.role,
      content: input.content,
      message_type: input.messageType ?? null,
      model_used: input.modelUsed ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      total_tokens: input.totalTokens ?? null,
      estimated_cost_usd: input.estimatedCostUsd ?? null,
      safety_level: input.safetyLevel ?? null,
      sources: input.sources ?? null,
      metadata: input.metadata ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function logUsage(input: {
  tenantId: string;
  externalUserId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  modelUsed?: string | null;
  requestType: RequestType;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
}) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("usage_logs").insert({
    tenant_id: input.tenantId,
    external_user_id: input.externalUserId ?? null,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    model_used: input.modelUsed ?? null,
    request_type: input.requestType,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    total_tokens: input.totalTokens ?? null,
    estimated_cost_usd: input.estimatedCostUsd ?? null,
  });
  if (error) throw error;
}

export async function usageSummary(tenantId: string, fromDate: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("usage_logs")
    .select("request_type, input_tokens, output_tokens, total_tokens, estimated_cost_usd, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", fromDate);
  if (error) throw error;

  return (data ?? []).reduce(
    (acc, row) => {
      acc.inputTokens += Number(row.input_tokens ?? 0);
      acc.outputTokens += Number(row.output_tokens ?? 0);
      acc.totalTokens += Number(row.total_tokens ?? 0);
      acc.estimatedCostUsd += Number(row.estimated_cost_usd ?? 0);
      acc.byType[row.request_type as string] = (acc.byType[row.request_type as string] ?? 0) + 1;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, byType: {} as Record<string, number> },
  );
}
