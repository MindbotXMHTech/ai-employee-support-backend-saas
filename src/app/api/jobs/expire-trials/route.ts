import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { downgradeExpiredTrialTenantsToFree } from "@/lib/services/tenantService";

export const dynamic = "force-dynamic";

function timingSafeEqualString(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

function isAuthorized(request: NextRequest) {
  const expected = env.CRON_SECRET?.trim();
  if (!expected) return false;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearerToken = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const headerToken = request.headers.get("x-cron-secret")?.trim() ?? "";
  const token = bearerToken || headerToken;

  return Boolean(token) && timingSafeEqualString(token, expected);
}

export async function POST(request: NextRequest) {
  if (!env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const result = await downgradeExpiredTrialTenantsToFree({
      source: "expire_trials_job",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("expire_trials_job_error", error);
    return NextResponse.json(
      { success: false, error: "Failed to expire trial tenants." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
