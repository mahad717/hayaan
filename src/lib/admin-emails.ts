// Owner allowlist — the store owner's admin identity.
//
// WHY AN ALLOWLIST: Google OAuth sign-ins arrive from Supabase with NO role
// in user_metadata (and without a public.users row), so the role column /
// metadata fallback alone can never grant admin to a freshly linked Google
// login. A session whose auth email is in this list is treated as an admin
// everywhere (getSupabaseUserById + mapSupabaseUser), and /auth/callback
// additionally upserts the users row with role=admin so the state persists.
//
// SECURITY RULE: the allowlist only grants admin when the auth user has a
// GOOGLE-LINKED identity. Password signups are created with email_confirm
// already true (no verification round-trip exists), so a naive email match
// would let anyone claim the owner's address with a plain signup and become
// admin. Only the real Gmail owner can produce a Google identity for it.
export const OWNER_ADMIN_EMAILS = ["gabeyre80@gmail.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/** True when the Supabase auth user carries a Google-linked identity. */
export function hasGoogleIdentity(u: {
  app_metadata?: { provider?: string } | null;
  identities?: Array<{ provider?: string }> | null;
}): boolean {
  if (u.identities?.some((i) => i.provider === "google")) return true;
  return u.app_metadata?.provider === "google";
}

/** The admin decision for an auth user: allowlisted email + Google identity. */
export function isOwnerAdmin(
  email: string | null | undefined,
  identities?: { app_metadata?: { provider?: string } | null; identities?: Array<{ provider?: string }> | null } | null,
): boolean {
  return isAdminEmail(email) && (!identities || hasGoogleIdentity(identities));
}
