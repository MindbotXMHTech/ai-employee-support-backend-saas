import { NextRequest, NextResponse } from "next/server";
import { authenticateBotRequest, authenticateCentralBotRequest } from "@/lib/api/auth";
import { handleChatRequest } from "@/lib/services/aiService";
import { centralBotNeedsCompanyCodeResponse, resolveTenantForCentralBot } from "@/lib/services/centralBotService";
import {
  resolveTenantForWorkflowChat,
  validateWorkflowToken,
} from "@/lib/services/workflowTokenService";
import { chatRequestSchema } from "@/lib/validation/chat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const { workflow_token: bodyWorkflowToken, ...chatFields } = parsed.data;
    const hasCentralSecret = request.headers.has("x-central-bot-secret");
    let tenant;

    if (hasCentralSecret) {
      const auth = await authenticateCentralBotRequest(request);
      if (!auth.ok) return auth.response;

      const resolved = await resolveTenantForCentralBot({
        externalUserId: chatFields.external_user_id,
        channel: chatFields.channel,
        companyCode: chatFields.company_code,
      });

      if (!resolved?.tenant) {
        return NextResponse.json(centralBotNeedsCompanyCodeResponse());
      }
      tenant = resolved.tenant;
    } else if (bodyWorkflowToken) {
      const tokenAuth = await validateWorkflowToken(bodyWorkflowToken);
      if (!tokenAuth) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_API_KEY", message: "Invalid or revoked workflow token." } },
          { status: 401 },
        );
      }

      const resolved = await resolveTenantForWorkflowChat({
        tokenTenant: tokenAuth.tenant,
        externalUserId: chatFields.external_user_id,
        channel: chatFields.channel,
        companyCode: chatFields.company_code,
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
      tenant = resolved.tenant;
    } else {
      const auth = await authenticateBotRequest(request);
      if (!auth.ok) return auth.response;
      tenant = auth.tenant;
    }

    const response = await handleChatRequest({ ...chatFields, tenant });
    return NextResponse.json(response, { status: response.success ? 200 : 400 });
  } catch (error) {
    console.error("chat_api_error", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 },
    );
  }
}
