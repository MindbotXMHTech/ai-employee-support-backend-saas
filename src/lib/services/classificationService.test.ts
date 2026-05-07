import { describe, expect, it } from "vitest";
import { classifyMessageRuleBased } from "@/lib/services/classificationService";
import { classifySafetyLevelRuleBased } from "@/lib/services/safetyService";

describe("classification and safety", () => {
  it("routes HR policy questions to RAG", () => {
    expect(classifyMessageRuleBased("ลาป่วยได้กี่วัน")).toBe("welfare_rag");
  });

  it("detects mental health support messages", () => {
    expect(classifyMessageRuleBased("ช่วงนี้เครียดกับงานมาก")).toBe("mental_health_support");
  });

  it("detects crisis safety level before any LLM call", () => {
    expect(classifySafetyLevelRuleBased("ฉันอยากฆ่าตัวตาย")).toBe("crisis");
  });
});
