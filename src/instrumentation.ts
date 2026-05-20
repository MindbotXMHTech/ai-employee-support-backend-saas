/**
 * Production startup checks. Runs when the Node server boots (not during static build analysis).
 */
export async function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  try {
    const { requireEnv } = await import("@/lib/env");
    requireEnv("API_KEY_SECRET");
  } catch (error) {
    console.error("[instrumentation] Production startup check failed:", error);
    process.exit(1);
  }
}
