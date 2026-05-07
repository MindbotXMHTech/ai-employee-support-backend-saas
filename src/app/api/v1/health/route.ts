import { NextRequest, NextResponse } from "next/server";
import { authenticateBotRequest } from "@/lib/api/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await authenticateBotRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseServiceClient();
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", auth.tenantId)
    .eq("status", "ready");

  return NextResponse.json({
    status: "ok",
    tenant_status: auth.tenant.status,
    rag_ready: (count ?? 0) > 0,
  });
}
