import { z } from "zod";
import type { PartnerAiSessionOp } from "@/lib/domain/partnerAiSession";

const companyCodeField = z
  .string()
  .trim()
  .min(4, "company_code must be at least 4 characters")
  .max(64, "company_code must be at most 64 characters")
  .regex(/^[A-Za-z0-9]+$/, "company_code must be alphanumeric (A-Z, a-z, 0-9)")
  .transform((s) => s.toUpperCase());

/** Partner API: SaaS runtime tenant with caller-supplied company code and quota from Mindbloom. */
export const partnerProvisionTenantSchema = z.object({
  company_code: companyCodeField,
  name: z.string().trim().min(1, "name is required"),
  quota: z.coerce.number().int().min(0).max(1_000_000),
  industry: z.string().optional(),
  company_description: z.string().optional(),
  hr_contact_name: z.string().optional(),
  hr_contact_email: z.union([z.string().email(), z.literal("")]).optional(),
  admin_email: z.string().trim().email(),
  admin_display_name: z.string().trim().min(1, "admin_display_name is required"),
});

export type PartnerProvisionTenantInput = z.infer<typeof partnerProvisionTenantSchema>;

/** Quota-only sync from Mindbloom — plan/status are not part of the SaaS contract. */
export const partnerTenantPlanSyncSchema = z.object({
  company_code: companyCodeField,
  quota: z.coerce.number().int().min(0).max(1_000_000),
  event_id: z.string().trim().min(1, "event_id is required").max(200),
  occurred_at: z.string().datetime().optional(),
  updated_by: z.string().trim().max(200).optional(),
});

export type PartnerTenantPlanSyncInput = z.infer<typeof partnerTenantPlanSyncSchema>;

const partnerAiSessionEventFields = {
  company_code: companyCodeField,
  event_id: z.string().trim().min(1, "event_id is required").max(200),
  occurred_at: z.string().datetime().optional(),
  updated_by: z.string().trim().max(200).optional(),
};

const aiSessionAmount = z.number().int().min(0).max(1_000_000);

export const partnerAiSessionOpSchema = z.discriminatedUnion("op", [
  z.object({ ...partnerAiSessionEventFields, op: z.literal("set_base"), amount: aiSessionAmount }),
  z.object({ ...partnerAiSessionEventFields, op: z.literal("add_topup"), amount: aiSessionAmount.min(1) }),
  z.object({ ...partnerAiSessionEventFields, op: z.literal("reset_base"), amount: aiSessionAmount.optional() }),
]);

type SubsetOf<Sub extends Super, Super> = Sub;
type SchemaCommand = z.infer<typeof partnerAiSessionOpSchema>;
type SchemaOps = SubsetOf<PartnerAiSessionOp, SubsetOf<SchemaCommand["op"], PartnerAiSessionOp>>;

export type PartnerAiSessionCommand = Extract<SchemaCommand, { op: SchemaOps }>;

/** Compensating revoke when Mindbloom local upsert fails after partner create (OWASP-04). */
export const partnerRevokeTenantSchema = z.object({
  company_code: companyCodeField,
  event_id: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().max(200).optional(),
});

export type PartnerRevokeTenantInput = z.infer<typeof partnerRevokeTenantSchema>;
