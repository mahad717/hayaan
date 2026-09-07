// POST /api/payments/sifalo/verify
// Body: { orderId: string, sid?: string }
//
// Asks Sifalo Pay whether the transaction for this order really completed and
// persists the outcome. Used by:
//   • the "Check payment again" button on /payment/sifalo (pending/unknown)
//   • the "Payment pending" chip on a Sifalo order in the Orders view
//     (covers the case where the customer paid but never came back).

import { NextRequest, NextResponse } from "next/server";

import { requireUser, verifyAndApplyToOrder } from "@/lib/sifalo-server";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body: { orderId?: string; sid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const applied = await verifyAndApplyToOrder(user.id, body.orderId, body.sid ?? null);
  if ("error" in applied) {
    return NextResponse.json({ error: applied.error }, { status: applied.status });
  }

  return NextResponse.json({
    state: applied.result.state,
    message: applied.result.message,
    paymentType: applied.result.paymentType ?? null,
    order: applied.order
      ? {
          id: applied.order.id,
          status: applied.order.status,
          paymentStatus: applied.order.paymentStatus,
          paymentRef: applied.order.paymentRef,
        }
      : null,
  });
}
