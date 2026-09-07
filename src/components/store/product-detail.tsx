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
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 text-brand hover:bg-secondary"
        onClick={() => setView("home")}
      >
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Button>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/* Gallery */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#faf8f1] ring-1 ring-[#e6e2d4]">
            <img
              src={product.images[activeImage] ?? "/placeholder.svg"}
              alt={`${product.name} — image ${activeImage + 1}`}
              className="h-full w-full object-cover"
            />
            {discount > 0 && (
              <span className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-[#f28c28] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                -{discount}%
              </span>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "aspect-square overflow-hidden rounded-lg border bg-[#faf8f1] transition",
                    activeImage === i ? "border-brand ring-2 ring-[#f28c28]/30" : "border-[#e6e2d4] hover:border-brand/50",
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
              <span className="text-xs font-medium uppercase tracking-wide text-[#3f7d4a]">
                {product.category?.name ?? "—"}
              </span>
              {product.featured && (
                <Badge variant="secondary" className="bg-secondary text-brand">
                  Featured
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-[#f9c27d] text-[#f9c27d]" aria-hidden />
              <span aria-label={product.rating ? `Rated ${product.rating} out of 5` : "Unrated"}>
                {product.rating || "Unrated"}
              </span>
              {product.reviewCount > 0 && <span>· {product.reviewCount} reviews</span>}
              <span>· SKU {product.sku ?? "—"}</span>
            </div>
          </div>

          {/* Price — Deep Hayaan Green */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-brand">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-base text-muted-foreground line-through">
                {formatPrice(product.compareAt, product.currency)}
              </span>
            )}
            {discount > 0 && (
              <Badge className="bg-[#fef1de] text-[#f28c28] hover:bg-[#fef1de]">
                Save {discount}%
              </Badge>
            )}
          </div>

          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground font-original sm:text-base">
            {product.description}
          </p>

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <Badge key={t} variant="outline" className="border-[#e6e2d4] font-normal text-muted-foreground">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                product.stock > 0 ? "bg-[#3f7d4a]" : "bg-destructive",
              )}
            />
            <span className="text-muted-foreground">
              {product.stock > 5
                ? `${product.stock} in stock`
                : product.stock > 0
                  ? `Only ${product.stock} left in stock`
                  : "Out of stock"}
            </span>
          </div>

          {/* Quantity + actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-[#e6e2d4] bg-white">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-brand"
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
                className="h-10 w-10 text-brand"
                onClick={() => setQty(Math.min(product.stock, qty + 1))}
                aria-label="Increase quantity"
                disabled={qty >= product.stock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Add to cart — Market Orange (the 10% accent) */}
            <Button
              size="lg"
              className="btn-accent"
              onClick={handleAdd}
              disabled={adding || product.stock === 0}
            >
              <ShoppingBag className="mr-2 h-4 w-4" /> Add to cart
            </Button>

            {/* Buy now — Deep Hayaan Green */}
            <Button
              size="lg"
              className="bg-brand hover:bg-brand-dark"
              onClick={handleBuyNow}
              disabled={adding || product.stock === 0}
            >
              Buy now
            </Button>
          </div>

          {/* Reassurance row */}
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-[#e6e2d4] bg-[#faf8f1] p-4 text-sm font-original sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-brand" />
              Free shipping over $75
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand" />
              Secure checkout via Sifalo Pay
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-brand" />
              Track every order
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
