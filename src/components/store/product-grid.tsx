"use client";

import { useMemo } from "react";
import { useStore, fetchProducts, fetchCategories } from "@/hooks/use-store";
import { ProductCard, ProductCardSkeleton } from "./product-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Category, Product } from "@/lib/types";
import { useLang } from "@/components/store/language-provider";
import { categoryName } from "@/lib/i18n/dictionary";

export function ProductGrid({
  initialProducts,
  initialCategories,
}: {
  /** Catalog server-fetched by the home page (page.tsx) — makes the product
   *  cards part of the FIRST HTML paint, so a pre-hydration "Back to shop"
   *  (a full document reload on real phones) shows products immediately
   *  instead of skeletons until JS boots and /api/products answers.
   *  Undefined (SSR fetch slow/failed) keeps the previous client-fetch path. */
  initialProducts?: Product[];
  initialCategories?: Category[];
} = {}) {
  const {
    products,
    setProducts,
    setProductsLoaded,
    categories,
    setCategories,
    searchQuery,
    activeCategory,
    setActiveCategory,
    sort,
    setSort,
    setCartOpen,
  } = useStore();
  const { t, lang } = useLang();
  const catalogReady = initialProducts !== undefined;
  const [loading, setLoading] = useState(products.length === 0 && !catalogReady);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Seed the store with the SSR catalog so every store-bound surface
      // (PDP "openProduct", cart flows, SPA-mode views) sees the catalog
      // without an extra round-trip. Only when the store is still empty —
      // a client-side navigation arriving with a pre-warmed store (PDP
      // pre-warm, previous browsing) must not be clobbered by the possibly
      // staler SSR snapshot.
      if (catalogReady && useStore.getState().products.length === 0) {
        setProducts(initialProducts!);
        if (initialCategories) setCategories(initialCategories);
        setProductsLoaded(true);
      }
      // Products gate the grid; categories only feed the filter pills, so the
      // two requests settle independently. This silent refresh keeps catalog
      // freshness semantics identical to the pre-SSR behavior.
      const productsPromise = fetchProducts();
      const categoriesPromise = fetchCategories();
      const p = await productsPromise;
      if (cancelled) return;
      setProducts(p);
      setProductsLoaded(true);
      setLoading(false);
      const c = await categoriesPromise;
      if (cancelled) return;
      setCategories(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogReady, initialProducts, initialCategories, setProducts, setCategories]);

  // Display source: the live store once it holds products (client-side nav
  // with a pre-warmed store, or the refresh above), otherwise the SSR catalog
  // — which is what puts the cards into the first paint.
  const displayProducts = products.length > 0 ? products : initialProducts ?? [];
  const displayCategories = categories.length > 0 ? categories : initialCategories ?? [];

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let out = displayProducts.filter((p) => {
      if (activeCategory !== "all" && p.categoryId !== activeCategory) return false;
      if (q) {
        const hay = `${p.name} ${p.description} ${p.tags.join(" ")} ${p.category?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "price-asc") out = [...out].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") out = [...out].sort((a, b) => b.price - a.price);
    else if (sort === "rating") out = [...out].sort((a, b) => b.rating - a.rating);
    else out = [...out].sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1));
    return out;
  }, [displayProducts, searchQuery, activeCategory, sort]);

  return (
    <section id="catalog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">
            {t("grid.heading")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length === 1
              ? t("grid.countOne")
              : t("grid.countOther", { n: visible.length })}
            {searchQuery && <> · {t("grid.resultsFor", { q: searchQuery })}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44 bg-white" aria-label={t("grid.sortAria")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("grid.sortFeatured")}</SelectItem>
              <SelectItem value="price-asc">{t("grid.sortPriceAsc")}</SelectItem>
              <SelectItem value="price-desc">{t("grid.sortPriceDesc")}</SelectItem>
              <SelectItem value="rating">{t("grid.sortRating")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={activeCategory === "all" ? "default" : "outline"}
          onClick={() => setActiveCategory("all")}
          className={
            activeCategory === "all"
              ? "font-original bg-brand text-white hover:bg-brand-dark"
              : "font-original border-[#e6e2d4] text-foreground hover:bg-secondary hover:text-brand"
          }
        >
          {t("grid.all")}
        </Button>
        {displayCategories.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={activeCategory === c.id ? "default" : "outline"}
            onClick={() => setActiveCategory(c.id)}
            className={
              activeCategory === c.id
                ? "font-original bg-brand text-white hover:bg-brand-dark"
                : "font-original border-[#e6e2d4] text-foreground hover:bg-secondary hover:text-brand"
            }
          >
            {categoryName(c.name, c.slug, lang)}
          </Button>
        ))}
        {loading && (
          <>
            <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
          </>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#e6e2d4] py-16 text-center">
          <p className="font-medium text-foreground">{t("grid.none")}</p>
          <p className="text-sm text-muted-foreground">{t("grid.noneHint")}</p>
          <Button
            variant="outline"
            className="border-brand text-brand hover:bg-brand hover:text-white"
            onClick={() => {
              setActiveCategory("all");
              useStore.getState().setSearchQuery("");
            }}
          >
            {t("grid.resetFilters")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <Button
          variant="ghost"
          className="text-brand hover:bg-secondary"
          onClick={() => setCartOpen(true)}
        >
          {t("grid.viewCart")}
        </Button>
      </div>
    </section>
  );
}
