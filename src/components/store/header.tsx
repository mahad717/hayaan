"use client";

import { ShoppingBag, Search, User, LogOut, LayoutGrid, Package, Leaf } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore, cartCount } from "@/hooks/use-store";
import { useState, useEffect } from "react";

export function Header() {
  const {
    user,
    setAuthOpen,
    cart,
    setCartOpen,
    setView,
    view,
    searchQuery,
    setSearchQuery,
  } = useStore();
  const [q, setQ] = useState(searchQuery);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(q), 250);
    return () => clearTimeout(t);
  }, [q, setSearchQuery]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  };

  // Navigate home and scroll to the catalog. The timeout lets the home view
  // mount first when arriving from product/checkout/orders views.
  const goShop = () => {
    setView("home");
    setTimeout(() => {
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const searchInput = (
    <Input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search products, brands, categories…"
      className="border-[#e6e2d4] bg-[#faf8f1] pl-9 placeholder:text-muted-foreground/70 focus-visible:ring-[#f28c28]"
      aria-label="Search products"
    />
  );

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-[#e6e2d4] bg-white/90 backdrop-blur-md transition-shadow ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {/* Logo — Deep Hayaan Green */}
        <button
          onClick={() => setView("home")}
          className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight"
          aria-label="Hayaan Market home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="hidden text-brand sm:inline">
            Hayaan <span className="font-normal text-foreground/70">Market</span>
          </span>
        </button>

        {/* Search — centered zone that absorbs all free header space, so the
            right-hand controls always sit at the true right edge (no dead
            zone at any viewport width). */}
        <div className="relative hidden min-w-0 flex-1 justify-center px-2 sm:flex">
          <div className="relative w-full max-w-lg">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {searchInput}
          </div>
        </div>

        {/* Right cluster — nav + account + cart, pinned right */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <nav className="hidden items-center gap-1 md:flex">
            <Button
              variant={view === "home" ? "secondary" : "ghost"}
              size="sm"
              onClick={goShop}
              className={view === "home" ? "" : "text-foreground/80 hover:text-brand"}
            >
              Shop
            </Button>
            {user && (
              <Button
                variant={view === "orders" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("orders")}
                className={view === "orders" ? "" : "text-foreground/80 hover:text-brand"}
              >
                <Package className="mr-1 h-4 w-4" /> Orders
              </Button>
            )}
            {user?.role === "admin" && (
              <Button asChild variant="ghost" size="sm" className="text-foreground/80 hover:text-brand">
                <Link href="/admin">
                  <LayoutGrid className="mr-1 h-4 w-4" /> Admin
                </Link>
              </Button>
            )}
          </nav>

          {/* Account dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account menu" className="text-brand hover:bg-secondary">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user ? (
                <>
                  <DropdownMenuLabel>
                    <div className="font-medium text-foreground">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setView("orders")}>
                    <Package className="mr-2 h-4 w-4" /> My Orders
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <LayoutGrid className="mr-2 h-4 w-4" /> Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => setAuthOpen(true)}>
                  <User className="mr-2 h-4 w-4" /> Sign in
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Cart — green icon, orange count badge */}
          <Button
            variant="ghost"
            size="icon"
            className="relative text-brand hover:bg-secondary"
            onClick={() => setCartOpen(true)}
            aria-label={`Cart with ${cartCount(cart)} items`}
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount(cart) > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f28c28] px-1 text-xs font-semibold text-white shadow-sm ring-2 ring-white"
                aria-label={`${cartCount(cart)} items in cart`}
              >
                {cartCount(cart)}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile nav row (below md): search + Shop/Orders/Admin buttons */}
      <div className="border-t border-[#e6e2d4] bg-white/90 md:hidden">
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
          {/* Search moves here on phones, where the header center zone is hidden */}
          <div className="relative mb-2 sm:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {searchInput}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <Button
              variant={view === "home" ? "secondary" : "ghost"}
              size="sm"
              onClick={goShop}
            >
              Shop
            </Button>
            {user && (
              <Button
                variant={view === "orders" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("orders")}
              >
                Orders
              </Button>
            )}
            {user?.role === "admin" && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin">Admin</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
