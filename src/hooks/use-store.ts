"use client";

import { create } from "zustand";
import type { Cart, CartItem, Order, Product, SafeUser, Category } from "@/lib/types";

// "admin" is a dedicated route (/admin) — not a storefront view.
export type View = "home" | "product" | "cart" | "checkout" | "orders" | "account";

interface StoreState {
  // Navigation
  view: View;
  setView: (v: View) => void;
  selectedProduct: Product | null;
  openProduct: (p: Product) => void;

  // Catalog
  products: Product[];
  setProducts: (p: Product[]) => void;
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

  // Cart
  cart: Cart;
  setCart: (c: Cart) => void;
  cartOpen: boolean;
  setCartOpen: (b: boolean) => void;

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

  cart: { id: "", items: [] },
  setCart: (cart) => set({ cart }),
  cartOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),

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
export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.quantity, 0);
}

export function cartTotal(cart: Cart): number {
  return cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
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
