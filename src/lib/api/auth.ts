import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/services/apiKeyService";
import { validateCentralBotSecret } from "@/lib/services/centralBotService";
import type { Tenant } from "@/lib/types";

export async function authenticateCentralBotRequest(request: NextRequest): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const secret = request.headers.get("x-central-bot-secret");
  if (!validateCentralBotSecret(secret)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "INVALID_API_KEY", message: "Invalid central bot secret." } },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

export async function authenticateBotRequest(request: NextRequest): Promise<
  | { ok: true; tenant: Tenant; tenantId: string; apiKeyId: string }
  | { ok: false; response: NextResponse }
> {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "INVALID_API_KEY", message: "Missing x-api-key header." } },
        { status: 401 },
      ),
    };
  }

  const result = await validateApiKey(rawKey);
  if (!result?.tenant) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "INVALID_API_KEY", message: "Invalid or revoked API key." } },
        { status: 401 },
      ),
    };
  }

  return { ok: true, tenant: result.tenant as Tenant, tenantId: result.tenantId, apiKeyId: result.apiKeyId };
}
