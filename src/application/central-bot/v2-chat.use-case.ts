import {
  AI_SESSION_NOT_PROVISIONED_MESSAGE,
  toAiSessionUsageBody,
  type AiSessionConsumeEventResult,
  type AiSessionUsageBody,
} from "@/lib/domain/aiSessionQuota";
import { consumeAiSessionEvent } from "@/lib/services/aiSessionQuotaService";

type CentralBotV2ErrorBody = {
  success: false;
  error: {
    code: "INVALID_COMPANY_CODE" | "EVENT_ID_CONFLICT";
    message: string;
  };
};

export type CentralBotV2ChatSpendOutcome = "applied" | "replayed" | "exhausted" | "not_provisioned";

export type CentralBotV2ChatSuccessBody = AiSessionUsageBody & {
  outcome: CentralBotV2ChatSpendOutcome;
};

export type CentralBotV2ChatHttpResult =
  | { statusCode: 404 | 409; body: CentralBotV2ErrorBody }
  | { statusCode: 200; body: CentralBotV2ChatSuccessBody };

/** Spends at most one AI session for this event_id. outcome says whether this event paid. */
export async function executeCentralBotV2Chat(
  companyCode: string,
  eventId: string,
): Promise<CentralBotV2ChatHttpResult> {
  const spent = await consumeAiSessionEvent(companyCode, eventId);
  if (spent.outcome === "company_code_not_found") {
    return {
      statusCode: 404,
      body: {
        success: false,
        error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
      },
    };
  }
  if (spent.outcome === "event_id_conflict") {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: {
          code: "EVENT_ID_CONFLICT",
          message: "event_id was already used for a different company.",
        },
      },
    };
  }
  if (spent.outcome === "not_provisioned") {
    return {
      statusCode: 200,
      body: {
        ai_session: null,
        message: AI_SESSION_NOT_PROVISIONED_MESSAGE,
        outcome: "not_provisioned",
      },
    };
  }

  return {
    statusCode: 200,
    body: { ...toAiSessionUsageBody(countersOf(spent)), outcome: spent.outcome },
  };
}

function countersOf(spent: AiSessionConsumeEventResult) {
  return {
    base_limit: spent.base_limit,
    base_used: spent.base_used,
    topup_balance: spent.topup_balance,
  };
}
