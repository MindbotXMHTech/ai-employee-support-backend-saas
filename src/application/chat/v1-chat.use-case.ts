import { handleChatRequest } from "@/lib/services/aiService";
import { centralBotNeedsCompanyCodeResponse } from "@/lib/services/centralBotService";
import type { ChatApiResponse, Tenant } from "@/lib/types";
import type { ChatRequestInput } from "@/lib/validation/chat";

export type V1ChatUseCaseRequest =
  | { kind: "central_needs_company_code" }
  | { kind: "chat"; parsed: ChatRequestInput; tenant: Tenant };

export type V1ChatHttpResult = {
  statusCode: 200 | 400;
  body: ChatApiResponse;
};

/** Runs v1 bot chat orchestration once tenant identity is trusted (central or legacy auth). */
export async function executeV1Chat(request: V1ChatUseCaseRequest): Promise<V1ChatHttpResult> {
  if (request.kind === "central_needs_company_code") {
    return { statusCode: 200, body: centralBotNeedsCompanyCodeResponse() };
  }

  const chatResponse = await handleChatRequest({ ...request.parsed, tenant: request.tenant });
  return { statusCode: chatResponse.success ? 200 : 400, body: chatResponse };
}
