"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Plus, Check, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/types";
import { addToCart, useStore } from "@/hooks/use-store";

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function ProductCard({ product }: { product: Product }) {
  const { openProduct, setCart, toast, user, setAuthOpen } = useStore();
  // Brief "added" confirmation: the card's add buttons flash a check mark
  // after a successful add, then revert.
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
    },
    [],
  );
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round((1 - product.price / product.compareAt) * 100)
      : 0;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    try {
      const cart = await addToCart(product.id, 1, "increment");
      setCart(cart);
      toast(`${product.name} added to cart`, "success");
      setAdded(true);
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => openProduct(product)}
      onKeyDown={(e) => {
        if (e.key === "Enter") openProduct(product);
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28] bg-white border-[#e6e2d4]"
      aria-label={`View ${product.name}`}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-[#faf8f1]">
        <img
          src={product.images[0] ?? "/placeholder.svg"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Sale badge — Market Orange (the 10% accent) */}
        {discount > 0 && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#f28c28] px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            -{discount}%
          </span>
        )}

        {/* Featured badge — subtle, green-tinted */}
        {product.featured && (
          <Badge
            variant="secondary"
            className="absolute right-3 top-3 bg-white/95 text-brand hover:bg-white shadow-sm"
          >
            Featured
          </Badge>
        )}

        {/* Hover add-to-cart overlay button (orange, 10% accent).
            pointer-events dance keeps the hidden overlay from stealing taps
            on touch screens; .card-hover-add (globals.css) removes it from
            touch devices entirely — mobile already has the always-visible
            "+" button in the price row. */}
        <div className="card-hover-add pointer-events-none group-hover:pointer-events-auto absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <Button
            size="sm"
            className="btn-accent w-full shadow-md"
            onClick={handleAdd}
            aria-label={added ? `${product.name} added to cart` : `Add ${product.name} to cart`}
          >
            {added ? (
              <>
                <Check className="mr-1.5 h-4 w-4" aria-hidden />
                Added
              </>
            ) : (
              <>
                <ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden />
                Add to cart
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#3f7d4a]">
            {product.category?.name ?? "—"}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-label={product.rating ? `Rated ${product.rating} out of 5` : "New product"}>
            <Star className="h-3.5 w-3.5 fill-[#f9c27d] text-[#f9c27d]" />
            {product.rating || "New"}
            {product.reviewCount > 0 && <span className="opacity-70">({product.reviewCount})</span>}
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground font-original">
          {product.name}
        </h3>

        {/* Price row — deep green price, strikethrough compareAt */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            <span className="text-base font-semibold text-brand">
              {formatPrice(product.price, product.currency)}
            </span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAt, product.currency)}
              </span>
            )}
          </div>

          {/* Mobile add button (always visible) — orange; flashes a check
              mark for ~1.5s after a successful add */}
          <Button
            size="icon"
            className="btn-accent h-9 w-9 sm:hidden"
            onClick={handleAdd}
            aria-label={added ? `${product.name} added to cart` : `Add ${product.name} to cart`}
          >
            {added ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden border-[#e6e2d4] p-0">
      <Skeleton className="aspect-square w-full rounded-none bg-[#faf8f1]" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
    </Card>
  );
}
