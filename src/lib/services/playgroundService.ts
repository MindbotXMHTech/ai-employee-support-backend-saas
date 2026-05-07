import OpenAI from "openai";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { estimateCost } from "@/lib/services/costService";
import { buildRagContext, chunksToSources, retrieveChunks } from "@/lib/services/ragService";
import { logUsage } from "@/lib/services/usageService";
import { ragPrompt } from "@/lib/services/promptService";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";

export async function runRagPlayground(input: { tenantId: string; message: string; botId?: string }) {
  const supabase = createSupabaseServiceClient();
  const [{ data: tenant }, { data: profile }, aiSettings] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", input.tenantId).single(),
    supabase.from("tenant_profiles").select("*").eq("tenant_id", input.tenantId).maybeSingle(),
    getTenantAiSettings(input.tenantId),
  ]);
  const chunks = await retrieveChunks({ tenantId: input.tenantId, query: input.message });
  const sources = chunksToSources(chunks);
  const system = ragPrompt(profile?.company_name ?? tenant?.name ?? "Company", aiSettings);
  const user = `Company knowledge context:\n${buildRagContext(chunks)}\n\nTest question:\n${input.message}`;

  let reply = "ยังไม่พบข้อมูลนี้ในเอกสารของบริษัท กรุณาติดต่อ HR เพื่อยืนยันข้อมูลครับ";
  let inputTokens = Math.ceil((system.length + user.length) / 4);
  let outputTokens = 0;

  if (env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: aiSettings.rag_model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    reply = response.output_text.trim() || reply;
    inputTokens = response.usage?.input_tokens ?? inputTokens;
    outputTokens = response.usage?.output_tokens ?? Math.ceil(reply.length / 4);
  }

  const totalTokens = inputTokens + outputTokens;
  const estimatedCostUsd = await estimateCost(aiSettings.rag_model, inputTokens, outputTokens);
  await logUsage({
    tenantId: input.tenantId,
    modelUsed: aiSettings.rag_model,
    requestType: "playground",
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd,
  });

  return {
    reply,
    sources,
    model_used: aiSettings.rag_model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    estimated_cost_usd: estimatedCostUsd,
    message_type: "rag",
  };
}
