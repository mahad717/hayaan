"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Package, ImagePlus, Loader2, Calculator, Scale, TrendingUp, Users, Truck, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useStore } from "@/hooks/use-store";
import { AdminBlog } from "@/components/store/admin-blog";
import { AdminAccounting } from "@/components/store/admin-accounting";
import { AdminReconciliation } from "@/components/store/admin-reconciliation";
import { AdminProfit } from "@/components/store/admin-profit";
import { AdminLeads } from "@/components/store/admin-leads";
import { AdminFulfillment } from "@/components/store/admin-fulfillment";
import type { Product, SafeUser } from "@/lib/types";

/** Product as served by the admin-only /api/admin/products (adds cost). */
export type AdminProduct = Product & { cost: number | null };

function formatPrice(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

/**
 * Field styling for the product form ONLY (scoped here so the rest of the
 * app is untouched): clearly visible brand-green border at rest, darker on
 * hover, solid brand border + soft brand halo on focus.
 */
const FIELD_CLS =
  "border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25";

/** Orange required marker, matching the Market Orange accent. */
const Req = () => (
  <span aria-hidden="true" className="text-[#f28c28]">
    *
  </span>
);

/** Muted "(optional)" suffix for non-required labels. */
const Opt = () => (
  <span className="text-xs font-normal text-muted-foreground"> (optional)</span>
);

/** Dollar sign pinned inside a price input. */
const DollarPrefix = () => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
  >
    $
  </span>
);

interface FormState {
  name: string;
  description: string;
  price: string;
  cost: string;
  compareAt: string;
  stock: string;
  categoryId: string;
  images: string;
  tags: string;
  featured: boolean;
  isActive: boolean;
  supplierUrl: string;
  supplierSku: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  price: "",
  cost: "",
  compareAt: "",
  stock: "",
  categoryId: "",
  images: "",
  tags: "",
  featured: false,
  isActive: true,
  supplierUrl: "",
  supplierSku: "",
};

/**
 * Admin dashboard content. Rendered by the /admin route after the server
 * has already verified the session — `user` comes from the server component.
 * The zustand fallback keeps the panel reusable in client-only contexts.
 */
