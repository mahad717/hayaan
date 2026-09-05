"use client";

import { ShoppingBag, Search, User, LogOut, LayoutGrid, Package } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md transition-shadow ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">Mercado</span>
        </button>

        <div className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, brands, categories…"
            className="pl-9 bg-muted/40 border-muted/60"
            aria-label="Search products"
          />
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Button
            variant={view === "home" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("home")}
          >
            Shop
          </Button>
          {user && (
            <Button
              variant={view === "orders" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("orders")}
            >
              <Package className="mr-1 h-4 w-4" /> Orders
            </Button>
          )}
          {user?.role === "admin" && (
            <Button
              variant={view === "admin" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("admin")}
            >
              <LayoutGrid className="mr-1 h-4 w-4" /> Admin
            </Button>
          )}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user ? (
              <>
                <DropdownMenuLabel>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setView("orders")}>
                  <Package className="mr-2 h-4 w-4" /> My Orders
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => setView("admin")}>
                    <LayoutGrid className="mr-2 h-4 w-4" /> Admin Dashboard
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

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setCartOpen(true)}
          aria-label={`Cart with ${cartCount(cart)} items`}
        >
          <ShoppingBag className="h-5 w-5" />
          {cartCount(cart) > 0 && (
            <Badge
              className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-xs"
              variant="default"
            >
              {cartCount(cart)}
            </Badge>
          )}
        </Button>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden border-t bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
          <Button
            variant={view === "home" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("home")}
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
            <Button
              variant={view === "admin" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("admin")}
            >
              Admin
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
