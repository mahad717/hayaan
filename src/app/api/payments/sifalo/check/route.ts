// POST /api/payments/sifalo/check — admin-only credential diagnostic.
//
// Body: { username, password }
// Fires a minimal $1.00 hosted-checkout request against the Sifalo gateway
// using the PROVIDED credentials (not the stored ones) and reports the
// gateway's verdict. Used to answer "are my Sifalo API credentials valid?"
// without touching the Cloudflare variables. Credentials live in memory for
// the duration of the request only — never stored, never logged, never
// echoed back.
//
// A successful response means: paste these exact values into the Cloudflare
// runtime variables SIFALO_USERNAME / SIFALO_PASSWORD and real payments work.

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { testSifaloCredentials } from "@/lib/sifalo";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = (body.password ?? "").trim();
  if (!username || !password) {
    return NextResponse.json(
      { error: "Both username and password are required." },
      { status: 400 },
    );
  }

  const result = await testSifaloCredentials(username, password);
  return NextResponse.json(result);
}
