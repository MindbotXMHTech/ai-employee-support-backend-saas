import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { DEFAULT_MODEL_PRICING } from "@/lib/ai/models";

export function calculateCost(input: {
  inputTokens?: number | null;
  outputTokens?: number | null;
  inputPer1m: number;
  outputPer1m: number;
}) {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  return (inputTokens / 1_000_000) * input.inputPer1m + (outputTokens / 1_000_000) * input.outputPer1m;
}

export async function estimateCost(modelName: string, inputTokens = 0, outputTokens = 0) {
  const fallback = DEFAULT_MODEL_PRICING.find((pricing) => pricing.model_name === modelName);
  try {
    const supabase = createSupabaseServiceClient();
    const { data } = await supabase
      .from("model_pricing")
      .select("input_per_1m, output_per_1m")
      .eq("model_name", modelName)
      .eq("active", true)
      .single();
    return calculateCost({
      inputTokens,
      outputTokens,
      inputPer1m: Number(data?.input_per_1m ?? fallback?.input_per_1m ?? 0),
      outputPer1m: Number(data?.output_per_1m ?? fallback?.output_per_1m ?? 0),
    });
  } catch {
    return calculateCost({
      inputTokens,
      outputTokens,
      inputPer1m: fallback?.input_per_1m ?? 0,
      outputPer1m: fallback?.output_per_1m ?? 0,
    });
  }
}
