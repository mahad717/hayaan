"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Minus, Plus, ShoppingBag, Star, Truck, Shield, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addToCart, fetchCategories, fetchProducts, goToView, useStore } from "@/hooks/use-store";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  MOGADISHU_DISTRICTS,
  OTHER_CITY,
  OUTSIDE_MOGADISHU_FEE,
  districtFee,
  findDistrict,
} from "@/lib/shipping";
import { useLang } from "@/components/store/language-provider";
import { categoryName, productDescription } from "@/lib/i18n/dictionary";
import { looksLikeHtml, sanitizeRichText } from "@/lib/rich-text";
import { ProductReviews } from "@/components/store/product-reviews";
import { WishlistHeartButton } from "@/components/store/wishlist-heart";
import { ShareButton } from "@/components/store/share-button";

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

/**
 * Product detail view. Rendered two ways:
 *  • Legacy SPA mode (no props) — reads selectedProduct from the store.
 *  • SSR route mode (/product/[slug]) — `initialProduct` comes preloaded from
 *    the server; the store is synced so cart/auth flows behave identically.
 */
export function ProductDetail({ initialProduct }: { initialProduct?: Product }) {
  const { selectedProduct, openProduct, setView, setCart, setCartOpen, toast, user, setAuthOpen } = useStore();
  const { t, lang } = useLang();
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  // Task 134 (audit F6): mobile sticky add-to-cart bar — appears once the
  // buy box has scrolled ABOVE the viewport, so the buy action is always
  // one thumb-tap away on long product pages.
  // Sticky bar visibility follows the buy box: shown only when it has
  // scrolled ABOVE the viewport (top < 0), one rAF-throttled read per
  // scroll frame. A scroll listener (not IntersectionObserver) because the
  // predicate is geometric ("above the top edge") and IO misses atomic
  // jumps — a programmatic scroll (or a very fast flick) can move the box
  // from below the viewport to above it without EVER intersecting at a
  // frame boundary, so no threshold is crossed and IO stays silent. The
  // body class lifts the floating WhatsApp bubble; the bar is md:hidden —
  // desktop keeps the inline buy box.
  const buyBoxRef = useRef<HTMLDivElement | null>(null);
  const [stickyBar, setStickyBar] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = buyBoxRef.current;
      setStickyBar(!!el && el.getBoundingClientRect().top < 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      document.body.classList.remove("pdp-sticky-atc");
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("pdp-sticky-atc", stickyBar);
  }, [stickyBar]);
  // Task 90: PDP delivery preview — the district fee shown at the decision
  // point instead of only at checkout (Norman: knowledge in the world).
  // Starts empty so the SSR snapshot and the first client render match;
  // the saved district fills in once the session resolves.
  const [districtChoice, setDistrictChoice] = useState("");

  useEffect(() => {
    setDistrictChoice((choice) => {
      if (choice) return choice;
      const matched = findDistrict(user?.city);
      return matched ? matched.name : user?.city ? OTHER_CITY : "";
    });
  }, [user]);

  // Route mode: mirror the server-loaded product into the store so the cart
  // drawer, auth modal, and any store-bound UI agree on the current product.
  useEffect(() => {
    if (initialProduct && selectedProduct?.id !== initialProduct.id) {
      openProduct(initialProduct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct?.id]);

  // Route mode: the store starts COLD when the PDP is opened directly (shared
  // link, refresh), and "Back to shop" used to land on a homepage grid that
  // waited on fresh /api/products + /api/categories — multi-second on mobile
  // data. Warm the catalog into the store while the user reads the page, so
  // the click renders the grid from memory. The grid still refetches on
  // mount (freshness unchanged); skipped when the store already holds
  // products (browsed in from the grid via client-side navigation).
  useEffect(() => {
    if (!initialProduct) return;
    if (useStore.getState().products.length > 0) return;
    (async () => {
      const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
      useStore.getState().setProducts(p);
      useStore.getState().setCategories(c);
      useStore.getState().setProductsLoaded(true);
    })();
  }, [initialProduct]);

  // Rating row → smooth-scrolls to the reviews section (only when reviews
  // exist; otherwise the row stays a plain label).
  const scrollToReviews = () => {
    document.getElementById("pdp-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const product = initialProduct ?? selectedProduct;
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
      toast(t("card.addedAria", { name: product.name }), "success");
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
      goToView("checkout");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {initialProduct ? (
        // Route mode — a PLAIN anchor, NOT <Link> (Task 106).
        //
        // The previous <Link href="/" prefetch={true}> soft-navigated via
        // router.push, which has two failure modes on real phones:
        //  1. A soft navigation NEVER activates the Speculation Rules
        //     prerender of "/" below — activation needs a real
        //     cross-document navigation. The pre-built shop page sat unused
        //     on every hydrated tap (Chromium = nearly all Somali phones).
        //  2. router.push("/") fetched the home RSC payload (~1MB catalog)
        //     over mobile data with the screen frozen on the PDP — the
        //     "first tap does nothing, I tap again" report — and a
        //     slow/failed fetch degraded into a hard navigation with the
        //     "Loading the shop…" overlay.
        // A plain anchor turns EVERY tap into a real navigation:
        //  • prerender ready → instant ACTIVATION, zero network;
        //  • otherwise → full document load whose SSR HTML (catalog in the
        //    first paint since Task 47, warm TTFB since Task 105) paints
        //    progressively instead of freezing, with the tap-feedback
        //    overlay as honest progress. SEO unchanged — same crawlable
        //    href as before.
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-brand hover:bg-secondary"
          asChild
        >
          <a href="/">
            <ChevronLeft className="mr-1 h-4 w-4" /> {t("pdp.back")}
          </a>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-brand hover:bg-secondary"
          onClick={() => setView("home")}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> {t("pdp.back")}
        </Button>
      )}

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
            {/* Wishlist heart (Task 88) — Amazon's placement: top-right of
                the product image (the share+heart pair on amazon.com PDPs).
                Slightly larger than the card heart — this is the focused
                surface where the save decision gets made. */}
            <WishlistHeartButton
              productId={product.id}
              productName={product.name}
              className="absolute right-4 top-4 h-11 w-11"
              iconClassName="h-5 w-5"
            />
            {/* Share (Task 135) — completes the share+heart pair: native
                sheet on phones, WhatsApp/Facebook/X/copy menu on desktop. */}
            <ShareButton
              url={`https://hayaan.co/product/${product.slug}`}
              title={product.name}
              ariaLabel={t("share.aria", { name: product.name })}
              className="absolute right-[4.25rem] top-4 h-11 w-11"
              iconClassName="h-5 w-5"
            />
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
                  aria-label={t("pdp.imgAria", { n: i + 1 })}
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
              {/* Category links to its crawlable landing page — internal
                  linking + matches the PDP BreadcrumbList structured data. */}
              {product.category ? (
                <Link
                  href={`/category/${product.category.slug}`}
                  className="text-xs font-medium uppercase tracking-wide text-[#3f7d4a] transition hover:underline"
                >
                  {categoryName(product.category.name, product.category.slug, lang)}
                </Link>
              ) : (
                <span className="text-xs font-medium uppercase tracking-wide text-[#3f7d4a]">—</span>
              )}
              {product.featured && (
                <Badge variant="secondary" className="bg-secondary text-brand">
                  {t("card.featured")}
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">
              {product.name}
            </h1>
            {product.productType === "digital" && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#eef5ec] px-3 py-1.5 text-xs font-semibold text-brand">
                <Download className="h-3.5 w-3.5" aria-hidden /> {t("pdp.digitalInstant")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {product.rating > 0 && product.reviewCount > 0 ? (
                <button
                  type="button"
                  onClick={scrollToReviews}
                  className="group/star flex items-center gap-1.5 rounded-md transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28]"
                  aria-label={t("reviews.jumpAria", { n: product.reviewCount })}
                >
                  <Star className="h-4 w-4 fill-[#f9c27d] text-[#f9c27d]" aria-hidden />
                  <span aria-label={t("card.ratedAria", { r: product.rating })}>{product.rating.toFixed(1)}</span>
                  <span className="group-hover/star:underline">· {t("pdp.reviews", { n: product.reviewCount })}</span>
                </button>
              ) : (
                <span
                  className="flex items-center gap-1.5"
                  aria-label={t("pdp.unrated")}
                >
                  <Star className="h-4 w-4 fill-[#f9c27d] text-[#f9c27d]" aria-hidden />
                  {t("pdp.unrated")}
                </span>
              )}
              <span>· {t("pdp.sku", { sku: product.sku ?? "—" })}</span>
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
                {t("pdp.save", { p: discount })}
              </Badge>
            )}
          </div>

          {/* Task 69: formatted descriptions render as rich HTML (sanitized);
              legacy plain-text descriptions render as before, line breaks kept. */}
          {(() => {
            const desc = productDescription(product.description, lang);
            if (looksLikeHtml(desc)) {
              return (
                <div
                  className="rich-description max-w-prose text-sm leading-relaxed text-muted-foreground font-original sm:text-base"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(desc) }}
                />
              );
            }
            return (
              <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-muted-foreground font-original sm:text-base">
                {desc}
              </p>
            );
          })()}

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <Badge key={t} variant="outline" className="border-[#e6e2d4] font-normal text-muted-foreground">
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          {product.productType !== "digital" && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  product.stock > 0 ? "bg-[#3f7d4a]" : "bg-destructive",
                )}
              />
              <span className="text-muted-foreground">
                {product.stock > 5
                  ? t("pdp.stock", { n: product.stock })
                  : product.stock > 0
                    ? t("pdp.lowStock", { n: product.stock })
                    : t("pdp.out")}
              </span>
            </div>
          )}

          {/* Quantity + actions */}
          <div ref={buyBoxRef} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-[#e6e2d4] bg-white">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-brand"
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label={t("pdp.qtyMinus")}
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
                aria-label={t("pdp.qtyPlus")}
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
              <ShoppingBag className="mr-2 h-4 w-4" /> {t("card.add")}
            </Button>

            {/* Buy now — Deep Hayaan Green */}
            <Button
              size="lg"
              className="bg-brand hover:bg-brand-dark"
              onClick={handleBuyNow}
              disabled={adding || product.stock === 0}
            >
              {t("pdp.buyNow")}
            </Button>
          </div>

          {/* Task 90: delivery preview — pick a district, see the fee right
              here (same table the checkout and the order creator use, so the
              number can never drift). Physical products only; digital shows
              its own instant-delivery promise instead. */}
          {product.productType !== "digital" && (
            <div className="rounded-xl border border-[#e6e2d4] bg-white p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-brand-dark">
                <Truck className="h-4 w-4 text-brand" /> {t("pdp.deliveryTitle")}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,230px)_1fr] sm:items-center">
                <Select value={districtChoice || undefined} onValueChange={setDistrictChoice}>
                  <SelectTrigger
                    aria-label={t("pdp.deliverySelectAria")}
                    className="w-full bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                  >
                    <SelectValue placeholder={t("co.districtPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {MOGADISHU_DISTRICTS.map((d) => (
                      <SelectItem key={d.name} value={d.name}>
                        {d.name} — ${d.fee.toFixed(2)}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_CITY}>{t("co.districtOther")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {!districtChoice
                    ? t("pdp.deliveryPick")
                    : districtChoice === OTHER_CITY
                      ? t("pdp.deliveryOutside", { fee: formatPrice(OUTSIDE_MOGADISHU_FEE, product.currency) })
                      : t("pdp.deliveryFee", {
                          district: districtChoice,
                          fee: formatPrice(districtFee(districtChoice) ?? 0, product.currency),
                        })}
                </p>
              </div>
            </div>
          )}

          {/* Reassurance row — digital products swap the delivery promise */}
          <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-[#e6e2d4] bg-[#faf8f1] p-4 text-sm font-original sm:grid-cols-3">
            {product.productType === "digital" ? (
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-brand" />
                {t("pdp.digitalReassure")}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand" />
                {t("pdp.deliveryReassure")}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand" />
              {t("hero.reassure2")}
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-brand" />
              {t("hero.reassure3")}
            </div>
          </div>
        </div>
      </div>

      {/* Task 134 (audit F5): the related-products rail is rendered by the
          SERVER page (page.tsx) — importing the client ProductCard here
          triggered a Turbopack SSR chunk TDZ (chunk circularity), and a
          server-side mini card is lighter anyway. */}

      {/* Ratings & comments (Task 85) — full-width section below the buy
          box; hides itself entirely until the reviews migration is run. */}
      <ProductReviews productId={product.id} />

      {/* Task 134 (audit F6): mobile sticky add-to-cart — thumbnail, name,
          price and the SAME handleAdd (auth gate, toast, drawer) as the buy
          box, so behavior can never drift. Hidden on md+ screens. */}
      {stickyBar && (
        <div
          data-sticky-atc
          className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[#e6e2d4] bg-white/95 p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:hidden"
        >
          <img
            src={product.images[0] ?? "/placeholder.svg"}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 rounded-md border border-[#e6e2d4] bg-[#faf8f1] object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{product.name}</p>
            <p className="text-sm font-bold text-brand">
              {formatPrice(product.price, product.currency)}
            </p>
          </div>
          <Button
            size="sm"
            className="btn-accent"
            onClick={handleAdd}
            disabled={adding || product.stock === 0}
            aria-label={t("pdp.stickyAria")}
          >
            <ShoppingBag className="mr-1.5 h-4 w-4" /> {t("card.add")}
          </Button>
        </div>
      )}
    </div>
  );
}
