import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { createTenantOnboarding } from "@/lib/services/tenantService";
import { tenantFormSchema } from "@/lib/validation/admin";

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) return admin.response;
  if (admin.appUser.role !== "platform_admin") {
    return NextResponse.json({ error: "Platform admin required." }, { status: 403 });
  }

  const parsed = tenantFormSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const result = await createTenantOnboarding({ ...parsed.data, created_by: admin.appUser.id });
  return NextResponse.json(result);
}
