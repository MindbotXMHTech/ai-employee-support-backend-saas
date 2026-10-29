import { computeSessionAvailability } from "@/lib/domain/aiSessionQuota";
import type { PartnerAiSessionOp } from "@/lib/domain/partnerAiSession";
import { applyPartnerOp } from "@/lib/repositories/aiSessionQuotaRepository";
import { TenantCompanyCodeNotFoundError } from "@/lib/services/tenantService";
import type { PartnerAiSessionCommand } from "@/lib/validation/partnerProvision";

export class PartnerEventIdConflictError extends Error {
  readonly code = "EVENT_ID_CONFLICT";

  constructor() {
    super("event_id was already used for a different operation.");
    this.name = "PartnerEventIdConflictError";
  }
}

export interface PartnerAiSessionOpResponse {
  idempotent: boolean;
  companyCode: string;
  op: PartnerAiSessionOp;
  base_limit: number;
  base_used: number;
  topup_balance: number;
  remaining: number;
}

export async function applyPartnerAiSessionOp(
  command: PartnerAiSessionCommand,
): Promise<PartnerAiSessionOpResponse> {
  const result = await applyPartnerOp({
    companyCode: command.company_code,
    op: command.op,
    amount: command.amount ?? null,
    eventId: command.event_id,
    occurredAt: command.occurred_at ?? null,
    updatedBy: command.updated_by ?? null,
  });

  if (result.outcome === "company_code_not_found") throw new TenantCompanyCodeNotFoundError();
  if (result.outcome === "event_id_conflict") throw new PartnerEventIdConflictError();

  const { base_limit, base_used, topup_balance } = result;
  return {
    idempotent: result.outcome === "replayed",
    companyCode: command.company_code,
    op: command.op,
    base_limit,
    base_used,
    topup_balance,
    remaining: computeSessionAvailability(result).remaining,
  };
}
