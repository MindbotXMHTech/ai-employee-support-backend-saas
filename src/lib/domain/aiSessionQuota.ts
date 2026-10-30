export const AI_SESSION_CONSUME_OUTCOMES = [
  "consumed_base",
  "consumed_topup",
  "exhausted",
] as const;

export type AiSessionConsumeOutcome = (typeof AI_SESSION_CONSUME_OUTCOMES)[number];

export interface AiSessionQuotaCounters {
  base_limit: number;
  base_used: number;
  topup_balance: number;
}

export interface AiSessionQuota extends AiSessionQuotaCounters {
  updated_at: string;
}

export interface AiSessionConsumeResult extends AiSessionQuotaCounters {
  outcome: AiSessionConsumeOutcome;
}

export interface SessionAvailability {
  baseRemaining: number;
  topupRemaining: number;
  remaining: number;
}

/** setBase may lower base_limit below base_used. That stored row is valid. */
export function computeSessionAvailability(counters: AiSessionQuotaCounters): SessionAvailability {
  const baseRemaining = Math.max(counters.base_limit - counters.base_used, 0);
  const topupRemaining = counters.topup_balance;
  return {
    baseRemaining,
    topupRemaining,
    remaining: baseRemaining + topupRemaining,
  };
}
