import type { ChatApiSuccessResponse, Tenant } from "@/lib/types";

export const fakeTenant: Tenant = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Acme Thailand",
  slug: "acme-thailand",
  plan: "trial",
  status: "active",
  trial_started_at: null,
  trial_ends_at: null,
  monthly_message_limit: 500,
  storage_limit_mb: 100,
  max_files: 10,
  max_bots: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

export const fakePlatformAdmin = {
  id: "22222222-2222-4222-8222-222222222222",
  role: "platform_admin",
  email: "platform@example.com",
  display_name: "Platform Admin",
};

export const fakeTenantAdmin = {
  id: "33333333-3333-4333-8333-333333333333",
  role: "tenant_admin",
  email: "tenant@example.com",
  display_name: "Tenant Admin",
};

export const fakeChatResponse: ChatApiSuccessResponse = {
  success: true,
  reply: "รับทราบครับ",
  message_type: "general",
  safety_level: "normal",
  conversation_id: "44444444-4444-4444-8444-444444444444",
  sources: [],
  handoff_required: false,
  handoff: { enabled: false, url: null, button_text: null, message: null },
  quota: { plan: "trial", used: 1, limit: 500, remaining: 499 },
};
