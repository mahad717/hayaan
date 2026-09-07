// Sifalo Pay endpoints.
//
//  GET  /api/payments/sifalo          → { enabled, environment, returnUrlBase }
//      Public capability probe used by the checkout UI to decide whether the
//      "Sifalo Pay" option is offered. Returns no secrets.
//
//  POST /api/payments/sifalo          → { redirectUrl, orderId, total }
//      Body: { shipping: { name, phone?, address, city, zip, country } }
//      Creates a PENDING order from the server-side cart (total is computed
//      here, never trusted from the client), then asks Sifalo Pay for a
//      hosted-checkout session. The browser redirects to `redirectUrl`
//      (pay.sifalo.com/checkout/…) where the customer completes the payment.

import { NextRequest, NextResponse } from "next/server";

import {
  getSifaloConfig,
  initiateSifaloCheckout,
  isSifaloConfigured,
} from "@/lib/sifalo";
import { createPendingSifaloOrder, requireUser, type ShippingInput } from "@/lib/sifalo-server";

export async function GET() {
  const cfg = getSifaloConfig();
  return NextResponse.json({
    enabled: isSifaloConfigured(),
    environment: cfg.environment,
    returnUrlBase: cfg.returnUrlBase || null,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in to check out." }, { status: 401 });

  if (!isSifaloConfigured()) {
    return NextResponse.json(
      { error: "Sifalo Pay is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: { shipping?: ShippingInput };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const shipping = body.shipping;
  if (!shipping?.name || !shipping?.address || !shipping?.city || !shipping?.zip || !shipping?.country) {
    return NextResponse.json({ error: "Please complete your shipping details so we know where to deliver." }, { status: 400 });
  }

  const created = await createPendingSifaloOrder(user.id, shipping);
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  const payment = await initiateSifaloCheckout(created.total, created.orderId);
  if (!payment.ok || !payment.redirectUrl) {
    // The pending order remains — verify.php can still match it later via
    // order_id if the charge somehow went through despite this error.
    return NextResponse.json(
      { error: payment.error ?? "Could not start the Sifalo Pay checkout." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    redirectUrl: payment.redirectUrl,
    orderId: created.orderId,
    total: created.total,
  });
}
