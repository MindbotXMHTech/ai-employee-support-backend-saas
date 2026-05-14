import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTenant } from "@/test/fixtures";
import { createSupabaseMock } from "@/test/mockSupabase";

describe("aiService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("handles welfare questions without calling RAG retrieval while RAG runtime is disabled", async () => {
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const retrieveChunks = vi.fn();
    const logMessage = vi.fn(async () => "message-id");
    const logUsage = vi.fn(async () => undefined);
    const { client, tableCalls } = createSupabaseMock({
      tenant_profiles: { data: { company_name: "Acme Thailand" } },
      escalation_settings: { data: null },
      external_users: { data: { id: "external-user-db-id" } },
      conversations: [
        { data: null },
        { data: { id: "conversation-id" } },
      ],
    });

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceClient: () => client,
      hasSupabaseConfig: () => true,
    }));
    vi.doMock("@/lib/services/ragService", () => ({
      retrieveChunks,
      chunksToSources: vi.fn(),
      buildRagContext: vi.fn(),
    }));
    vi.doMock("@/lib/services/usageService", () => ({
      logMessage,
      logUsage,
    }));
    vi.doMock("@/lib/services/quotaService", () => ({
      checkQuota: vi.fn(async () => ({ ok: true })),
      getQuotaSnapshot: vi.fn(async () => ({ plan: "trial", used: 1, limit: 500, remaining: 499 })),
    }));
    vi.doMock("@/lib/services/tenantService", () => ({
      enforceTenantAvailability: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/lib/services/platformAiSettingsService", () => ({
      getTenantAiSettings: vi.fn(async () => ({
        name: "Central Employee Support Bot",
        default_language: "th",
        max_sentences: 5,
        tone: "warm, professional",
        general_model: "gpt-5-nano",
        rag_model: "gpt-5-mini",
        safety_model: "gpt-5-mini",
        embedding_model: "text-embedding-3-small",
        rag_enabled: false,
        mental_health_enabled: true,
        safety_enabled: true,
        handoff_enabled: true,
        classification_enabled: false,
        system_instruction: null,
      })),
    }));
    vi.doMock("@/lib/services/costService", () => ({
      estimateCost: vi.fn(async () => 0),
    }));

    const { handleChatRequest } = await import("./aiService");
    const response = await handleChatRequest({
      tenant: fakeTenant,
      external_user_id: "line-user-001",
      channel: "line",
      message: "ลาป่วยได้กี่วัน",
      conversation_id: "conversation-external-id",
    });

    process.env.OPENAI_API_KEY = originalOpenAiKey;

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.message_type).toBe("general");
      expect(response.sources).toEqual([]);
    }
    expect(retrieveChunks).not.toHaveBeenCalled();
    expect(tableCalls).not.toContain("document_chunks");
    expect(logUsage).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: fakeTenant.id,
      requestType: "general",
    }));
  });
});
