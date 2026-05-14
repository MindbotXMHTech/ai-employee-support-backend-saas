import { describe, expect, it } from "vitest";
import { validateOptionalPlatformSetupSecret } from "./platformSetupAuth";

describe("validateOptionalPlatformSetupSecret", () => {
  it("allows any caller when configured secret is missing or empty", () => {
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: null,
        bodyValue: undefined,
        configuredSecret: undefined,
      }),
    ).toBe(true);
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: "wrong",
        bodyValue: "also-wrong",
        configuredSecret: "   ",
      }),
    ).toBe(true);
  });

  it("requires exact match when secret is configured (header)", () => {
    const secret = "bootstrap-token-32chars-minimum!!";
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: secret,
        bodyValue: undefined,
        configuredSecret: secret,
      }),
    ).toBe(true);
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: "bootstrap-token-32chars-wrong!!!!",
        bodyValue: undefined,
        configuredSecret: secret,
      }),
    ).toBe(false);
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: "",
        bodyValue: undefined,
        configuredSecret: secret,
      }),
    ).toBe(false);
  });

  it("allows body field when header is absent", () => {
    const secret = "bootstrap-token-32chars-second!!!!";
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: null,
        bodyValue: secret,
        configuredSecret: secret,
      }),
    ).toBe(true);
  });

  it("prefers header when both are present (still must match configured)", () => {
    const secret = "bootstrap-token-32chars-third!!!!!";
    expect(
      validateOptionalPlatformSetupSecret({
        headerValue: secret,
        bodyValue: "wrong-body-value-wrong-length!!",
        configuredSecret: secret,
      }),
    ).toBe(true);
  });
});