export function AdminPanel({ user: serverUser }: { user?: SafeUser }) {
  const storeUser = useStore((s) => s.user);
  const user = serverUser ?? storeUser;
  const { categories, setProducts, setCategories, toast } = useStore();
  // Admin catalog comes from /api/admin/products (admin-only, adds the
  // confidential supplier cost). The shared zustand store NEVER receives the
  // cost-bearing objects — they are stripped before setProducts (defense in
  // depth on top of the public API never returning cost).
  const [products, setLocalProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"catalog" | "fulfillment" | "leads" | "accounting" | "reconciliation" | "profitability">("catalog");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [costWarning, setCostWarning] = useState<string | null>(null);
  // Supplier URL import (Task 65): paste an Alibaba / AliExpress listing,
  // server extracts a draft, the Create form opens prefilled.
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  // The images textarea holds one URL per line; the uploader appends to it,
  // so pasted URLs and uploaded files coexist in the same list.
  const previewUrls = form.images.split("\n").map((s) => s.trim()).filter(Boolean);

  const removeImage = (idx: number) => {
    setForm({ ...form, images: previewUrls.filter((_, i) => i !== idx).join("\n") });
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "include" });
        const data = await res.json().catch(() => ({} as { error?: string; url?: string }));
        if (!res.ok || !data.url) {
          toast(data.error ?? `Upload failed for ${file.name}`, "error");
        } else {
          added.push(data.url);
        }
      } catch {
        toast(`Upload failed for ${file.name}`, "error");
      }
    }
    if (added.length > 0) {
      setForm((f) => ({
        ...f,
        images: [...f.images.split("\n").map((s) => s.trim()).filter(Boolean), ...added].join("\n"),
      }));
      toast(added.length === 1 ? "Image uploaded" : `${added.length} images uploaded`, "success");
    }
    setUploading(false);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      fetch("/api/admin/products", { credentials: "include" }),
      fetch("/api/categories"),
    ]);
    const pData = await pRes.json().catch(() => ({ products: [] }));
    const c = await cRes.json();
    if (pData.migrationRequired) {
      setCostWarning(pData.hint ?? "Accounting migration required.");
    } else {
      setCostWarning(null);
    }
    const list: AdminProduct[] = pData.products ?? [];
    setLocalProducts(list);
    // Storefront store gets the SAME products minus the confidential cost.
    setProducts(list.map(({ cost: _cost, ...pub }) => pub as Product));
    setCategories(c.categories);
    setLoading(false);
  }, [setProducts, setCategories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/admin/products", { credentials: "include" }),
        fetch("/api/categories"),
      ]);
      const pData = await pRes.json().catch(() => ({ products: [] }));
      const c = await cRes.json();
      if (cancelled) return;
      if (pData.migrationRequired) {
        setCostWarning(pData.hint ?? "Accounting migration required.");
      }
      const list: AdminProduct[] = pData.products ?? [];
      setLocalProducts(list);
      setProducts(list.map(({ cost: _cost, ...pub }) => pub as Product));
      setCategories(c.categories);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [setProducts, setCategories]);

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with an admin account to manage products.
        </p>
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, categoryId: categories[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (p: AdminProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      cost: p.cost != null ? String(p.cost) : "",
      compareAt: p.compareAt ? String(p.compareAt) : "",
      stock: String(p.stock),
      categoryId: p.categoryId,
      images: p.images.join("\n"),
      tags: p.tags.join(", "),
      featured: p.featured,
      isActive: p.isActive,
      supplierUrl: p.supplierUrl ?? "",
      supplierSku: p.supplierSku ?? "",
    });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      // Confidential supplier cost — empty field clears it; must be >= 0
      // (server validates too).
      cost: form.cost === "" ? null : Number(form.cost),
      compareAt: form.compareAt ? Number(form.compareAt) : null,
      stock: Number(form.stock) || 0,
      categoryId: form.categoryId,
      images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      featured: form.featured,
      isActive: form.isActive,
      // Dropshipping sourcing (Task 65) — empty field clears it.
      supplierUrl: form.supplierUrl.trim() || null,
      supplierSku: form.supplierSku.trim() || null,
    };
    if (!body.name || !body.price || !body.categoryId) {
      toast("Name, price, and category are required.", "error");
      return;
    }
    if (body.cost != null && (isNaN(body.cost) || body.cost < 0)) {
      toast("Product cost must be zero or greater.", "error");
      return;
    }
    try {
      const res = await fetch(
        editing ? `/api/products/${editing.id}` : "/api/products",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Save failed", "error");
        return;
      }
      toast(editing ? "Product updated" : "Product created", "success");
      setDialogOpen(false);
      reload();
    } catch (err) {
      toast("Network error", "error");
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/products/${p.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      toast("Product deleted", "success");
      reload();
    } else {
      toast(data?.error ?? "Delete failed", "error");
    }
  };

  // Fetch the supplier listing server-side and open the Create form prefilled
  // with the extracted draft. The listing price is the SUPPLIER price, so it
  // prefills Product Cost, with a ~2.5x retail suggestion in Price — both are
  // editable before saving.
  const runImport = async () => {
    if (!importUrl.trim()) {
      toast("Paste a supplier product URL first.", "error");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/admin/import-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.draft) {
        toast(data?.error ?? "Import failed.", "error");
        return;
      }
      const d = data.draft as {
        name: string; description: string; price: string | number;
        images: string[]; supplierUrl: string; source: string;
      };
      const supplierCost = Number(d.price) || 0;
      const suggestedRetail = supplierCost > 0 ? Math.ceil(supplierCost * 2.5) - 0.01 : 0;
      setEditing(null);
      setForm({
        ...EMPTY,
        name: d.name,
        description: d.description,
        price: suggestedRetail > 0 ? suggestedRetail.toFixed(2) : "",
        cost: supplierCost > 0 ? supplierCost.toFixed(2) : "",
        categoryId: categories[0]?.id ?? "",
        images: d.images.join("\n"),
        supplierUrl: d.supplierUrl,
      });
      setImportOpen(false);
      setImportUrl("");
      setDialogOpen(true);
      toast(`Draft from ${d.source} — review the details, set your price, then save.`, "success");
    } catch {
      toast("Network error while importing.", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your catalog, pricing, and inventory.</p>
        </div>
        {tab === "catalog" && (
          <div className="flex gap-2">
            <Button onClick={() => setImportOpen(true)} variant="outline" className="border-brand text-brand hover:bg-brand hover:text-white">
              <Link2 className="mr-1 h-4 w-4" /> Import from URL
            </Button>
            <Button onClick={openNew} className="btn-accent">
              <Plus className="mr-1 h-4 w-4" /> New product
            </Button>
          </div>
        )}
      </div>

      {/* Section tabs — Catalog is the default and renders exactly what the
          dashboard always has; the accounting sections extend it in the same
          visual language. */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[#e6e2d4] pb-3">
        {([
          ["catalog", "Catalog", Package],
          ["fulfillment", "Fulfillment", Truck],
          ["leads", "Leads", Users],
          ["accounting", "Accounting", Calculator],
          ["reconciliation", "Reconciliation", Scale],
          ["profitability", "Profitability", TrendingUp],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === key
                ? "bg-brand text-white shadow-sm"
                : "border border-[#e6e2d4] bg-white text-foreground/80 hover:bg-secondary hover:text-brand"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "fulfillment" && <AdminFulfillment />}
      {tab === "leads" && <AdminLeads />}
      {tab === "accounting" && <AdminAccounting />}
      {tab === "reconciliation" && <AdminReconciliation />}
      {tab === "profitability" && <AdminProfit />}

      {tab === "catalog" && (
      <>
      {costWarning && (
        <div className="mb-4 rounded-lg border border-[#f28c28]/40 bg-[#f28c28]/10 px-4 py-3 text-sm text-[#8a5215]">
          Accounting tables are not migrated yet — cost entries will fail until the SQL below is run in the Supabase SQL editor:
          <code className="ml-1 rounded bg-white/70 px-1.5 py-0.5 text-xs">src/lib/supabase/migrations/2026-09-11-accounting.sql</code>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total products", value: products.length, color: "text-brand" },
          { label: "Featured", value: products.filter((p) => p.featured).length, color: "text-[#f28c28]" },
          { label: "Out of stock", value: products.filter((p) => p.stock === 0).length, color: "text-destructive" },
          { label: "Categories", value: categories.length, color: "text-[#3f7d4a]" },
        ].map((s) => (
          <Card key={s.label} className="border-[#e6e2d4]">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-[#e6e2d4]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-brand-dark">
            <Package className="h-4 w-4 text-brand" /> Catalog ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : (
            <div className="-mx-6 max-h-[560px] overflow-y-auto px-6">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Product</th>
                    <th className="py-3 pr-4">Category</th>
                    <th className="py-3 pr-4 text-right">Price</th>
                    <th className="py-3 pr-4 text-right">Cost</th>
                    <th className="py-3 pr-4 text-right">Stock</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded bg-muted">
                            {p.images[0] && (
                              <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium leading-tight">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.sku ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {categories.find((c) => c.id === p.categoryId)?.name ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span>{formatPrice(p.price, p.currency)}</span>
                        {p.compareAt && p.compareAt > p.price && (
                          <span className="ml-1 text-xs text-muted-foreground line-through">
                            {formatPrice(p.compareAt, p.currency)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">
                        {p.cost != null ? formatPrice(p.cost, p.currency) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">{p.stock}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1">
                          {p.featured && <Badge variant="secondary">Featured</Badge>}
                          {!p.isActive && <Badge variant="outline">Hidden</Badge>}
                          {p.stock === 0 && <Badge className="bg-destructive/10 text-destructive">OOS</Badge>}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(p)}
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-destructive"
                            onClick={() => remove(p)}
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* Flex column: header stays fixed, form scrolls, footer is ALWAYS
            visible — Cancel/Create never disappear below the fold. */}
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 px-6 pb-3 pt-6">
            <DialogTitle>{editing ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>
              {editing ? `Updating ${editing.name}` : "Fill in the details below to list a new product."}
            </DialogDescription>
          </DialogHeader>
          <form id="product-form" onSubmit={save} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 py-3">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Name <Req /></Label>
              <Input
                id="p-name"
                required
                placeholder="e.g. Carry Canvas Tote"
                className={FIELD_CLS}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-desc">Description <Req /></Label>
              <Textarea
                id="p-desc"
                required
                rows={3}
                placeholder="Tell customers what makes this product special…"
                className={FIELD_CLS}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="p-price" className="whitespace-nowrap">Price <Req /></Label>
                <div className="relative">
                  <DollarPrefix />
                  <Input
                    id="p-price"
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className={`pl-7 ${FIELD_CLS}`}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-compare" className="whitespace-nowrap">Compare at <Opt /></Label>
                <div className="relative">
                  <DollarPrefix />
                  <Input
                    id="p-compare"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 24.99"
                    className={`pl-7 ${FIELD_CLS}`}
                    value={form.compareAt}
                    onChange={(e) => setForm({ ...form, compareAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-stock" className="whitespace-nowrap">Stock <Opt /></Label>
                <Input
                  id="p-stock"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  className={FIELD_CLS}
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-cat" className="whitespace-nowrap">Category <Req /></Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger id="p-cat" className={`w-full ${FIELD_CLS}`}>
                    <SelectValue placeholder="Pick a category…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-brand/25 bg-brand/5 px-4 py-3">
              <Label htmlFor="p-cost" className="whitespace-nowrap">Product Cost <span className="text-xs font-normal text-muted-foreground">/ Qiimaha Shaygu Noogu Fadhiyo</span> <Opt /></Label>
              <div className="relative">
                <DollarPrefix />
                <Input
                  id="p-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className={`pl-7 ${FIELD_CLS}`}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The amount this product costs Hayaan Market to purchase from the supplier. Confidential — never shown to customers. Used to calculate gross profit (selling price − product cost) and frozen per order at sale time.
              </p>
              {/* Dropshipping sourcing (Task 65) — where this item ships from. */}
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="p-supplier-url" className="whitespace-nowrap">Supplier URL <Opt /></Label>
                  <Input
                    id="p-supplier-url"
                    type="url"
                    placeholder="https://www.aliexpress.com/item/…"
                    className={FIELD_CLS}
                    value={form.supplierUrl}
                    onChange={(e) => setForm({ ...form, supplierUrl: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="p-supplier-sku" className="whitespace-nowrap">Supplier SKU / variant <Opt /></Label>
                  <Input
                    id="p-supplier-sku"
                    placeholder="e.g. 1005006123456789-black"
                    className={FIELD_CLS}
                    value={form.supplierSku}
                    onChange={(e) => setForm({ ...form, supplierSku: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Dropshipping? Paste the Alibaba / AliExpress listing here — paid orders then show an
                Open-listing link in the Fulfillment tab. Admin-only, never shown to customers.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Product images <Opt /></Label>
              {/* Thumbnails of the current list + the upload tile. Removing a
                  thumbnail rewrites the textarea value underneath. */}
              <div className="flex flex-wrap items-center gap-2">
                {previewUrls.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="group relative h-14 w-14 overflow-hidden rounded-md border border-[#e6e2d4] bg-[#faf8f1]"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] font-medium text-white transition-opacity hover:bg-red-700 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <label
                  className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-brand/50 bg-[#faf8f1] px-3 text-xs font-medium text-brand transition hover:bg-secondary ${
                    uploading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      uploadImages(e.target.files);
                      e.currentTarget.value = ""; // allow re-picking the same file
                    }}
                  />
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload"}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP, or GIF — up to 5 MB each. Files upload to Supabase Storage; you can also paste URLs below.
              </p>
              <Textarea
                id="p-images"
                rows={3}
                placeholder={"https://…\nhttps://…"}
                className={FIELD_CLS}
                value={form.images}
                onChange={(e) => setForm({ ...form, images: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-tags">Tags (comma-separated) <Opt /></Label>
              <Input
                id="p-tags"
                placeholder="audio, wireless, sale"
                className={FIELD_CLS}
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-brand/25 bg-brand/5 px-4 py-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.featured}
                  onCheckedChange={(b) => setForm({ ...form, featured: b })}
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(b) => setForm({ ...form, isActive: b })}
                />
                Visible in store
              </label>
            </div>
          </form>
          {/* Outside the scrolling form so the action row never scrolls away;
              the submit button targets the form via form="product-form". */}
          <DialogFooter className="shrink-0 border-t border-brand/15 bg-background px-6 py-3">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" form="product-form" className="btn-accent">{editing ? "Save changes" : "Create product"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier URL import (Task 65) — paste an Alibaba / AliExpress listing
          and the server extracts a draft that prefills the Create form. */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from supplier URL</DialogTitle>
            <DialogDescription>
              Paste an Alibaba / AliExpress (or any) product page — we fill in the name,
              description, images, and supplier cost. You review everything and set your retail
              price before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="import-url">Product page URL</Label>
              <Input
                id="import-url"
                type="url"
                placeholder="https://www.aliexpress.com/item/1005006123456789.html"
                className={FIELD_CLS}
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runImport();
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Some supplier sites block automated access — if the import fails, create the product
              manually and paste the URL into the Supplier URL field instead.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button type="button" onClick={runImport} disabled={importing} className="btn-accent">
              {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
              {importing ? "Fetching…" : "Fetch details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blog management — admin-authored articles at /blog (independent of
          the catalog form state above). */}
      <AdminBlog />
      </>
      )}
    </div>
  );
}
