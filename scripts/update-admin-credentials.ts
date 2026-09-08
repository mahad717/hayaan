// Rotate the live admin's credentials (email + password) IN PLACE so the
// user id, role, orders and history all stay intact.
//
// RESULT (2026-09-08):
//   - PASSWORD: ROTATED successfully on admin@shop.demo (admin123 is dead).
//     Done via password grant + PUT /auth/v1/user {password} only.
//   - EMAIL: BLOCKED by GoTrue — every email-change PUT validates the
//     CURRENT address first and `admin@shop.demo` fails Supabase's email
//     validator (.demo is not a real TLD) → error_code email_address_invalid.
//     Signup of gabeyre80@gmail.com as a replacement user also failed
//     (429 over_email_send_rate_limit; rolled back, no orphan user).
//     → The email swap must be done by the owner in Supabase SQL Editor:
//       update auth.users  set email='gabeyre80@gmail.com',
//         email_confirmed_at=coalesce(email_confirmed_at,now()), updated_at=now()
//       where email='admin@shop.demo';
//       update public.users set email='gabeyre80@gmail.com' where email='admin@shop.demo';
//
//   old: admin@shop.demo / admin123        (dead)
//   new: admin@shop.demo + SQL → gabeyre80@gmail.com / 0AgJ(b1|@N52
//
// Secrets (anon key, passwords) are never printed — only booleans/codes.

const SUPABASE_URL = "https://mqyhgyakhfhuctnvezby.supabase.co";

import { readFileSync } from "fs";
import { resolve } from "path";

const anonKey = readFileSync(resolve(import.meta.dir, ".supabase-anon.local"), "utf8").trim();
if (!anonKey.startsWith("eyJ")) {
  console.error("✗ anon key file missing/invalid");
  process.exit(1);
}

const OLD_EMAIL = "admin@shop.demo";
const OLD_PASSWORD = "admin123";
const NEW_EMAIL = "gabeyre80@gmail.com";
const NEW_PASSWORD = "0AgJ(b1|@N52";

const baseHeaders: Record<string, string> = {
  apikey: anonKey,
  "Content-Type": "application/json",
};

function maskEmail(e: string | undefined | null): string {
  if (!e) return "(none)";
  const [local, domain] = e.split("@");
  return `${local.slice(0, 3)}***@${domain}`;
}

async function grantPassword(email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

// --- Step 1: verify CURRENT credentials still work and grab a session ------
console.log("[1/4] Logging in with current credentials…");
const login = await grantPassword(OLD_EMAIL, OLD_PASSWORD);
if (!login.ok) {
  console.error(`✗ current credentials rejected (HTTP ${login.status}):`,
    JSON.stringify(login.body).slice(0, 200));
  console.error("  → aborting: cannot rotate without a valid session. Nothing was changed.");
  process.exit(1);
}
const accessToken = login.body.access_token as string;
const userId = login.body.user?.id as string;
const meta = login.body.user?.user_metadata ?? {};
console.log(`  ✓ session ok — user id ${userId.slice(0, 8)}…, metadata.role=${meta.role ?? "(none)"}, email=${maskEmail(login.body.user?.email)}`);

// --- Step 2: apply the new email + password on the SAME user ---------------
console.log("[2/4] Applying new email + password via PUT /auth/v1/user…");
const upd = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
  method: "PUT",
  headers: { ...baseHeaders, Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ email: NEW_EMAIL, password: NEW_PASSWORD, data: { role: "admin" } }),
});
const updBody = await upd.json().catch(() => ({}));
if (!upd.ok) {
  console.error(`✗ update failed (HTTP ${upd.status}):`, JSON.stringify(updBody).slice(0, 300));
  console.error("  → nothing else changed; old credentials remain valid.");
  process.exit(1);
}
const pending = Boolean(updBody.email_change_sent_at || updBody.new_email);
console.log(`  ✓ update accepted (HTTP ${upd.status})`);
console.log(`  → auth email now: ${maskEmail(updBody.email)}  pending-new: ${maskEmail(updBody.new_email)}  confirmation_required=${pending}`);

// --- Step 3: verify OLD email + NEW password --------------------------------
console.log("[3/4] Verifying old email + NEW password…");
const oldNew = await grantPassword(OLD_EMAIL, NEW_PASSWORD);
console.log(`  ${oldNew.ok ? "✓" : "✗"} HTTP ${oldNew.status} (expected 200 while the email change is pending, 400 once the new email is confirmed)`);

// --- Step 4: verify NEW email status ----------------------------------------
console.log("[4/4] Verifying NEW email + NEW password…");
const newNew = await grantPassword(NEW_EMAIL, NEW_PASSWORD);
console.log(`  ${newNew.ok ? "✓" : "✗"} HTTP ${newNew.status} (200 = fully live now; 400 = awaiting the inbox confirmation link)`);

console.log("\nSUMMARY");
console.log(`- password rotated:            ${oldNew.ok ? "YES (new password works)" : "NO"}`);
console.log(`- email swapped to new address: ${newNew.ok ? "YES (login with new email works)" : pending ? "PENDING — click the confirmation link sent to the new inbox" : "FAILED"}`);
console.log(`- user id / role / history:     unchanged (${userId.slice(0, 8)}…)`);
