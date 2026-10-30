import { afterEach, describe, expect, it, vi } from "vitest";
import type { PartnerAiSessionOpResult } from "@/lib/domain/partnerAiSession";

const applyPartnerOp = vi.hoisted(() => vi.fn());

vi.mock("@/lib/repositories/aiSessionQuotaRepository", () => ({ applyPartnerOp }));

const { PartnerEventIdConflictError, applyPartnerAiSessionOp } = await import("./partnerAiSessionService");
const { TenantCompanyCodeNotFoundError } = await import("@/lib/services/tenantService");

const counters = { base_limit: 100, base_used: 40, topup_balance: 27 };
const topup = {
  company_code: "XAZ342WG",
  op: "add_topup",
  amount: 20,
  event_id: "topup-001",
} as const;

function repositoryReturns(outcome: PartnerAiSessionOpResult["outcome"]) {
  applyPartnerOp.mockResolvedValue({ outcome, ...counters });
}

describe("applyPartnerAiSessionOp", () => {
  afterEach(() => {
    applyPartnerOp.mockReset();
  });

  it("should return idempotent false and remaining from the counters when applied", async () => {
    repositoryReturns("applied");

    await expect(applyPartnerAiSessionOp(topup)).resolves.toEqual({
      idempotent: false,
      companyCode: "XAZ342WG",
      op: "add_topup",
      ...counters,
      remaining: 87,
    });
    expect(applyPartnerOp).toHaveBeenCalledTimes(1);
  });

  it("should return idempotent true and the same remaining when replayed", async () => {
    repositoryReturns("replayed");

    await expect(applyPartnerAiSessionOp(topup)).resolves.toMatchObject({
      idempotent: true,
      remaining: 87,
    });
  });

  it("should throw TenantCompanyCodeNotFoundError when the company code is not found", async () => {
    repositoryReturns("company_code_not_found");

    await expect(applyPartnerAiSessionOp(topup)).rejects.toBeInstanceOf(TenantCompanyCodeNotFoundError);
  });

  it("should throw PartnerEventIdConflictError when the event_id was used for another op", async () => {
    repositoryReturns("event_id_conflict");

    await expect(applyPartnerAiSessionOp(topup)).rejects.toBeInstanceOf(PartnerEventIdConflictError);
  });

  it("should pass a null amount, not 0, when reset_base omits amount", async () => {
    repositoryReturns("applied");

    await applyPartnerAiSessionOp({ company_code: "XAZ342WG", op: "reset_base", event_id: "reset-1" });

    expect(applyPartnerOp).toHaveBeenCalledWith(expect.objectContaining({ op: "reset_base", amount: null }));
  });

  it("should keep a reset_base amount of 0", async () => {
    repositoryReturns("applied");

    await applyPartnerAiSessionOp({ company_code: "XAZ342WG", op: "reset_base", amount: 0, event_id: "reset-2" });

    expect(applyPartnerOp).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }));
  });
});
