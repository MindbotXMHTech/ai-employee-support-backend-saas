import { handleChatRequest } from "@/lib/services/aiService";
import {
  buildTenantConflictErrorBody,
  registerEmployeeTenantLink,
  TenantConflictError,
} from "@/lib/services/centralBotService";
import type { ChatApiResponse } from "@/lib/types";
import type { ChatV2RequestInput } from "@/lib/validation/chat";

/** Central bot channel for simplified v2 API (LINE legacy integration). */
export const CENTRAL_BOT_V2_CHANNEL = "line";

export const CENTRAL_BOT_V2_METADATA_SOURCE = "api_v2_chat";

export function buildV2ConversationId(input: Pick<ChatV2RequestInput, "company_code" | "user_id">) {
  return `v2:${input.company_code}:${input.user_id}`;
}

type CentralBotV2InvalidCompanyBody = {
  success: false;
  error: {
    code: "INVALID_COMPANY_CODE";
    message: string;
  };
};

type CentralBotV2TenantConflictBody = {
  success: false;
  error: {
    code: "TENANT_CONFLICT";
    message: string;
  };
};

export type CentralBotV2ChatHttpResult =
  | { statusCode: 404; body: CentralBotV2InvalidCompanyBody }
  | { statusCode: 409; body: CentralBotV2TenantConflictBody }
  | { statusCode: 200 | 400; body: ChatApiResponse };

/** Application / use-case: resolves tenant via company code, then delegates to AI chat orchestration. */
export async function executeCentralBotV2Chat(parsed: ChatV2RequestInput): Promise<CentralBotV2ChatHttpResult> {
  let linked;
  try {
    linked = await registerEmployeeTenantLink({
      externalUserId: parsed.user_id,
      channel: CENTRAL_BOT_V2_CHANNEL,
      companyCode: parsed.company_code,
      metadata: { source: CENTRAL_BOT_V2_METADATA_SOURCE },
    });
  } catch (error) {
    if (error instanceof TenantConflictError) {
      return {
        statusCode: 409,
        body: buildTenantConflictErrorBody(),
      };
    }
    throw error;
  }

  if (!linked?.tenant) {
    return {
      statusCode: 404,
      body: {
        success: false,
        error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." },
      },
    };
  }

  const chatResponse = await handleChatRequest({
    external_user_id: parsed.user_id,
    channel: CENTRAL_BOT_V2_CHANNEL,
    message: parsed.message,
    company_code: parsed.company_code,
    conversation_id: buildV2ConversationId(parsed),
    metadata: {
      source: CENTRAL_BOT_V2_METADATA_SOURCE,
    },
    tenant: linked.tenant,
  });

  return {
    statusCode: chatResponse.success ? 200 : 400,
    body: chatResponse,
  };
}
