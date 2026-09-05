"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, Plus, Pencil, Trash2, Package } from "lucide-react";
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
import { fetchProducts } from "@/hooks/use-store";
import type { Product } from "@/lib/types";

function formatPrice(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

interface FormState {
  name: string;
  description: string;
  price: string;
  compareAt: string;
  stock: string;
  categoryId: string;
  images: string;
  tags: string;
  featured: boolean;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  price: "",
  compareAt: "",
  stock: "",
  categoryId: "",
  images: "",
  tags: "",
  featured: false,
  isActive: true,
};

export function AdminPanel() {
  const { user, categories, setProducts, setView, setCategories, toast } = useStore();
  const [products, setLocalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const reload = useCallback(async () => {
    setLoading(true);
    const [p, c] = await Promise.all([fetchProducts(), (await fetch("/api/categories")).json()]);
    setLocalProducts(p);
    setProducts(p);
    setCategories(c.categories);
    setLoading(false);
  }, [setProducts, setCategories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await fetchProducts();
      const cRes = await fetch("/api/categories");
      const c = await cRes.json();
      if (cancelled) return;
      setLocalProducts(p);
      setProducts(p);
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
        <h1 className="text-2xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with an admin account to manage products.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: <code>admin@shop.demo</code> / <code>admin123</code> — call <code>POST /api/seed</code> first to create it.
        </p>
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, categoryId: categories[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      compareAt: p.compareAt ? String(p.compareAt) : "",
      stock: String(p.stock),
      categoryId: p.categoryId,
      images: p.images.join("\n"),
      tags: p.tags.join(", "),
      featured: p.featured,
      isActive: p.isActive,
    });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      compareAt: form.compareAt ? Number(form.compareAt) : null,
      stock: Number(form.stock) || 0,
      categoryId: form.categoryId,
      images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      featured: form.featured,
      isActive: form.isActive,
    };
    if (!body.name || !body.price || !body.categoryId) {
      toast("Name, price, and category are required.", "error");
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
    if (res.ok) {
      toast("Product deleted", "success");
      reload();
    } else {
      toast("Delete failed", "error");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your catalog, pricing, and inventory.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> New product
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total products", value: products.length },
          { label: "Featured", value: products.filter((p) => p.featured).length },
          { label: "Out of stock", value: products.filter((p) => p.stock === 0).length },
          { label: "Categories", value: categories.length },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Catalog ({products.length})
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>
              {editing ? `Updating ${editing.name}` : "Fill in the details below to list a new product."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="p-name">Name *</Label>
              <Input
                id="p-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-desc">Description *</Label>
              <Textarea
                id="p-desc"
                required
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="p-price">Price *</Label>
                <Input
                  id="p-price"
                  required
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-compare">Compare at</Label>
                <Input
                  id="p-compare"
                  type="number"
                  step="0.01"
                  value={form.compareAt}
                  onChange={(e) => setForm({ ...form, compareAt: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-stock">Stock</Label>
                <Input
                  id="p-stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-cat">Category *</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger id="p-cat"><SelectValue placeholder="Pick…" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-images">Image URLs (one per line)</Label>
              <Textarea
                id="p-images"
                rows={3}
                placeholder={"https://...\nhttps://..."}
                value={form.images}
                onChange={(e) => setForm({ ...form, images: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-tags">Tags (comma-separated)</Label>
              <Input
                id="p-tags"
                placeholder="audio, wireless, sale"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-6">
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Save changes" : "Create product"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
