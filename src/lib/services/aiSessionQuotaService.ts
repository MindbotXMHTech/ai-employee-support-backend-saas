import {
  checkAiSessionQuota,
  toAiSessionSnapshot,
  type AiSessionSnapshot,
} from "@/lib/domain/aiSessionQuota";
import { consumeSession, getQuota } from "@/lib/repositories/aiSessionQuotaRepository";

export { checkAiSessionQuota, toAiSessionSnapshot, type AiSessionSnapshot };

/** Reads the tenant row. Null means the tenant is not on AI sessions. This does not insert or spend. */
export async function findAiSessionQuota(tenantId: string) {
  return getQuota(tenantId);
}

/** Spends one session. The RPC returns exhausted without writing when the row is missing or empty. */
export async function consumeAiSession(tenantId: string) {
  return consumeSession(tenantId);
}
