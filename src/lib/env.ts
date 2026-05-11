import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_TRIAL_DAYS: z.coerce.number().int().positive().default(7),
  DEFAULT_TRIAL_MESSAGE_LIMIT: z.coerce.number().int().positive().default(500),
  DEFAULT_PRO_MESSAGE_LIMIT: z.coerce.number().int().positive().default(30000),
  DEFAULT_MAX_SENTENCES: z.coerce.number().int().positive().default(5),
  API_KEY_SECRET: z.string().optional(),
  CENTRAL_BOT_SECRET: z.string().optional(),
  MINDBLOOM_PROVISION_URL: z.string().optional(),
  MINDBLOOM_PROVISION_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function requireEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value);
}
