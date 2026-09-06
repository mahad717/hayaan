"use client";

import { useEffect, useState } from "react";
import { Package, ChevronLeft, RefreshCw, Clock3, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useStore, fetchOrders } from "@/hooks/use-store";
import type { Order, OrderStatus } from "@/lib/types";

function formatPrice(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

// Status badges stay within the Hayaan family — sage green for paid/delivered,
// soft amber for pending, deep indigo for shipped, red for cancelled.
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-[#fef1de] text-[#c87b1f]",
  paid: "bg-[#eef5ec] text-brand",
  shipped: "bg-[#e8eff5] text-[#24527a]",
  delivered: "bg-[#3f7d4a]/15 text-[#3f7d4a]",
  cancelled: "bg-destructive/10 text-destructive",
};

export function OrdersView() {
  const { user, setView, setAuthOpen } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  // Sifalo Pay orders can sit in "pending" if the customer paid but closed the
  // tab before the return page loaded — this re-checks the gateway live.
  const checkSifaloPayment = async (orderId: string) => {
    setCheckingId(orderId);
    setVerifyNote(null);
    try {
      const res = await fetch("/api/payments/sifalo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data.state === "paid") {
        const fresh = await fetchOrders();
        setOrders(fresh);
        setVerifyNote("Payment confirmed — thank you!");
      } else if (res.ok && data.state === "pending") {
        setVerifyNote("Still pending approval by the payment network.");
      } else if (res.ok && data.state === "failed") {
        setVerifyNote("The payment failed or was declined.");
      } else {
        setVerifyNote(data?.error ?? "Could not check with Sifalo Pay right now.");
      }
    } catch {
      setVerifyNote("Network error — please try again.");
    } finally {
      setCheckingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const data = await fetchOrders();
      if (cancelled) return;
      setOrders(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Package className="mx-auto h-12 w-12 text-brand" />
        <h1 className="mt-4 text-2xl font-semibold text-brand-dark">Sign in to see your orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your order history lives in your account.</p>
        <Button className="mt-4 bg-brand hover:bg-brand-dark" onClick={() => setAuthOpen(true)}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 text-brand hover:bg-secondary" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Button>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">Your orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Loading…" : `${orders.length} order${orders.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>
      {verifyNote && (
        <p className="mb-4 rounded-md border border-[#e6e2d4] bg-[#faf8f1] px-3 py-2 text-xs text-brand-dark">{verifyNote}</p>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="h-32 animate-pulse bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed border-[#e6e2d4]">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-10 w-10 text-brand" />
            <p className="text-sm text-muted-foreground">You haven’t placed any orders yet.</p>
            <Button className="bg-brand hover:bg-brand-dark" onClick={() => setView("home")}>Start shopping</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <Card key={o.id} className="border-[#e6e2d4]">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base text-brand-dark">Order {o.id.slice(0, 8).toUpperCase()}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <Badge className={STATUS_COLOR[o.status as OrderStatus]}>
                  {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2">
                  {o.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 text-sm">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        {it.image && <img src={it.image} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium leading-tight">{it.name}</p>
                        <p className="text-xs text-muted-foreground">Qty {it.quantity}</p>
                      </div>
                      <span className="text-sm">{formatPrice(it.price * it.quantity, o.currency)}</span>
                    </li>
                  ))}
                </ul>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Shipping to</p>
                    <p>{o.shippingName}</p>
                    {o.shippingPhone && <p>{o.shippingPhone}</p>}
                    <p>{o.shippingAddress}</p>
                    <p>
                      {o.shippingCity}, {o.shippingZip}
                    </p>
                    <p>{o.shippingCountry}</p>
                  </div>
                  <div className="flex flex-col justify-between">
                    <div>
                      <p className="font-medium text-foreground">Payment</p>
                      <p className="capitalize">{o.paymentMethod}</p>
                      {o.paymentMethod === "sifalo" && o.paymentStatus && o.paymentStatus !== "paid" && o.status !== "paid" && (
                        <div className="mt-1.5 flex flex-col items-start gap-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            o.paymentStatus === "failed"
                              ? "bg-red-50 text-red-600"
                              : "bg-[#fef1de] text-[#c87b1f]"
                          }`}>
                            {o.paymentStatus === "failed" ? <XCircle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                            Payment {o.paymentStatus}
                          </span>
                          <button
                            type="button"
                            onClick={() => checkSifaloPayment(o.id)}
                            disabled={checkingId === o.id}
                            className="flex items-center gap-1 text-[11px] font-medium text-brand hover:underline disabled:opacity-60"
                          >
                            <RefreshCw className={`h-3 w-3 ${checkingId === o.id ? "animate-spin" : ""}`} />
                            {checkingId === o.id ? "Checking…" : "Check payment status"}
                          </button>
                        </div>
                      )}
                      {o.paymentRef && <p className="font-mono text-[10px]">{o.paymentRef}</p>}
                    </div>
                    <div className="mt-2 flex justify-between border-t border-[#e6e2d4] pt-2 text-sm">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="font-semibold text-brand">{formatPrice(o.totalAmount, o.currency)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
