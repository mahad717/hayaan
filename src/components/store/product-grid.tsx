"use client";

import { useMemo } from "react";
import { useStore, fetchProducts, fetchCategories } from "@/hooks/use-store";
import { ProductCard, ProductCardSkeleton } from "./product-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

export function ProductGrid() {
  const {
    products,
    setProducts,
    categories,
    setCategories,
    searchQuery,
    activeCategory,
    setActiveCategory,
    sort,
    setSort,
    setCartOpen,
  } = useStore();
  const [loading, setLoading] = useState(products.length === 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
      if (cancelled) return;
      setProducts(p);
      setCategories(c);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [setProducts, setCategories]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let out = products.filter((p) => {
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
  }, [products, searchQuery, activeCategory, sort]);

  return (
    <section id="catalog" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">
            Find your next favorite
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length} product{visible.length === 1 ? "" : "s"} to explore
            {searchQuery && <> · results for “{searchQuery}”</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-44 bg-white" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Featured first</SelectItem>
              <SelectItem value="price-asc">Price: low to high</SelectItem>
              <SelectItem value="price-desc">Price: high to low</SelectItem>
              <SelectItem value="rating">Top rated</SelectItem>
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
          All
        </Button>
        {categories.map((c) => (
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
            {c.name}
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
          <p className="font-medium text-foreground">No products found</p>
          <p className="text-sm text-muted-foreground">Try a different search, or browse another category.</p>
          <Button
            variant="outline"
            className="border-brand text-brand hover:bg-brand hover:text-white"
            onClick={() => {
              setActiveCategory("all");
              useStore.getState().setSearchQuery("");
            }}
          >
            Reset filters
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
          View your cart →
        </Button>
      </div>
    </section>
  );
}
