"use client";

import { create } from "zustand";
import type { Cart, CartItem, Order, Product, SafeUser, Category } from "@/lib/types";

// "admin" is a dedicated route (/admin) — not a storefront view.
export type View = "home" | "product" | "cart" | "checkout" | "orders" | "account" | "wishlist";

interface StoreState {
  // Navigation
  view: View;
  setView: (v: View) => void;
  selectedProduct: Product | null;
  openProduct: (p: Product) => void;

  // Catalog
  products: Product[];
  setProducts: (p: Product[]) => void;
  /** True once ProductGrid's catalog fetch has settled. Gates the "Demo mode"
   *  seed callout: bootReady alone left a flash window where the session was
   *  resolved but /api/products was still in flight, so the banner blinked
   *  above the header on every first visit with an empty products array. */
  productsLoaded: boolean;
  setProductsLoaded: (b: boolean) => void;
  categories: Category[];
  setCategories: (c: Category[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  sort: string;
  setSort: (s: string) => void;

  // Auth
  user: SafeUser | null;
  setUser: (u: SafeUser | null) => void;
  authOpen: boolean;
  setAuthOpen: (b: boolean) => void;
  /** True once the session bootstrap (/api/auth/me + /api/cart) has settled.
   *  Gates the "sign in" walls of checkout/orders/account so a deep link like
   *  /?view=checkout renders a neutral loading state instead of flashing
   *  "Please sign in" while the session fetch is still in flight. */
  bootReady: boolean;
  setBootReady: (b: boolean) => void;

  // Cart
  cart: Cart;
  setCart: (c: Cart) => void;
  cartOpen: boolean;
  setCartOpen: (b: boolean) => void;

  // Wishlist (Task 88) — full product rows, newest save first.
  // wishlistAvailable starts optimistic-true: guests see hearts (clicking
  // opens the auth modal, same as the cart). It only flips false when a
  // signed-in GET reports the wishlist_items table is missing — then hearts
  // hide everywhere until the owner runs the migration, mirroring the
  // product-reviews section behavior.
  wishlist: Product[];
  setWishlist: (p: Product[]) => void;
  wishlistAvailable: boolean;
  setWishlistAvailable: (b: boolean) => void;

  // Orders
  orders: Order[];
  setOrders: (o: Order[]) => void;

  // Toasts
  toast: (msg: string, kind?: "default" | "success" | "error") => void;
}

export const useStore = create<StoreState>((set, get) => ({
  view: "home",
  setView: (view) => set({ view }),
  selectedProduct: null,
  openProduct: (p) => set({ selectedProduct: p, view: "product" }),

  products: [],
  setProducts: (products) => set({ products }),
  productsLoaded: false,
  setProductsLoaded: (productsLoaded) => set({ productsLoaded }),
  categories: [],
  setCategories: (categories) => set({ categories }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  activeCategory: "all",
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  sort: "newest",
  setSort: (sort) => set({ sort }),

  user: null,
  setUser: (user) => set({ user }),
  authOpen: false,
  setAuthOpen: (authOpen) => set({ authOpen }),
  bootReady: false,
  setBootReady: (bootReady) => set({ bootReady }),

  cart: { id: "", items: [] },
  setCart: (cart) => set({ cart }),
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),

  wishlist: [],
  setWishlist: (wishlist) => set({ wishlist }),
  wishlistAvailable: true,
  setWishlistAvailable: (wishlistAvailable) => set({ wishlistAvailable }),

  orders: [],
  setOrders: (orders) => set({ orders }),

  toast: (msg, kind = "default") => {
    if (typeof window !== "undefined") {
      // Lazy import to keep server bundle small.
      import("sonner").then(({ toast }) => {
        if (kind === "success") toast.success(msg);
        else if (kind === "error") toast.error(msg);
        else toast(msg);
      });
    }
  },
}));

// Helpers

/**
 * View navigation that works from every route. The storefront views (home /
 * product / checkout / orders / account) are rendered by the home-page SPA,
 * so switching views from an SSR route (/product/[slug], /blog…) must
 * navigate back to "/" with the same ?view= deep link the payment-return
 * page uses. On the home page it behaves like setView, plus a scroll-to-top
 * for non-home views so the target view is actually on screen.
 */
export function goToView(view: View) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/") {
    useStore.getState().setView(view);
    if (view !== "home") window.scrollTo({ top: 0 });
  } else {
    window.location.assign(`/?view=${view}`);
  }
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.quantity, 0);
}

