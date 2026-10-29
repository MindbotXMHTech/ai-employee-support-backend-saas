import type { AiSessionQuotaCounters } from "@/lib/domain/aiSessionQuota";

export const PARTNER_AI_SESSION_OPS = ["set_base", "add_topup", "reset_base"] as const;

export type PartnerAiSessionOp = (typeof PARTNER_AI_SESSION_OPS)[number];

export const PARTNER_AI_SESSION_OP_OUTCOMES = [
  "applied",
  "replayed",
  "company_code_not_found",
  "event_id_conflict",
] as const;

export type PartnerAiSessionOpOutcome = (typeof PARTNER_AI_SESSION_OP_OUTCOMES)[number];

export interface PartnerAiSessionOpResult extends AiSessionQuotaCounters {
  outcome: PartnerAiSessionOpOutcome;
}
