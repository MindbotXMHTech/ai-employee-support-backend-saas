import { NextRequest, NextResponse } from "next/server";
import { authenticateCentralBotRequest } from "@/lib/api/auth";
import { handleChatRequest } from "@/lib/services/aiService";
import { registerEmployeeTenantLink } from "@/lib/services/centralBotService";
import { chatV2RequestSchema } from "@/lib/validation/chat";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateCentralBotRequest(request);
    if (!auth.ok) return auth.response;

    const parsed = chatV2RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const linked = await registerEmployeeTenantLink({
      externalUserId: parsed.data.user_id,
      channel: "line",
      companyCode: parsed.data.company_code,
      metadata: { source: "api_v2_chat" },
    });

    if (!linked?.tenant) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." } },
        { status: 404 },
      );
    }

    const response = await handleChatRequest({
      external_user_id: parsed.data.user_id,
      channel: "line",
      message: parsed.data.message,
      company_code: parsed.data.company_code,
      conversation_id: `v2:${parsed.data.company_code}:${parsed.data.user_id}`,
      metadata: {
        source: "api_v2_chat",
      },
      tenant: linked.tenant,
    });

    return NextResponse.json(response, { status: response.success ? 200 : 400 });
  } catch (error) {
    console.error("chat_v2_api_error", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 },
    );
  }
}
