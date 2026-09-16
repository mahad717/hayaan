"use client";

// Admin → Reconciliation (Task 49 §6, §7).
// Orders vs payments for the selected period: expected vs actual, difference,
// derived reconciliation status, and the admin actions (record payment,
// record refund, cancel order) that keep the books accurate.

import { useCallback, useEffect, useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/hooks/use-store";
import { DATE_PRESETS, computePreset, type DatePresetKey } from "@/lib/date-presets";

function formatPrice(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

interface ReconRow {
  orderId: string;
  customer: string;
  orderTotal: number;
  expectedPayment: number;
  actualPayment: number;
  difference: number;
  paymentMethod: string;
  paymentReference: string | null;
  paymentStatus: string;
  reconStatus: string;
  orderStatus: string;
  orderDate: string;
  refunded: number;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Matched":
      return "bg-brand/10 text-brand";
    case "Overpaid":
    case "Underpaid":
    case "Partially Matched":
      return "bg-[#f28c28]/10 text-[#b26312]";
    case "Refunded":
      return "bg-blue-100 text-blue-700";
    case "Failed":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground"; // Unmatched
  }
}

export function AdminReconciliation() {
  const { toast } = useStore();
  const [preset, setPreset] = useState<DatePresetKey>("month");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [payFor, setPayFor] = useState<ReconRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payMethod, setPayMethod] = useState("cod");
  const [refundFor, setRefundFor] = useState<ReconRow | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundRestock, setRefundRestock] = useState(true);
  const [busy, setBusy] = useState(false);

  const range = useCallback(() => computePreset(preset, fromStr, toStr), [preset, fromStr, toStr]);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = range();
    const res = await fetch(`/api/admin/accounting/reconciliation?from=${from.toISOString()}&to=${to.toISOString()}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (data.migrationRequired) {
      setMigrationHint(data.hint ?? "Accounting migration required.");
      setRows([]);
    } else {
      setMigrationHint(null);
      setRows(data.rows ?? []);
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const recordPayment = async () => {
    if (!payFor) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/accounting/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: payFor.orderId,
          amount: Number(payAmount),
          provider: "manual",
          method: payMethod,
          reference: payRef || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error ?? "Could not record the payment.", "error");
      else {
        toast("Payment recorded", "success");
        setPayFor(null);
        setPayAmount("");
        setPayRef("");
        load();
      }
    } catch {
      toast("Network error", "error");
    }
    setBusy(false);
  };

  const recordRefund = async () => {
    if (!refundFor) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/accounting/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          orderId: refundFor.orderId,
          amount: Number(refundAmount),
          restock: refundRestock,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error ?? "Could not record the refund.", "error");
      else {
        toast("Refund recorded", "success");
        setRefundFor(null);
        setRefundAmount("");
        load();
      }
    } catch {
      toast("Network error", "error");
    }
    setBusy(false);
  };

  const cancelOrder = async (row: ReconRow) => {
    if (!confirm(`Cancel order ${row.orderId.slice(0, 8)}… ? It will be excluded from revenue and its stock restocked.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/accounting/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: row.orderId, status: "cancelled", restock: true }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error ?? "Could not cancel the order.", "error");
      else {
        toast("Order cancelled", "success");
        load();
      }
    } catch {
      toast("Network error", "error");
    }
    setBusy(false);
  };

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.reconStatus === statusFilter);

  return (
    <div>
      {migrationHint && (
        <div className="mb-4 rounded-lg border border-[#f28c28]/40 bg-[#f28c28]/10 px-4 py-3 text-sm text-[#8a5215]">
          The accounting tables are not in this database yet. Run{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">src/lib/supabase/migrations/2026-09-11-accounting.sql</code>{" "}
          in the Supabase SQL editor, then reload.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
            <Scale className="h-4 w-4 text-brand" /> Reconciliation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare what customers were charged with what actually arrived, per order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as DatePresetKey)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} className="w-[150px]" />
              <Input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} className="w-[150px]" />
            </>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["Matched", "Partially Matched", "Overpaid", "Underpaid", "Unmatched", "Refunded", "Failed"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={load} variant="outline" size="sm">Apply</Button>
        </div>
      </div>

      <Card className="border-[#e6e2d4]">
        <CardHeader>
          <CardTitle className="text-base text-brand-dark">Orders vs payments ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading reconciliation…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No orders in this period / filter.</p>
          ) : (
            <div className="-mx-6 max-h-[560px] overflow-y-auto px-6">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Order</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4 text-right">Expected</th>
                    <th className="py-3 pr-4 text-right">Actual</th>
                    <th className="py-3 pr-4 text-right">Diff</th>
                    <th className="py-3 pr-4">Method</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.orderId} className="border-t hover:bg-muted/30">
                      <td className="py-3 pr-4">
                        <p className="font-mono text-xs">{r.orderId.slice(0, 8)}…</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.orderDate).toLocaleString()}</p>
                      </td>
                      <td className="py-3 pr-4">{r.customer}</td>
                      <td className="py-3 pr-4 text-right">{formatPrice(r.expectedPayment)}</td>
                      <td className="py-3 pr-4 text-right">{formatPrice(r.actualPayment)}</td>
                      <td className={`py-3 pr-4 text-right font-medium ${r.difference < 0 ? "text-destructive" : r.difference > 0 ? "text-[#f28c28]" : "text-brand"}`}>
                        {r.difference === 0 ? "$0.00" : `${r.difference > 0 ? "+" : "−"}${formatPrice(Math.abs(r.difference))}`}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="capitalize">{r.paymentMethod}</p>
                        {r.paymentReference && <p className="max-w-[140px] truncate font-mono text-xs text-muted-foreground">{r.paymentReference}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className={statusBadgeClass(r.reconStatus)}>{r.reconStatus}</Badge>
                        {r.refunded > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">refunded {formatPrice(r.refunded)}</p>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setPayFor(r); setPayAmount(String(r.expectedPayment)); }}>
                            Payment
                          </Button>
                          {r.orderStatus !== "cancelled" && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setRefundFor(r); setRefundAmount(String(r.actualPayment - r.refunded)); }}>
                              Refund
                            </Button>
                          )}
                          {r.orderStatus !== "cancelled" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={() => cancelOrder(r)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record payment */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Log money actually received for order {payFor?.orderId.slice(0, 8)}… (cash, transfer, or any provider). Duplicate references are rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Amount received ($)</Label>
              <Input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">Cash on delivery</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                    <SelectItem value="evc">EVC Plus</SelectItem>
                    <SelectItem value="edahab">eDahab</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Reference / transaction ID</Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button className="btn-accent" disabled={busy || !Number(payAmount)} onClick={recordPayment}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record refund */}
      <Dialog open={!!refundFor} onOpenChange={(o) => !o && setRefundFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record refund</DialogTitle>
            <DialogDescription>
              Money returned to the customer for order {refundFor?.orderId.slice(0, 8)}…. Revenue and reconciliation totals update immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Refund amount ($)</Label>
              <Input type="number" min="0" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={refundRestock}
                onChange={(e) => setRefundRestock(e.target.checked)}
                className="h-4 w-4 accent-[#2e7d43]"
              />
              Return the items to stock
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundFor(null)}>Cancel</Button>
            <Button className="btn-accent" disabled={busy || !Number(refundAmount)} onClick={recordRefund}>Record refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
