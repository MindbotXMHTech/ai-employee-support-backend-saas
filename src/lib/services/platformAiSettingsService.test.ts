import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_AI_SETTINGS, normalizeAiSettings, RAG_RUNTIME_ENABLED } from "@/lib/services/platformAiSettingsService";

describe("platform AI settings", () => {
  it("keeps RAG disabled at runtime", () => {
    expect(RAG_RUNTIME_ENABLED).toBe(false);
    expect(DEFAULT_PLATFORM_AI_SETTINGS.rag_enabled).toBe(false);
  });

  it("normalizes persisted RAG settings to disabled while runtime flag is off", () => {
    const settings = normalizeAiSettings({ rag_enabled: true });

    expect(settings.rag_enabled).toBe(false);
  });

  it("normalizes default language to supported comma-separated values", () => {
    const settings = normalizeAiSettings({ default_language: "th,en,fr" });

    expect(settings.default_language).toBe("th,en");
  });
});
