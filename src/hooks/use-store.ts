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
  } else if (view === "home") {
    // Task 106: navigate to "/" EXACTLY — never "/?view=home". Every PDP
    // prerenders "/" via Speculation Rules, and prerender ACTIVATION
    // requires the navigation URL to match the prerendered URL; the
    // "?view=home" variant missed the pre-built page and paid a full load
    // every time the logo / wishlist / cart "go shopping" buttons were
    // tapped from an SSR route. view=home is the default view anyway, so
    // the param never carried information.
    window.location.assign("/");
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

// ---------------------------------------------------------------------------
// Guest cart (Task 136) — a localStorage cart for signed-out visitors, so
// "Add to cart" never dead-ends at the auth modal again. The stored rows keep
// a display snapshot (name/price/image) so the drawer renders with zero extra
// requests; the SERVER re-prices every line from the database when the guest
// order is created (see createPendingGuestSifaloOrder) — client totals are
// never trusted. Signing in merges the local rows into the server cart and
// clears the local copy.
// ---------------------------------------------------------------------------

export const GUEST_CART_KEY = "hayaan_guest_cart";
export const GUEST_ORDERS_KEY = "hayaan_guest_orders";
const GUEST_CART_ID = "guest";
const GUEST_MAX_QTY = 99;
const GUEST_MAX_ORDERS = 10;

export interface GuestStoredItem {
  pid: string;
  q: number;
  name: string;
  price: number;
  image: string | null;
  type: "physical" | "digital";
  currency: string;
  slug: string;
}

function readGuestStorage(): GuestStoredItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    const list = raw ? (JSON.parse(raw) as GuestStoredItem[]) : [];
    return (Array.isArray(list) ? list : []).filter(
      (it) => it && typeof it.pid === "string" && typeof it.q === "number",
    );
  } catch {
    return [];
  }
}

function writeGuestStorage(items: GuestStoredItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // Private mode / storage full — the cart simply won't persist.
  }
}

function guestItemToCartItem(it: GuestStoredItem): CartItem {
  return {
    id: `${GUEST_CART_ID}-${it.pid}`,
    productId: it.pid,
    quantity: it.q,
    price: it.price,
    productType: it.type,
    product: {
      id: it.pid,
      name: it.name,
      slug: it.slug,
      description: "",
      price: it.price,
      currency: it.currency,
      stock: 0,
      rating: 0,
      reviewCount: 0,
      images: it.image ? [it.image] : [],
      tags: [],
      featured: false,
      isActive: true,
      categoryId: "",
      productType: it.type,
    },
  };
}

/** Rebuild the guest Cart from localStorage (id "guest", display snapshots). */
export function guestCartFromStorage(): Cart {
  return {
    id: GUEST_CART_ID,
    items: readGuestStorage().map(guestItemToCartItem),
  };
}

/** Add a product to the guest cart (or bump its quantity) and update the store. */
export function guestAddToCart(product: Product, quantity = 1): Cart {
  const items = readGuestStorage();
  const existing = items.find((it) => it.pid === product.id);
  if (existing) {
    existing.q = Math.min(GUEST_MAX_QTY, existing.q + Math.max(1, quantity));
  } else {
    items.push({
      pid: product.id,
      q: Math.min(GUEST_MAX_QTY, Math.max(1, quantity)),
      name: product.name,
      price: product.price,
      image: product.images?.[0] ?? null,
      type: product.productType === "digital" ? "digital" : "physical",
      currency: product.currency ?? "USD",
      slug: product.slug,
    });
  }
  writeGuestStorage(items);
  const cart = guestCartFromStorage();
  useStore.getState().setCart(cart);
  return cart;
}

/** Change a guest line's quantity by `delta` (clamped to 1..99). */
export function guestChangeQty(productId: string, delta: number): Cart {
  const items = readGuestStorage();
  const it = items.find((i) => i.pid === productId);
  if (it) it.q = Math.min(GUEST_MAX_QTY, Math.max(1, it.q + delta));
  writeGuestStorage(items);
  const cart = guestCartFromStorage();
  useStore.getState().setCart(cart);
  return cart;
}

/** Remove a guest line. */
export function guestRemoveItem(productId: string): Cart {
  const items = readGuestStorage().filter((it) => it.pid !== productId);
  writeGuestStorage(items);
  const cart = guestCartFromStorage();
  useStore.getState().setCart(cart);
  return cart;
}

/** Empty the guest cart (used after a successful guest payment). */
export function clearGuestCart(): void {
  writeGuestStorage([]);
  useStore.getState().setCart({ id: "", items: [] });
}

/** Remember a guest order id for the local "Track your order" list (newest first). */
export function rememberGuestOrder(orderId: string): void {
  if (typeof window === "undefined" || !orderId) return;
  try {
    const raw = window.localStorage.getItem(GUEST_ORDERS_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [orderId, ...(Array.isArray(ids) ? ids : [])].filter(
      (id, i, arr) => typeof id === "string" && arr.indexOf(id) === i,
    ).slice(0, GUEST_MAX_ORDERS);
    window.localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal — the order ref is still on the payment return page.
  }
}

export function guestOrderIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_ORDERS_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return (Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string");
  } catch {
    return [];
  }
}

/**
 * Push the local guest cart into the signed-in user's server cart, then drop
 * the local copy. Called from the session bootstrap and right after a fresh
 * login so a visitor who shopped as a guest keeps everything. Best-effort:
 * a failed line is skipped (it will surface as a stock/availability error at
 * checkout), and the cart state always ends on the server truth.
 */
export async function mergeGuestCartIntoServer(): Promise<boolean> {
  const items = readGuestStorage();
  if (items.length === 0) return false;
  for (const it of items) {
    try {
      await addToCart(it.pid, it.q, "increment");
    } catch {
      // Product may have been deactivated since — skip it.
    }
  }
  writeGuestStorage([]);
  try {
    useStore.getState().setCart(await fetchCart());
  } catch {
    useStore.getState().setCart({ id: "", items: [] });
  }
  return true;
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
 * Task 136: guests pass their cart as `items` (the server re-prices every
 * line from the database); signed-in users keep the server-cart path by
 * omitting `items`.
 */
export async function startSifaloPayment(
  shipping: { name: string; phone?: string; address: string; city: string; zip: string; country: string },
  items?: { productId: string; quantity: number }[],
): Promise<{ redirectUrl: string; orderId: string; total: number }> {
  const res = await fetch("/api/payments/sifalo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(items?.length ? { shipping, items } : { shipping }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Could not start the checkout");
  }
  return res.json();
}
