import { z } from "zod";

const companyCodeField = z
  .string()
  .trim()
  .min(4, "company_code must be at least 4 characters")
  .max(64, "company_code must be at most 64 characters")
  .regex(/^[A-Za-z0-9]+$/, "company_code must be alphanumeric (A-Z, a-z, 0-9)")
  .transform((s) => s.toUpperCase());

/** Partner API: SaaS onboarding with caller-supplied company code (central bot registration still uses LINE + code). */
export const partnerProvisionTenantSchema = z.object({
  company_code: companyCodeField,
  name: z.string().trim().min(1, "name is required"),
  plan: z.enum(["trial", "pro"]),
  industry: z.string().optional(),
  company_description: z.string().optional(),
  hr_contact_name: z.string().optional(),
  hr_contact_email: z.union([z.string().email(), z.literal("")]).optional(),
  admin_email: z.string().trim().email(),
  admin_display_name: z.string().trim().min(1, "admin_display_name is required"),
});

export type PartnerProvisionTenantInput = z.infer<typeof partnerProvisionTenantSchema>;
