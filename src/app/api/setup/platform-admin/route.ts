import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { validateOptionalPlatformSetupSecret } from "@/lib/setup/platformSetupAuth";
import { z } from "zod";

const setupSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1),
  setup_secret: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServiceClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "platform_admin");

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Platform admin already exists." }, { status: 409 });
  }

  const parsed = setupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  if (
    !validateOptionalPlatformSetupSecret({
      headerValue: request.headers.get("x-platform-setup-secret"),
      bodyValue: parsed.data.setup_secret,
      configuredSecret: env.PLATFORM_SETUP_SECRET,
    })
  ) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const temporaryPassword = crypto.randomBytes(12).toString("base64url");
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      display_name: parsed.data.display_name,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: appUser, error: userError } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUser.user.id,
      email: parsed.data.email,
      display_name: parsed.data.display_name,
      role: "platform_admin",
    })
    .select("id, email, display_name, role")
    .single();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  return NextResponse.json({
    appUser,
    temporaryPassword,
  });
}
