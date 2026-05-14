import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminEmailTakenError, createTenantOnboarding } from "@/lib/services/tenantService";
import { isPostgrestJwtDecodeError, SUPABASE_KEY_MISMATCH_USER_MESSAGE } from "@/lib/supabase/postgrestErrors";
import { tenantFormSchema } from "@/lib/validation/admin";

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;
  if (admin.appUser.role !== "platform_admin") {
    return NextResponse.json({ error: "Platform admin required." }, { status: 403 });
  }

  const parsed = tenantFormSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const result = await createTenantOnboarding({ ...parsed.data, created_by: admin.appUser.id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminEmailTakenError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 409 },
      );
    }
    if (isPostgrestJwtDecodeError(error)) {
      return NextResponse.json({ error: SUPABASE_KEY_MISMATCH_USER_MESSAGE, code: "PGRST301" }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: "Tenant onboarding failed." }, { status: 500 });
  }
}
