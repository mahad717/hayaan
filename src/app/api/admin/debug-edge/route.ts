// Admin diagnostics for the Task 106 edge tier (Cloudflare Cache API layer
// under the catalog SWR cache). Reports whether caches.default is reachable
// on the running Worker, whether the catalog key is currently in the colo
// cache, and runs a put->match round trip on a throwaway key.
//
// GET /api/admin/debug-edge  (admin session required; read-only diagnostics)

import { NextRequest, NextResponse } from "next/server";
import { edgeDiagnostics, prewarmCatalog } from "@/lib/products-server";
import { requireAdminUser } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const diag = await edgeDiagnostics();
  return NextResponse.json(diag, { headers: { "cache-control": "no-store" } });
}

/** POST = populate the edge tier for the catalog key (same as a PDP view's
 *  pre-warm) — lets the owner/diagnostics warm a colo deliberately. */
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  prewarmCatalog();
  return NextResponse.json({ ok: true, note: "catalog pre-warm started (memory + edge)" }, { headers: { "cache-control": "no-store" } });
}
