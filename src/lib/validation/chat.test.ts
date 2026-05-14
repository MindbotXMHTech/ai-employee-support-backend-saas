import { describe, expect, it } from "vitest";
import { chatV2RequestSchema } from "@/lib/validation/chat";

describe("chat validation", () => {
  it("accepts the simplified v2 chat payload", () => {
    const parsed = chatV2RequestSchema.safeParse({
      user_id: "line-user-001",
      message: "อยากได้กำลังใจ",
      company_code: "ABC503",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects v2 chat payloads missing required fields", () => {
    const parsed = chatV2RequestSchema.safeParse({
      user_id: "line-user-001",
      company_code: "ABC503",
    });

    expect(parsed.success).toBe(false);
  });
});
