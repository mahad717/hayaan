"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Star, Plus, Check, ShoppingBag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/types";
import { addToCart, useStore } from "@/hooks/use-store";
import { WishlistHeartButton } from "@/components/store/wishlist-heart";
import { useLang } from "@/components/store/language-provider";
import { categoryName } from "@/lib/i18n/dictionary";

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function ProductCard({ product }: { product: Product }) {
  const { setCart, toast, user, setAuthOpen } = useStore();
  const { t, lang } = useLang();
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
      toast(t("card.addedAria", { name: product.name }), "success");
      setAdded(true);
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setAdded(false), 1500);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  // Task 108b: card taps are REAL navigations (window.location.assign), not
  // Next router soft navs. Two reasons:
  //  1. The home/category pages declare a Speculation-Rules `moderate`
  //     prerender for /product/* — but activation ONLY happens for real
  //     navigations, never for router.push. With the prerender ready (desktop
  //     hover ≥200ms; Chrome 143+ mobile ~500ms after scrolling stops) the tap
  //     swaps to the pre-built PDP instantly instead of the soft-nav's
  //     URL-flips-but-grid-freezes gap (~1.5s on the owner's A18).
  //  2. A real navigation is the same path "Back to shop" already uses — one
  //     consistent, bfcache- and prerender-friendly model in both directions.
  // Safety: cart and wishlist live SERVER-side (/api/cart, wishlist_items) and
  // the storefront re-bootstraps them on boot, so full documents lose nothing;
  // the home page itself becomes bfcache-eligible (Task 108 headers), so the
  // phone's back button still restores the grid instantly and exactly.
  const openProductPage = () => {
    try {
      document.dispatchEvent(new CustomEvent("hayaan:pdp-nav"));
    } catch {}
    window.location.assign(`/product/${product.slug}`);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={openProductPage}
      onKeyDown={(e) => {
        if (e.key === "Enter") openProductPage();
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28] bg-white border-[#e6e2d4]"
      aria-label={t("card.viewAria", { name: product.name })}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-[#faf8f1]">
        <img
          src={product.images[0] ?? "/placeholder.svg"}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Sale + Digital badges — stacked top-left (Market Orange sale, sage digital) */}
        {(discount > 0 || product.productType === "digital") && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {discount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[#f28c28] px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                -{discount}%
              </span>
            )}
            {product.productType === "digital" && (
              <span className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-brand shadow-sm">
                <Download className="h-3 w-3" aria-hidden /> {t("card.digital")}
              </span>
            )}
          </div>
        )}

        {/* Right column — featured badge + wishlist heart (Task 88), stacked
            so both stay visible on featured products. The heart is ALWAYS
            visible (Jumia/Noon pattern, not hover-only): the "save for
            later" moment happens while scrolling the grid, often on mobile
            where hover doesn't exist. stopPropagation inside keeps the tap
            from navigating to the PDP. */}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
          {product.featured && (
            <Badge variant="secondary" className="bg-white/95 text-brand shadow-sm hover:bg-white">
              {t("card.featured")}
            </Badge>
          )}
          <WishlistHeartButton productId={product.id} productName={product.name} />
        </div>

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
            aria-label={added ? t("card.addedAria", { name: product.name }) : t("card.addAria", { name: product.name })}
          >
            {added ? (
              <>
                <Check className="mr-1.5 h-4 w-4" aria-hidden />
                {t("card.added")}
              </>
            ) : (
              <>
                <ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden />
                {t("card.add")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-[#3f7d4a]">
            {product.category ? categoryName(product.category.name, product.category.slug, lang) : "—"}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-label={product.rating ? t("card.ratedAria", { r: product.rating }) : t("card.newAria")}>
            <Star className="h-3.5 w-3.5 fill-[#f9c27d] text-[#f9c27d]" />
            {product.rating || t("card.new")}
            {product.reviewCount > 0 && <span className="opacity-70">({product.reviewCount})</span>}
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground font-original">
          {/* Real anchor → crawlable product URL (SEO). Task 108b: the click
              escalates to a REAL navigation so a ready prerender ACTIVATES
              (soft navs never activate one). Modifier clicks (cmd/ctrl/
              middle-click new tab) keep the browser's default behavior. The
              card's onClick handles taps elsewhere on the card; the link must
              NOT stretch over the card (after:inset-0) or it would swallow
              the add-to-cart buttons. */}
          <Link
            href={`/product/${product.slug}`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              e.stopPropagation();
              window.location.assign(`/product/${product.slug}`);
            }}
            className="hover:text-brand"
          >
            {product.name}
          </Link>
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
            aria-label={added ? t("card.addedAria", { name: product.name }) : t("card.addAria", { name: product.name })}
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
