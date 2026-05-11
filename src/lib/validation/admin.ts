import { z } from "zod";

export const tenantFormSchema = z.object({
  name: z.string().min(1),
  plan: z.enum(["trial", "pro"]),
  status: z.enum(["active", "suspended", "expired"]).default("active"),
  industry: z.string().optional(),
  company_description: z.string().optional(),
  hr_contact_name: z.string().optional(),
  hr_contact_email: z.string().email().optional().or(z.literal("")),
  admin_email: z.string().email(),
  admin_display_name: z.string().min(1),
});

export const tenantUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  plan: z.enum(["trial", "pro"]).optional(),
  status: z.enum(["active", "suspended", "expired"]).optional(),
  monthly_message_limit: z.coerce.number().int().positive().optional(),
  storage_limit_mb: z.coerce.number().int().positive().optional(),
  max_files: z.coerce.number().int().positive().optional(),
  max_bots: z.coerce.number().int().positive().optional(),
});

export const profileFormSchema = z.object({
  company_name: z.string().optional(),
  industry: z.string().optional(),
  company_description: z.string().optional(),
  hr_contact_name: z.string().optional(),
  hr_contact_email: z.string().email().optional().or(z.literal("")),
  hr_contact_phone: z.string().optional(),
  support_contact_info: z.string().optional(),
  emergency_contact_info: z.string().optional(),
  default_language: z.string().default("th"),
  disclaimer_text: z.string().optional(),
});

export const platformAiSettingsSchema = z.object({
  name: z.string().min(1).max(120),
  tone: z.string().min(1).max(255),
  default_language: z
    .string()
    .default("th")
    .transform((value) => {
      const languages = value.split(",").map((language) => language.trim()).filter(Boolean);
      const allowed = languages.filter((language) => ["th", "en"].includes(language));
      return Array.from(new Set(allowed.length ? allowed : ["th"])).join(",");
    }),
  max_sentences: z.coerce.number().int().min(1).max(5).default(5),
  general_model: z.string().min(1).max(120),
  rag_model: z.string().min(1).max(120),
  safety_model: z.string().min(1).max(120),
  embedding_model: z.string().min(1).max(120),
  rag_enabled: z.boolean().default(true),
  mental_health_enabled: z.boolean().default(true),
  safety_enabled: z.boolean().default(true),
  handoff_enabled: z.boolean().default(true),
  classification_enabled: z.boolean().default(true),
  system_instruction: z.string().max(4000).optional().or(z.literal("")),
});

export const apiKeyCreateSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const workflowTokenCreateSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const documentUploadSchema = z.object({
  tenant_id: z.string().uuid(),
  document_category: z.enum(["benefits", "welfare", "leave_policy", "insurance", "hr_faq", "other"]),
});
