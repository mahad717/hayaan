"use client";

// Admin → Accounting (Task 49 §4, §5, §9, §11).
// Financial overview cards for the selected period + purchase recording +
// the internal transaction ledger. Uses the existing admin design language
// (same cards/tables/badges as the catalog view).

import { useCallback, useEffect, useState } from "react";
import { Calculator, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/hooks/use-store";
import { DATE_PRESETS, computePreset, type DatePresetKey } from "@/lib/date-presets";
import type { AdminProduct } from "@/components/store/admin-panel";

function formatPrice(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

interface Overview {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  discounts: number;
  refunds: number;
  shippingRevenue: number;
  taxCollected: number;
  netRevenue: number;
  ordersCount: number;
  missingCostItems: number;
  cancelledCount: number;
}

interface LedgerRow {
  id: string;
  entryType: string;
  account: string;
  amount: number;
  description: string | null;
  actor: string | null;
  createdAt: string;
}

interface PurchaseRow {
  id: string;
  supplier: string;
  productId: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: string;
  reference: string | null;
  paymentStatus: string;
  stockApplied: boolean;
}

const EMPTY_FORM = {
  supplier: "",
  productId: "",
  quantity: "1",
  unitCost: "",
  purchaseDate: "",
  reference: "",
  paymentStatus: "paid",
  applyStock: true,
};

export function AdminAccounting() {
  const { products, toast } = useStore();
  const [preset, setPreset] = useState<DatePresetKey>("month");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerType, setLedgerType] = useState("all");
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const range = useCallback(
    () => computePreset(preset, fromStr, toStr),
    [preset, fromStr, toStr],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = range();
    const qs = `from=${from.toISOString()}&to=${to.toISOString()}`;
    const [oRes, lRes, pRes] = await Promise.all([
      fetch(`/api/admin/accounting/overview?${qs}`, { credentials: "include" }),
      fetch(`/api/admin/accounting/ledger?${qs}&type=${ledgerType}`, { credentials: "include" }),
      fetch(`/api/admin/accounting/purchases`, { credentials: "include" }),
    ]);
    const o = await oRes.json().catch(() => ({}));
    const l = await lRes.json().catch(() => ({}));
    const p = await pRes.json().catch(() => ({}));
    if (o.migrationRequired || l.migrationRequired || p.migrationRequired) {
      setMigrationHint(o.hint ?? "Accounting migration required.");
      setOverview(null);
    } else {
      setMigrationHint(null);
      setOverview(o.overview ?? null);
      setLedger(l.entries ?? []);
      setPurchases(p.purchases ?? []);
    }
    setLoading(false);
  }, [range, ledgerType]);

  useEffect(() => {
    load();
  }, [load]);

  const savePurchase = async () => {
    setSaving(true);
    const body = {
      supplier: form.supplier,
      productId: form.productId || null,
      quantity: Number(form.quantity),
      unitCost: Number(form.unitCost),
      purchaseDate: form.purchaseDate || undefined,
      reference: form.reference || undefined,
      paymentStatus: form.paymentStatus,
      applyStock: form.applyStock,
    };
    try {
      const res = await fetch("/api/admin/accounting/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not record the purchase.", "error");
      } else {
        toast("Purchase recorded", "success");
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        load();
      }
    } catch {
      toast("Network error", "error");
    }
    setSaving(false);
  };

  const cards: { label: string; value: string; color: string }[] = overview
    ? [
        { label: "Total revenue", value: formatPrice(overview.revenue), color: "text-brand" },
        { label: "Total COGS", value: formatPrice(overview.cogs), color: "text-foreground" },
        { label: "Gross profit", value: formatPrice(overview.grossProfit), color: overview.grossProfit >= 0 ? "text-brand" : "text-destructive" },
        { label: "Gross margin", value: `${overview.grossMargin.toFixed(2)}%`, color: "text-[#3f7d4a]" },
        { label: "Discounts", value: formatPrice(overview.discounts), color: "text-[#f28c28]" },
        { label: "Refunds", value: formatPrice(overview.refunds), color: "text-destructive" },
        { label: "Net revenue", value: formatPrice(overview.netRevenue), color: "text-brand-dark" },
        { label: "Orders", value: String(overview.ordersCount), color: "text-foreground" },
      ]
    : [];

  return (
    <div>
      {migrationHint && (
        <div className="mb-4 rounded-lg border border-[#f28c28]/40 bg-[#f28c28]/10 px-4 py-3 text-sm text-[#8a5215]">
          The accounting tables are not in this database yet. Run{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">src/lib/supabase/migrations/2026-09-11-accounting.sql</code>{" "}
          in the Supabase SQL editor, then reload — the storefront is unaffected either way.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
            <Calculator className="h-4 w-4 text-brand" /> Accounting
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue, COGS, gross profit, refunds, and the internal ledger for the selected period.
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
          <Button onClick={load} variant="outline" size="sm">Apply</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading financials…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map((s) => (
              <Card key={s.label} className="border-[#e6e2d4]">
                <CardContent className="py-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {overview && overview.missingCostItems > 0 && (
            <div className="mt-4 rounded-lg border border-[#f28c28]/40 bg-[#f28c28]/10 px-4 py-3 text-sm text-[#8a5215]">
              {overview.missingCostItems} sold item{overview.missingCostItems === 1 ? "" : "s"} {overview.missingCostItems === 1 ? "has" : "have"} no recorded cost (orders placed before costs were entered). Their revenue is counted; their COGS is reported as unavailable rather than guessed.
            </div>
          )}

          {/* Purchases / restocks */}
          <Card className="mt-6 border-[#e6e2d4]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
                  Purchases &amp; restocks ({purchases.length})
                </CardTitle>
                <Button size="sm" className="btn-accent" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Record purchase
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No purchases recorded yet. Record supplier restocks here to build the actual inventory cost trail.
                </p>
              ) : (
                <div className="-mx-6 max-h-[280px] overflow-y-auto px-6">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Supplier</th>
                        <th className="py-2 pr-4 text-right">Qty</th>
                        <th className="py-2 pr-4 text-right">Unit cost</th>
                        <th className="py-2 pr-4 text-right">Total</th>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-muted/30">
                          <td className="py-2 pr-4">
                            {p.supplier}
                            {p.reference && <span className="ml-1 text-xs text-muted-foreground">· {p.reference}</span>}
                          </td>
                          <td className="py-2 pr-4 text-right">{p.quantity}</td>
                          <td className="py-2 pr-4 text-right">{formatPrice(p.unitCost)}</td>
                          <td className="py-2 pr-4 text-right font-medium">{formatPrice(p.totalCost)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={p.paymentStatus === "paid" ? "secondary" : "outline"} className={p.paymentStatus === "paid" ? "bg-brand/10 text-brand" : ""}>
                              {p.paymentStatus}
                            </Badge>
                            {p.stockApplied && <span className="ml-1 text-xs text-muted-foreground">· stock +</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ledger */}
          <Card className="mt-6 border-[#e6e2d4]">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base text-brand-dark">Transaction ledger ({ledger.length})</CardTitle>
                <Select value={ledgerType} onValueChange={setLedgerType}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All events</SelectItem>
                    <SelectItem value="sale">Sales</SelectItem>
                    <SelectItem value="refund">Refunds</SelectItem>
                    <SelectItem value="purchase">Purchases</SelectItem>
                    <SelectItem value="cancel">Cancellations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {ledger.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No ledger entries in this period yet. Sales, refunds, purchases, and cancellations are recorded here automatically.
                </p>
              ) : (
                <div className="-mx-6 max-h-[420px] overflow-y-auto px-6">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Event</th>
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4 text-right">Amount</th>
                        <th className="py-2 pr-4">Description</th>
                        <th className="py-2 pr-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((e) => (
                        <tr key={e.id} className="border-t hover:bg-muted/30">
                          <td className="py-2 pr-4"><Badge variant="outline" className="capitalize">{e.entryType}</Badge></td>
                          <td className="py-2 pr-4 text-muted-foreground">{e.account}</td>
                          <td className={`py-2 pr-4 text-right font-medium ${e.amount < 0 ? "text-destructive" : "text-brand"}`}>
                            {e.amount < 0 ? "−" : "+"}{formatPrice(Math.abs(e.amount))}
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">{e.description ?? "—"}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Record purchase dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record purchase</DialogTitle>
            <DialogDescription>Log a supplier restock. Optionally add the quantity to product stock.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. Somaliland Wholesale Ltd" />
            </div>
            <div className="grid gap-1.5">
              <Label>Product</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a product…" /></SelectTrigger>
                <SelectContent>
                  {(products as AdminProduct[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Unit cost ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Purchase date</Label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="PO / receipt #" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Payment status</Label>
              <Select value={form.paymentStatus} onValueChange={(v) => setForm({ ...form, paymentStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid (payable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.applyStock}
                onChange={(e) => setForm({ ...form, applyStock: e.target.checked })}
                className="h-4 w-4 accent-[#2e7d43]"
              />
              Also add the quantity to product stock
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="btn-accent"
              disabled={saving || !form.supplier || !form.productId || !Number(form.quantity) || form.unitCost === ""}
              onClick={savePurchase}
            >
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Record purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
