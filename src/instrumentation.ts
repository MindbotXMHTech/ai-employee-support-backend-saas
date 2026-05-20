/**
 * Production startup checks. Runs when the Node server boots (not during static build analysis).
 */
export async function register() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const { requireEnv } = await import("@/lib/env");
  requireEnv("API_KEY_SECRET");
}
