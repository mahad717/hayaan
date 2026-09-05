"use client";

import { useEffect, useState } from "react";
import { Package, ChevronLeft } from "lucide-react";
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

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-destructive/10 text-destructive",
};

export function OrdersView() {
  const { user, setView, setAuthOpen } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Sign in to see your orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your order history lives in your account.</p>
        <Button className="mt-4" onClick={() => setAuthOpen(true)}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Button>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Loading…" : `${orders.length} order${orders.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="h-32 animate-pulse bg-muted/30" />
            </Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You haven’t placed any orders yet.</p>
            <Button variant="secondary" onClick={() => setView("home")}>Start shopping</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Order {o.id.slice(0, 8).toUpperCase()}</CardTitle>
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
                      {o.paymentRef && <p className="font-mono text-[10px]">{o.paymentRef}</p>}
                    </div>
                    <div className="mt-2 flex justify-between border-t pt-2 text-sm">
                      <span className="font-medium text-foreground">Total</span>
                      <span className="font-semibold">{formatPrice(o.totalAmount, o.currency)}</span>
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
