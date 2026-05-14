import { NextRequest, NextResponse } from "next/server";
import { executeV1Chat } from "@/application/chat/v1-chat.use-case";
import { authenticateBotRequest, authenticateCentralBotRequest } from "@/lib/api/auth";
import { resolveTenantForCentralBot } from "@/lib/services/centralBotService";
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

    const hasCentralSecret = request.headers.has("x-central-bot-secret");
    let tenant;

    if (hasCentralSecret) {
      const auth = await authenticateCentralBotRequest(request);
      if (!auth.ok) return auth.response;

      const resolved = await resolveTenantForCentralBot({
        externalUserId: parsed.data.external_user_id,
        channel: parsed.data.channel,
        companyCode: parsed.data.company_code,
      });

      if (!resolved?.tenant) {
        const result = await executeV1Chat({ kind: "central_needs_company_code" });
        return NextResponse.json(result.body, { status: result.statusCode });
      }
      tenant = resolved.tenant;
    } else {
      const auth = await authenticateBotRequest(request);
      if (!auth.ok) return auth.response;
      tenant = auth.tenant;
    }

    const result = await executeV1Chat({
      kind: "chat",
      parsed: parsed.data,
      tenant,
    });
    return NextResponse.json(result.body, { status: result.statusCode });
  } catch (error) {
    console.error("chat_api_error", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 },
    );
  }
}
