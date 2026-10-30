"use client";

// Task 132 — the header search input with live suggestions.
//
// Why: searchQuery filters the catalog grid that renders BELOW the hero, so
// typing on a phone gave zero visible feedback until the user scrolled two
// viewport-heights down. This component keeps the exact same input styling
// but anchors a suggestions panel right under the input (desktop center zone
// + the mobile search row — both share the Header's `q` state, so this is
// extracted instead of duplicated).
//
// Behavior:
//   • Matches are computed client-side over the already-booted catalog with
//     the SAME haystack the grid filters on (name + description + tags +
//     category), so "See all N results" never contradicts the grid count.
//   • Tapping a suggestion opens the same SSR PDP route the product cards
//     use (full navigation — bfcache- and prerender-friendly, same as
//     ProductCard.openProductPage).
//   • Enter (and the "See all" row) close the panel and scroll to #catalog;
//     from an SSR route that means navigating home first (Header.goShop
//     pattern — a view switch would render nothing there).
//   • Escape / outside tap close it. Zero new network calls.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";
import { productImg, productImgFallback } from "@/lib/img";
import { stripHtml } from "@/lib/rich-text";
import type { Product } from "@/lib/types";

const MAX_SUGGESTIONS = 5;

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

/** Bolds the first case-insensitive occurrence of the needle in the name. */
function HighlightName({ name, needle }: { name: string; needle: string }) {
  const idx = name.toLowerCase().indexOf(needle);
  if (idx < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, idx)}
      <span className="font-bold text-brand-dark">{name.slice(idx, idx + needle.length)}</span>
      {name.slice(idx + needle.length)}
    </>
  );
}

export function HeaderSearch({
  q,
  setQ,
  onSeeAll,
}: {
  /** Shared query state — both header zones (desktop center + mobile row)
   *  must stay in sync, so Header owns it and passes it down. */
  q: string;
  setQ: (v: string) => void;
  /** Enter / "See all results": close + scroll to the catalog (Header
   *  supplies the home-navigation logic it already owns). */
  onSeeAll: () => void;
}) {
  const { t } = useLang();
  const products = useStore((s) => s.products);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on any tap/click outside the search zone (touchstart covers the
  // phones where this panel matters most).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const { matches, total } = useMemo(() => {
    if (needle.length < 2 || products.length === 0) return { matches: [] as Product[], total: 0 };
    const hits = products
      .map((p) => {
        const inName = p.name.toLowerCase().includes(needle);
        const rest = `${stripHtml(p.description)} ${p.tags.join(" ")} ${p.category?.name ?? ""}`.toLowerCase();
        return { p, rank: inName ? 0 : rest.includes(needle) ? 1 : 2 };
      })
      .filter((h) => h.rank < 2);
    hits.sort((a, b) => a.rank - b.rank);
    return { matches: hits.slice(0, MAX_SUGGESTIONS).map((h) => h.p), total: hits.length };
  }, [products, needle]);

  // Guard: until the catalog store has booted the panel would lie ("no
  // matches" while the fetch is still in flight), so stay hidden then.
  const showPanel = open && needle.length >= 2 && products.length > 0;

  const openPdp = (p: Product) => {
    setOpen(false);
    try {
      document.dispatchEvent(new CustomEvent("hayaan:pdp-nav"));
    } catch {}
    window.location.assign(`/product/${p.slug}`);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            setOpen(false);
            onSeeAll();
          }
        }}
        placeholder={t("header.searchPlaceholder")}
        className="border-brand/40 bg-[#faf8f1] pl-9 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20 placeholder:text-muted-foreground/70"
        aria-label={t("header.searchAria")}
        aria-expanded={showPanel}
        autoComplete="off"
      />
      {showPanel && (
        <div
          data-search-panel
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-[#e6e2d4] bg-white shadow-lg"
          role="listbox"
          aria-label={t("search.suggestionsAria")}
        >
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">{t("search.noMatches", { q })}</p>
            ) : (
              matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPdp(p)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#faf8f1]"
                >
                  {/* Same Supabase transform + fallback contract as the
                      product cards (Task 109) — a missing transform can never
                      blank the row. */}
                  <img
                    src={productImg(p.images[0], 400)}
                    onError={productImgFallback(p.images[0])}
                    alt=""
                    aria-hidden="true"
                    className="h-10 w-10 shrink-0 rounded-md border border-[#e6e2d4] bg-[#faf8f1] object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      <HighlightName name={p.name} needle={needle} />
                    </span>
                    {p.category?.name && (
                      <span className="block truncate text-xs text-muted-foreground">{p.category.name}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-bold text-brand-dark">
                    {formatPrice(p.price, p.currency)}
                  </span>
                </button>
              ))
            )}
          </div>
          {total > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSeeAll();
              }}
              className="w-full border-t border-[#e6e2d4] bg-[#faf8f1] px-3 py-2 text-left text-sm font-medium text-brand transition-colors hover:bg-[#f3f7f1]"
            >
              {t("search.seeAll", { n: total })} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
