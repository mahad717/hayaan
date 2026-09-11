"use client";

// Admin → Profitability report (Task 49 §10).
// Per-product units / revenue / COGS / gross profit / margin with sorting
// and totals. Missing cost snapshots are flagged instead of guessed.

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_PRESETS, computePreset, type DatePresetKey } from "@/lib/date-presets";

function formatPrice(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

interface ProfitRow {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number | null;
  missingCost: boolean;
}

interface Totals {
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
}

const SORTS: { key: string; label: string }[] = [
  { key: "revenue-desc", label: "Highest revenue" },
  { key: "profit-desc", label: "Highest profit" },
  { key: "profit-asc", label: "Lowest profit" },
  { key: "margin-desc", label: "Highest margin" },
  { key: "margin-asc", label: "Lowest margin" },
  { key: "units-desc", label: "Units sold" },
];

export function AdminProfit() {
  const [preset, setPreset] = useState<DatePresetKey>("month");
  const [fromStr, setFromStr] = useState("");
  const [toStr, setToStr] = useState("");
  const [sort, setSort] = useState("revenue-desc");
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);

  const range = useCallback(() => computePreset(preset, fromStr, toStr), [preset, fromStr, toStr]);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = range();
    const res = await fetch(`/api/admin/accounting/profit?from=${from.toISOString()}&to=${to.toISOString()}&sort=${sort}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (data.migrationRequired) {
      setMigrationHint(data.hint ?? "Accounting migration required.");
      setRows([]);
      setTotals(null);
    } else {
      setMigrationHint(null);
      setRows(data.rows ?? []);
      setTotals(data.totals ?? null);
    }
    setLoading(false);
  }, [range, sort]);

  useEffect(() => {
    load();
  }, [load]);

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
            <TrendingUp className="h-4 w-4 text-brand" /> Profitability
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Which products actually make money — revenue, cost at sale, and margin per product.
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
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={load} variant="outline" size="sm">Apply</Button>
        </div>
      </div>

      <Card className="border-[#e6e2d4]">
        <CardHeader>
          <CardTitle className="text-base text-brand-dark">Products ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Crunching numbers…
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No paid sales in this period yet.</p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Product</th>
                    <th className="py-3 pr-4 text-right">Units sold</th>
                    <th className="py-3 pr-4 text-right">Revenue</th>
                    <th className="py-3 pr-4 text-right">COGS</th>
                    <th className="py-3 pr-4 text-right">Gross profit</th>
                    <th className="py-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.productId} className="border-t hover:bg-muted/30">
                      <td className="py-3 pr-4">
                        <p className="font-medium leading-tight">{r.productName}</p>
                        {r.missingCost && (
                          <Badge variant="outline" className="mt-1 bg-[#f28c28]/10 text-[#b26312]">
                            cost missing — profit partial
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">{r.unitsSold}</td>
                      <td className="py-3 pr-4 text-right">{formatPrice(r.revenue)}</td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">{formatPrice(r.cogs)}</td>
                      <td className={`py-3 pr-4 text-right font-medium ${r.grossProfit >= 0 ? "text-brand" : "text-destructive"}`}>
                        {formatPrice(r.grossProfit)}
                      </td>
                      <td className="py-3 text-right">{r.margin != null ? `${r.margin.toFixed(2)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 border-[#e6e2d4] font-medium">
                      <td className="py-3 pr-4">Totals</td>
                      <td className="py-3 pr-4 text-right">{totals.unitsSold}</td>
                      <td className="py-3 pr-4 text-right">{formatPrice(totals.revenue)}</td>
                      <td className="py-3 pr-4 text-right">{formatPrice(totals.cogs)}</td>
                      <td className="py-3 pr-4 text-right text-brand">{formatPrice(totals.grossProfit)}</td>
                      <td className="py-3 text-right">{totals.grossMargin.toFixed(2)}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
