import { NextRequest, NextResponse } from "next/server";
import { executeCentralBotV2Chat } from "@/application/central-bot/v2-chat.use-case";
import { authenticateCentralBotRequest } from "@/lib/api/auth";
import { handleChatRequest } from "@/lib/services/aiService";
import { centralBotNeedsCompanyCodeResponse } from "@/lib/services/centralBotService";
import {
  resolveTenantForWorkflowChat,
  validateWorkflowToken,
} from "@/lib/services/workflowTokenService";
import { chatV2RequestSchema } from "@/lib/validation/chat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chatV2RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const { workflow_token: bodyWorkflowToken, ...v2Payload } = parsed.data;
    const hasCentralSecret = request.headers.has("x-central-bot-secret");

    if (hasCentralSecret) {
      const auth = await authenticateCentralBotRequest(request);
      if (!auth.ok) return auth.response;

      const result = await executeCentralBotV2Chat(v2Payload);
      return NextResponse.json(result.body, { status: result.statusCode });
    }

    if (bodyWorkflowToken) {
      const tokenAuth = await validateWorkflowToken(bodyWorkflowToken);
      if (!tokenAuth) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_API_KEY", message: "Invalid or revoked workflow token." },
          },
          { status: 401 },
        );
      }

      const resolved = await resolveTenantForWorkflowChat({
        tokenTenant: tokenAuth.tenant,
        externalUserId: v2Payload.user_id,
        channel: "line",
        companyCode: v2Payload.company_code,
      });

      if (!resolved.ok) {
        if (resolved.kind === "tenant_mismatch") {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "TENANT_MISMATCH",
                message: "This user is already linked to a different company.",
              },
            },
            { status: 403 },
          );
        }
        if (resolved.kind === "needs_company_code") {
          return NextResponse.json(centralBotNeedsCompanyCodeResponse());
        }
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code for this tenant." },
          },
          { status: 404 },
        );
      }

      const response = await handleChatRequest({
        external_user_id: v2Payload.user_id,
        channel: "line",
        message: v2Payload.message,
        company_code: v2Payload.company_code,
        conversation_id: `v2:${v2Payload.company_code}:${v2Payload.user_id}`,
        metadata: {
          source: "api_v2_chat_workflow",
        },
        tenant: resolved.tenant,
      });

      return NextResponse.json(response, { status: response.success ? 200 : 400 });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Missing x-central-bot-secret header or workflow_token in JSON body.",
        },
      },
      { status: 401 },
    );
  } catch (error) {
    console.error("chat_v2_api_error", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 },
    );
  }
}
