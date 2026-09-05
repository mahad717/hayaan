"use client";

import { useState } from "react";
import { ChevronLeft, Minus, Plus, ShoppingBag, Star, Truck, Shield, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { addToCart, useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function ProductDetail() {
  const { selectedProduct, setView, setCart, setCartOpen, toast, user, setAuthOpen } = useStore();
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const product = selectedProduct;
  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }

  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;

  const handleAdd = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setAdding(true);
    try {
      const cart = await addToCart(product.id, qty, "increment");
      setCart(cart);
      toast(`${qty} × ${product.name} added to cart`, "success");
      setCartOpen(true);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setAdding(true);
    try {
      const cart = await addToCart(product.id, qty, "increment");
      setCart(cart);
      setView("checkout");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted/30">
            <img
              src={product.images[activeImage] ?? "/placeholder.svg"}
              alt={`${product.name} — image ${activeImage + 1}`}
              className="h-full w-full object-cover"
            />
            {discount > 0 && (
              <Badge className="absolute left-4 top-4 bg-destructive text-destructive-foreground">
                -{discount}%
              </Badge>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-lg border bg-muted/30 transition",
                    activeImage === i ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50",
                  )}
                  aria-label={`View image ${i + 1}`}
                  aria-pressed={activeImage === i}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {product.category?.name ?? "—"}
              </span>
              {product.featured && (
                <Badge variant="secondary">Featured</Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>{product.rating || "Unrated"}</span>
              {product.reviewCount > 0 && <span>· {product.reviewCount} reviews</span>}
              <span>· SKU {product.sku ?? "—"}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold">{formatPrice(product.price, product.currency)}</span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-base text-muted-foreground line-through">
                {formatPrice(product.compareAt, product.currency)}
              </span>
            )}
            {discount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700">Save {discount}%</Badge>
            )}
          </div>

          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
            {product.description}
          </p>

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <Badge key={t} variant="outline" className="font-normal">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 rounded-full", product.stock > 0 ? "bg-emerald-500" : "bg-destructive")} />
            <span className="text-muted-foreground">
              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
            </span>
          </div>

          {/* Quantity + add */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="Decrease quantity"
                disabled={qty <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-sm font-medium" aria-live="polite">
                {qty}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setQty(Math.min(product.stock, qty + 1))}
                aria-label="Increase quantity"
                disabled={qty >= product.stock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button size="lg" onClick={handleAdd} disabled={adding || product.stock === 0}>
              <ShoppingBag className="mr-2 h-4 w-4" /> Add to cart
            </Button>
            <Button size="lg" variant="secondary" onClick={handleBuyNow} disabled={adding || product.stock === 0}>
              Buy now
            </Button>
          </div>

          {/* Reassurance row */}
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Free shipping over $75
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Secure checkout
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              30-day returns
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
