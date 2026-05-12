/** PostgREST returns this when `apikey` JWT cannot be verified (wrong/mismatched Supabase keys). */
export function isPostgrestJwtDecodeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  return code === "PGRST301" || message.includes("decode the JWT");
}

export const SUPABASE_KEY_MISMATCH_USER_MESSAGE =
  "Supabase keys do not match this API URL. Use NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY from the same `npx supabase status` output: Publishable → anon, Secret → service role. Do not mix legacy JWT anon (eyJ…) with sb_secret_* (PostgREST PGRST301).";