export function cartTotal(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
}

export async function fetchProducts(): Promise<Product[]> {
  // ?limit=500: the API default is 100 and the catalog outgrew it
  // (Task 91 sanguni mobile sync -> 141 products; the tail was invisible).
  const res = await fetch("/api/products?limit=500");
  if (!res.ok) return [];
  const data = await res.json();
  return data.products as Product[];
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) return [];
  const data = await res.json();
  return data.categories as Category[];
}

export async function fetchCart(): Promise<Cart> {
  const res = await fetch("/api/cart", { credentials: "include" });
  if (!res.ok) return { id: "", items: [] };
  const data = await res.json();
  return data.cart as Cart;
}

export async function addToCart(productId: string, quantity = 1, action: "set" | "increment" | "decrement" = "set"): Promise<Cart> {
  const res = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId, quantity, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update cart");
  }
  const data = await res.json();
  return data.cart as Cart;
}

export async function removeFromCart(itemId: string): Promise<Cart> {
  const res = await fetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove item");
  const data = await res.json();
  return data.cart as Cart;
}

export async function clearCart(): Promise<Cart> {
  const res = await fetch("/api/cart?clear=true", { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed to clear cart");
  const data = await res.json();
  return data.cart as Cart;
}

export async function fetchWishlist(): Promise<{ products: Product[]; unavailable: boolean }> {
  const res = await fetch("/api/wishlist", { credentials: "include" });
  if (!res.ok) return { products: [], unavailable: false };
  const data = await res.json();
  return { products: (data.products ?? []) as Product[], unavailable: Boolean(data.unavailable) };
}

/** Save a product to the wishlist; returns the updated list (server truth). */
export async function saveToWishlist(productId: string): Promise<Product[]> {
  const res = await fetch("/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ productId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to save the item");
  }
  const data = await res.json();
  return (data.products ?? []) as Product[];
}

/** Remove a product from the wishlist; returns the updated list. */
export async function unsaveFromWishlist(productId: string): Promise<Product[]> {
  const res = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to update the wishlist");
  }
  const data = await res.json();
  return (data.products ?? []) as Product[];
}

/**
 * Fetch the signed-in user's wishlist into the store and resolve the
 * availability flag. Called from the session bootstrap and after a fresh
 * login/signup. Safe to call for guests (GET returns an empty list).
 */
export async function hydrateWishlist(): Promise<void> {
  const { products, unavailable } = await fetchWishlist();
  useStore.getState().setWishlistAvailable(!unavailable);
  useStore.getState().setWishlist(products);
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders as Order[];
}

export async function placeOrder(
  shipping: { name: string; address: string; city: string; zip: string; country: string },
  paymentMethod: string,
): Promise<{ orderId: string; total: number }> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ shipping, paymentMethod }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Checkout failed");
  }
  return res.json();
}

/** Is Sifalo Pay configured on this deployment? (drives the checkout option) */
export async function fetchSifaloStatus(): Promise<{
  enabled: boolean;
  environment: string;
  returnUrlBase: string | null;
}> {
  const res = await fetch("/api/payments/sifalo", { credentials: "include" });
  if (!res.ok) return { enabled: false, environment: "unknown", returnUrlBase: null };
  return res.json();
}

/**
 * Sifalo Pay hosted checkout: create a PENDING order server-side, get the
 * hosted payment URL, and hand it back — the caller redirects the browser.
 */
export async function startSifaloPayment(
  shipping: { name: string; phone?: string; address: string; city: string; zip: string; country: string },
): Promise<{ redirectUrl: string; orderId: string; total: number }> {
  const res = await fetch("/api/payments/sifalo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ shipping }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Could not start the checkout");
  }
  return res.json();
}
