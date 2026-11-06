import { NextRequest, NextResponse } from "next/server";
import { executeCentralBotV2Chat } from "@/application/central-bot/v2-chat.use-case";
import { authenticateCentralBotRequest } from "@/lib/api/auth";
import { companyCodeField, eventIdField } from "@/lib/validation/partnerProvision";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateCentralBotRequest(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const companyCode = companyCodeField.safeParse(body?.company_code ?? "");
    if (!companyCode.success) {
      const message = companyCode.error.issues[0]?.message ?? "company_code must be at least 4 characters";
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message } },
        { status: 400 },
      );
    }
    const eventId = eventIdField.safeParse(body?.event_id ?? "");
    if (!eventId.success) {
      const message = eventId.error.issues[0]?.message ?? "event_id is required";
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message } },
        { status: 400 },
      );
    }

    const result = await executeCentralBotV2Chat(companyCode.data, eventId.data);
    return NextResponse.json(result.body, { status: result.statusCode });
  } catch (error) {
    console.error("chat_v2_api_error", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 },
    );
  }
}
