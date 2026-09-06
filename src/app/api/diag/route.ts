// Read-only health/diagnosis endpoint — open /api/diag in the browser on a
// fresh deployment to see exactly why auth or the catalog is not working.
// Returns booleans and counts only; never exposes secrets or user data.

import { NextResponse } from "next/server";

import {
  isSupabaseServerEnabled,
  isSupabaseClientEnabled,
  createServiceClient,
} from "@/lib/supabase/server";
import { getSifaloConfig, isSifaloConfigured } from "@/lib/sifalo";
import { SEED_ADMIN } from "@/lib/seed-data";

export async function GET() {
  const env = {
    url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  // Payments config — booleans + non-secret values only (never the credentials).
  const sifaloCfg = getSifaloConfig();
  const sifalo = {
    configured: isSifaloConfigured(),
    usernameSet: Boolean(sifaloCfg.username),
    passwordSet: Boolean(sifaloCfg.password),
    environment: sifaloCfg.environment,
    returnUrlBase: sifaloCfg.returnUrlBase || null,
    hint:
      isSifaloConfigured() && sifaloCfg.returnUrlBase
        ? "Sifalo Pay checkout is active."
        : "Set SIFALO_USERNAME, SIFALO_PASSWORD and SIFALO_RETURN_URL_BASE (runtime variables) to accept payments.",
  };

  if (!isSupabaseClientEnabled && !isSupabaseServerEnabled) {
    return NextResponse.json({
      mode: "local-prisma",
      supabase: env,
      sifalo,
      hint: "No Supabase env vars are visible to the server. In Cloudflare set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Build + Runtime) and SUPABASE_SERVICE_ROLE_KEY (Runtime secret), then redeploy.",
    });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({
      mode: "supabase-partial",
      supabase: env,
      sifalo,
      hint: "SUPABASE_SERVICE_ROLE_KEY is missing at runtime, so login silently falls back to the local engine — which cannot run on Cloudflare Workers. Add it as a Runtime Secret in Cloudflare and redeploy.",
    });
  }

  const [{ count, error: prodErr }, { data: users, error: usersErr }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.auth.admin.listUsers(),
  ]);

  const adminExists = Boolean(users?.users?.some((u) => u.email === SEED_ADMIN.email));

  let hint: string;
  if (prodErr) {
    hint = "The products table is not readable. Run src/lib/supabase/schema.sql in the Supabase SQL editor, then click 'Seed now' on the site.";
  } else if (!adminExists) {
    hint = "Tables are reachable but the demo admin does not exist yet. Open the site and click 'Seed now' on the orange banner.";
  } else if ((count ?? 0) === 0) {
    hint = "The admin exists but the catalog is empty — click 'Seed now' to finish seeding.";
  } else {
    hint = "Everything looks ready. Sign in with the demo admin credentials from the auth dialog.";
  }

  return NextResponse.json({
    mode: "supabase",
    supabase: env,
    sifalo,
    catalog: { products: prodErr ? null : (count ?? 0), error: prodErr?.message ?? null },
    auth: { demoAdminExists: adminExists, adminEmail: SEED_ADMIN.email, error: usersErr?.message ?? null },
    hint,
  });
}
