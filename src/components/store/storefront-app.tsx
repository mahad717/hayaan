"use client";

import { useEffect, useState } from "react";
import { useStore, type View } from "@/hooks/use-store";
import type { Category, Product } from "@/lib/types";
import { useStoreBootstrap } from "@/components/store/store-shell";
import { Header } from "@/components/store/header";
import { Hero } from "@/components/store/hero";
import { ProductGrid } from "@/components/store/product-grid";
import { ProductDetail } from "@/components/store/product-detail";
import { Checkout } from "@/components/store/checkout";
import { OrdersView } from "@/components/store/orders-view";
import { AccountView } from "@/components/store/account-view";
import { CartDrawer } from "@/components/store/cart-drawer";
import { AuthModal } from "@/components/store/auth-modal";
import { Footer } from "@/components/store/footer";
import { useLang } from "@/components/store/language-provider";

function SeedCallout() {
  const { products, user, productsLoaded, view } = useStore();
  const { t } = useLang();
  const [hidden, setHidden] = useHiddenState();
  // Only meaningful on the catalog view, and only once the catalog fetch has
  // actually settled. Gating on bootReady alone (session bootstrap) left a
  // flash window: session resolved, /api/products still in flight → the
  // initial empty products array made the banner blink above the header on
  // every first visit. Deep links never mount the catalog and stay excluded
  // by the view check below.
  if (hidden || !productsLoaded || view !== "home" || products.length > 0 || user) return null;
  return (
    <div className="border-b border-[#e6e2d4] bg-[#fef1de] text-[#7a4a14]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
        <p>
          <strong>{t("seed.demo")}</strong> {t("seed.body")}
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-[#f28c28] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            onClick={async () => {
              const res = await fetch("/api/seed", { method: "POST" });
              if (res.ok) {
                window.location.reload();
                return;
              }
              const data = await res.json().catch(() => null);
              alert(data?.error ?? t("seed.fail"));
            }}
          >
            {t("seed.now")}
          </button>
          <button
            className="text-xs underline"
            onClick={() => setHidden(true)}
          >
            {t("seed.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

function useHiddenState() {
  const hidden = typeof window !== "undefined" && window.sessionStorage.getItem("seed-dismissed") === "1";
  const setHidden = (v: boolean) => {
    if (v) window.sessionStorage.setItem("seed-dismissed", "1");
    else window.sessionStorage.removeItem("seed-dismissed");
    window.location.reload();
  };
  return [hidden, setHidden] as const;
}

// Views that may arrive via the /?view= deep link (same list the payment
// return page and goToView use).
const VALID_VIEWS: readonly string[] = ["home", "product", "checkout", "orders", "account"];

/**
 * The storefront SPA. The wrapping server page (src/app/page.tsx) reads the
 * real `?view=` search param per request and hands it down as viewParam —
 * required because zustand v5's SSR snapshot always returns the store's
 * INITIAL state ("home"), so the store alone can never carry the deep-linked
 * view into the server-rendered HTML.
 */
export function StorefrontApp({
  viewParam,
  initialProducts,
  initialCategories,
}: {
  viewParam?: string;
  /** Server-fetched catalog from the home page (page.tsx) — rendered into the
   *  first HTML so product cards paint immediately, before JS/hydration.
   *  Undefined keeps the grid on its client-side /api fetch path. */
  initialProducts?: Product[];
  initialCategories?: Category[];
}) {
  const initialView: View =
    viewParam && VALID_VIEWS.includes(viewParam) ? (viewParam as View) : "home";

  // Seed the client store so every setView consumer (header, cart drawer,
  // checkout…) starts on the URL-derived view. This must run for the no-param
  // case too: the store is a module-level singleton that survives client-side
  // navigation, so arriving here from /product/[slug] (whose mount mirrors
  // view:"product" into the store) or /admin otherwise re-renders the stale
  // view after hydration — the "Back to shop needs two clicks" bug. Server-side
  // this is a no-op: the SSR snapshot reads getInitialState(), and the render
  // below trusts initialView until the store is hydrated anyway.
  useState(() => {
    if (typeof window !== "undefined") {
      useStore.setState({ view: initialView });
    }
  });

  const storeView = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  // Render the URL-derived view through SSR and the hydration paint; switch
  // to the live store only after mount. useSyncExternalStore's first client
  // render still evaluates the server snapshot ("home"), so trusting it
  // earlier would paint the homepage for one frame — the redirect flash.
  const [storeHydrated, setStoreHydrated] = useState(false);
  useEffect(() => setStoreHydrated(true), []);
  const view = storeHydrated ? storeView : initialView;

  // Session (user + cart) bootstrap — shared with the SSR route shells.
  useStoreBootstrap();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SeedCallout />
      <Header />
      <main className="flex-1">
        {view === "home" && (
          <>
            <Hero onShop={() => {
              document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
            }} />
            <ProductGrid initialProducts={initialProducts} initialCategories={initialCategories} />
          </>
        )}
        {view === "product" && <ProductDetail />}
        {view === "checkout" && <Checkout />}
        {view === "orders" && <OrdersView />}
        {view === "account" && <AccountView />}
      </main>
      <Footer />

      <CartDrawer />
      <AuthModal />
    </div>
  );
}
