"use client";

import { useEffect } from "react";
import { useStore } from "@/hooks/use-store";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { CartDrawer } from "@/components/store/cart-drawer";
import { AuthModal } from "@/components/store/auth-modal";

/**
 * Session bootstrap: hydrate the zustand store with the signed-in user and
 * the persisted cart on first mount. Extracted from the home page so the
 * SSR routes (/product/[slug], /blog…) boot the exact same way.
 *
 * Also honors /?q=<term> deep links (used by the WebSite SearchAction
 * structured data) by prefilling the catalog search.
 */
export function useStoreBootstrap() {
  const { setUser, setCart, setSearchQuery } = useStore();

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get("q");
        if (q) setSearchQuery(q);

        const [meRes, cartRes] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/cart", { credentials: "include" }),
        ]);
        if (meRes.ok) {
          const { user } = await meRes.json();
          if (user) setUser(user);
        }
        if (cartRes.ok) {
          const { cart } = await cartRes.json();
          setCart(cart);
        }
      } catch {
        // Network errors are non-fatal — UI still works.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Full storefront chrome for the SSR routes: same header / footer / cart
 * drawer / auth modal as the home SPA, with the session bootstrap included.
 */
export function StoreShell({ children }: { children: React.ReactNode }) {
  useStoreBootstrap();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <AuthModal />
    </div>
  );
}
