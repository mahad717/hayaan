"use client";

import { useEffect } from "react";
import { useStore } from "@/hooks/use-store";
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

function SeedCallout() {
  const { products, user } = useStore();
  const [hidden, setHidden] = useHiddenState();
  if (hidden || products.length > 0 || user) return null;
  return (
    <div className="border-b border-[#e6e2d4] bg-[#fef1de] text-[#7a4a14]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
        <p>
          <strong>Demo mode.</strong> No products yet. Click below to seed the catalog with sample data and an admin user.
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
              alert(data?.error ?? "Seeding failed — check the deployment logs.");
            }}
          >
            Seed now
          </button>
          <button
            className="text-xs underline"
            onClick={() => setHidden(true)}
          >
            Dismiss
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

export default function Home() {
  const { view, setView } = useStore();

  // Session (user + cart) bootstrap — shared with the SSR route shells.
  useStoreBootstrap();

  // Deep links like /?view=orders (payment return page "View my orders").
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested && ["home", "product", "checkout", "orders", "account"].includes(requested)) {
      setView(requested as Parameters<typeof setView>[0]);
    }
  }, [setView]);

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
            <ProductGrid />
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
