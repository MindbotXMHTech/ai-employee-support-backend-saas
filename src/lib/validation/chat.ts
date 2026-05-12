import { z } from "zod";

export const apiKeyHeaderSchema = z.object({
  apiKey: z.string().min(20, "Missing x-api-key header"),
});

export const chatRequestSchema = z.object({
  external_user_id: z.string().min(1).max(255),
  channel: z.string().min(1).max(64).default("api"),
  message: z.string().min(1).max(8000),
  company_code: z.string().max(64).optional(),
  conversation_id: z.string().max(255).optional(),
  bot_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Tenant-scoped token when the client cannot set `x-central-bot-secret` (e.g. some workflow HTTP nodes). Omit from downstream chat handling. */
  workflow_token: z.string().min(1).max(512).optional(),
});

export const chatV2RequestSchema = z.object({
  user_id: z.string().min(1).max(255),
  message: z.string().min(1).max(8000),
  company_code: z.string().min(1).max(64),
});

export const registerUserRequestSchema = z.object({
  external_user_id: z.string().min(1).max(255).optional(),
  line_user_id: z.string().min(1).max(255).optional(),
  channel: z.string().min(1).max(64).default("line"),
  company_code: z.string().min(1).max(64),
  display_name: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => data.external_user_id || data.line_user_id, {
  message: "external_user_id or line_user_id is required",
});

export const playgroundRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  bot_id: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type ChatV2RequestInput = z.infer<typeof chatV2RequestSchema>;
export type RegisterUserRequestInput = z.infer<typeof registerUserRequestSchema>;
export type PlaygroundRequestInput = z.infer<typeof playgroundRequestSchema>;
