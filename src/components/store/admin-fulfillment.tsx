"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, PackageCheck, RefreshCw, Truck } from "lucide-react";

import { useStore } from "@/hooks/use-store";

type FulfillmentItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  supplierUrl: string | null;
  supplierSku: string | null;
  cost: number | null;
};

type FulfillmentOrder = {
  id: string;
  status: string;
  paymentStatus: string | null;
  createdAt: string;
  total: number;
  currency: string;
  customer: {
    name: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    zip: string | null;
    country: string | null;
  };
  items: FulfillmentItem[];
};

const USD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Dropshipping fulfillment (Task 65): paid orders whose items carry supplier
 * sourcing (URL / SKU from the Alibaba / AliExpress import). Work each order:
 * open the supplier listing, place the order with the customer's shipping
 * details (one-click copy), then mark the order shipped.
 */
export function AdminFulfillment() {
  const { toast } = useStore();
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fulfillment", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't load the fulfillment list.");
        return;
      }
      setOrders(data.orders ?? []);
    } catch {
      setError("Network error while loading the fulfillment list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Text block for placing the supplier order: items (with supplier SKU) +
  // the customer's shipping details — exactly what an AliExpress /
  // Alibaba checkout form asks for.
  const supplierText = (o: FulfillmentOrder) => {
    const c = o.customer;
    const lines = [
      `Ship to: ${c.name ?? "—"}`,
      `Phone: ${c.phone ?? "—"}`,
      `Address: ${c.address ?? "—"}, ${c.city ?? "—"} ${c.zip ?? ""}, ${c.country ?? "—"}`.replace(/\s+/g, " "),
      "",
      "Items:",
      ...o.items.map(
        (it) =>
          `- ${it.quantity} x ${it.name}${it.supplierSku ? ` (SKU: ${it.supplierSku})` : ""}${
            it.supplierUrl ? `\n  Supplier listing: ${it.supplierUrl}` : ""
          }`,
      ),
    ];
    return lines.join("\n");
  };

  const copyOrder = async (o: FulfillmentOrder) => {
    try {
      await navigator.clipboard.writeText(supplierText(o));
      setCopiedId(o.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast("Supplier order details copied.", "success");
    } catch {
      toast("Couldn't access the clipboard.", "error");
    }
  };

  const markShipped = async (o: FulfillmentOrder) => {
    if (!window.confirm(`Mark order ${o.id.slice(0, 8)} as shipped?`)) return;
    setMovingId(o.id);
    try {
      const res = await fetch("/api/admin/accounting/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: o.id, status: "shipped" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? "Couldn't update the order.", "error");
        return;
      }
      toast("Order marked as shipped.", "success");
      load();
    } catch {
      toast("Network error while updating the order.", "error");
    } finally {
      setMovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading orders…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#f2d3a4] bg-[#fef1de] p-6 text-sm text-[#7a4a14]">
        {error}
      </div>
    );
  }

  const toOrder = orders.filter((o) => o.status === "paid");
  const inTransit = orders.filter((o) => o.status === "shipped");

  const OrderCard = ({ o }: { o: FulfillmentOrder }) => {
    const margin = o.items.reduce((sum, it) => sum + (it.cost != null ? (it.price - it.cost) * it.quantity : 0), 0);
    const marginKnown = o.items.some((it) => it.cost != null);
    return (
      <div key={o.id} className="rounded-xl border border-[#e6e2d4] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0ede2] px-4 py-3">
          <div>
            <p className="text-sm font-semibold">
              #{o.id.slice(0, 8)} · {fmtDate(o.createdAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {o.customer.name ?? "—"} · {o.customer.phone ?? "no phone"} · collected {USD(o.total)}
              {marginKnown && (
                <span className="ml-1 text-[#3f7d4a]">· est. margin {USD(margin)}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyOrder(o)}
              className="flex items-center gap-1.5 rounded-md border border-[#e6e2d4] bg-white px-3 py-1 text-xs font-medium hover:bg-secondary"
              title="Copy shipping details + items for the supplier checkout form"
            >
              {copiedId === o.id ? <Check className="h-3.5 w-3.5 text-[#3f7d4a]" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedId === o.id ? "Copied" : "Copy supplier order"}
            </button>
            {o.status === "paid" ? (
              <button
                onClick={() => markShipped(o)}
                disabled={movingId === o.id}
                className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {movingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                Mark shipped
              </button>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <PackageCheck className="h-3.5 w-3.5" /> shipped
              </span>
            )}
          </div>
        </div>
        <div className="px-4 py-3">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-4 font-medium">Item</th>
                <th className="py-1.5 pr-4 text-right font-medium">Qty</th>
                <th className="py-1.5 pr-4 text-right font-medium">Sold at</th>
                <th className="py-1.5 pr-4 text-right font-medium">Cost</th>
                <th className="py-1.5 font-medium">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((it) => (
                <tr key={it.id} className="border-t border-[#f0ede2]">
                  <td className="py-2 pr-4 font-medium">{it.name}</td>
                  <td className="py-2 pr-4 text-right">{it.quantity}</td>
                  <td className="py-2 pr-4 text-right">{USD(it.price)}</td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">{it.cost != null ? USD(it.cost) : "—"}</td>
                  <td className="py-2">
                    {it.supplierUrl ? (
                      <a
                        href={it.supplierUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                      >
                        Open listing {it.supplierSku ? `· ${it.supplierSku}` : ""} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No supplier URL — add it in the product editor
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Ship to: {o.customer.address ?? "—"}, {o.customer.city ?? "—"} {o.customer.zip ?? ""},{" "}
            {o.customer.country ?? "—"}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {toOrder.length} to order · {inTransit.length} in transit — paid orders with supplier
            sourcing. Open the listing, place the supplier order with the copied details, then mark
            the order shipped.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-md border border-[#e6e2d4] bg-white px-3 py-1 text-xs font-medium hover:bg-secondary"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e6e2d4] bg-white p-10 text-center text-sm text-muted-foreground">
          No paid orders right now. Paid orders appear here automatically — items imported from
          Alibaba / AliExpress carry their supplier listing link.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {toOrder.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                To order from supplier
              </p>
              {toOrder.map((o) => <OrderCard key={o.id} o={o} />)}
            </>
          )}
          {inTransit.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                In transit
              </p>
              {inTransit.map((o) => <OrderCard key={o.id} o={o} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
