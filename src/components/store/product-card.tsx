"use client";

import { Star, Plus } from "lucide-react";
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
  const { openProduct, setCart, setCartOpen, toast, user, setAuthOpen } = useStore();
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
      className="group relative flex cursor-pointer flex-col overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View ${product.name}`}
    >
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        <img
          src={product.images[0] ?? "/placeholder.svg"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {discount > 0 && (
          <Badge className="absolute left-3 top-3 bg-destructive text-destructive-foreground">
            -{discount}%
          </Badge>
        )}
        {product.featured && (
          <Badge className="absolute right-3 top-3 bg-background/90 text-foreground">
            Featured
          </Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.category?.name ?? "—"}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {product.rating || "New"}
            {product.reviewCount > 0 && <span>({product.reviewCount})</span>}
          </div>
        </div>
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold">{formatPrice(product.price, product.currency)}</span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAt, product.currency)}
              </span>
            )}
          </div>
          <Button size="sm" variant="secondary" className="h-8 px-2" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add {product.name} to cart</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </Card>
  );
}
