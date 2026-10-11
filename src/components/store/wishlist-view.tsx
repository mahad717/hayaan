"use client";

import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard, ProductCardSkeleton } from "@/components/store/product-card";
import { goToView, useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";

/**
 * Wishlist view (Task 88) — /?view=wishlist via the header heart, the
 * account dropdown, or the mobile drawer. Reuses ProductCard wholesale:
 * its built-in add-to-cart keeps the "saved → buy" loop one tap long, and
 * its heart doubles as the remove control (unsaving from here syncs the
 * header badge through the shared store).
 */
export function WishlistView() {
  const { user, bootReady, wishlist, setView } = useStore();
  const { t } = useLang();

  if (!bootReady && !user) {
    // Deep link (e.g. /?view=wishlist) — bootstrap still in flight. Neutral
    // loading state instead of a sign-in flash (same as the orders view).
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("wl.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Heart className="mx-auto h-12 w-12 text-brand" />
        <h1 className="mt-4 text-2xl font-semibold text-brand-dark">{t("wl.signinTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("wl.signinBody")}</p>
        <Button className="mt-4 bg-brand hover:bg-brand-dark" onClick={() => useStore.getState().setAuthOpen(true)}>
          {t("header.signIn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 text-brand hover:bg-secondary"
        onClick={() => setView("home")}
      >
        {t("wl.cta")}
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">
          {t("wl.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("wl.count", { n: wishlist.length })}</p>
      </div>

      {wishlist.length === 0 ? (
        <div className="mx-auto max-w-md rounded-2xl border border-[#e6e2d4] bg-[#faf8f1] px-6 py-16 text-center">
          <Heart className="mx-auto h-12 w-12 text-[#f28c28]/60" />
          <h2 className="mt-4 text-lg font-semibold text-brand-dark">{t("wl.empty")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("wl.emptyBody")}</p>
          <Button className="mt-6 btn-accent" onClick={() => goToView("home")}>
            {t("wl.cta")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
          {wishlist.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WishlistViewSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="h-8 w-44" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
