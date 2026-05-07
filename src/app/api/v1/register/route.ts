import { NextRequest, NextResponse } from "next/server";
import { authenticateCentralBotRequest } from "@/lib/api/auth";
import { registerEmployeeTenantLink } from "@/lib/services/centralBotService";
import { registerUserRequestSchema } from "@/lib/validation/chat";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateCentralBotRequest(request);
    if (!auth.ok) return auth.response;

    const parsed = registerUserRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const externalUserId = parsed.data.external_user_id ?? parsed.data.line_user_id;
    if (!externalUserId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing LINE user id." } },
        { status: 400 },
      );
    }

    const registered = await registerEmployeeTenantLink({
      externalUserId,
      channel: parsed.data.channel,
      companyCode: parsed.data.company_code,
      displayName: parsed.data.display_name,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        line_user_id: parsed.data.line_user_id ?? externalUserId,
      },
    });

    if (!registered?.tenant) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_COMPANY_CODE", message: "Invalid or revoked company code." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      tenant_id: registered.tenant.id,
      tenant_name: registered.tenant.name,
      link_id: registered.link.id,
      external_user_id: externalUserId,
      channel: parsed.data.channel,
    });
  } catch (error) {
    console.error("register_user_error", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } },
      { status: 500 },
    );
  }
}
