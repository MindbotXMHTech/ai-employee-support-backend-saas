export const AI_MODELS = {
  GENERAL: process.env.AI_MODEL_GENERAL ?? "gpt-5-nano",
  RAG: process.env.AI_MODEL_RAG ?? "gpt-5-mini",
  SAFETY: process.env.AI_MODEL_SAFETY ?? "gpt-5-mini",
  EMBEDDING: process.env.AI_MODEL_EMBEDDING ?? "text-embedding-3-small",
} as const;

export type AiModelKey = keyof typeof AI_MODELS;

export const DEFAULT_MODEL_PRICING = [
  { model_name: "gpt-5-nano", input_per_1m: 0.05, output_per_1m: 0.4 },
  { model_name: "gpt-5-mini", input_per_1m: 0.25, output_per_1m: 2 },
  { model_name: "text-embedding-3-small", input_per_1m: 0.02, output_per_1m: 0 },
] as const;
