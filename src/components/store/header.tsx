"use client";

import { ShoppingBag, Search, User, LogOut, LogIn, LayoutGrid, Package, UserRound, Store, Menu, Newspaper } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const onBlogRoute = pathname?.startsWith("/blog") ?? false;

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

  // Same, from the mobile drawer: close the sheet first and wait out its
  // 300ms close animation so body scroll-lock is released before we scroll.
  const goShopFromMenu = () => {
    setMenuOpen(false);
    setView("home");
    setTimeout(() => {
      document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
  };

  const menuAction = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  const searchInput = (
    <Input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search products, categories, and more…"
      className="border-brand/40 bg-[#faf8f1] pl-9 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20 placeholder:text-muted-foreground/70"
      aria-label="Search products"
    />
  );

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-[#e6e2d4] bg-white/90 backdrop-blur-md transition-shadow ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      {/* Brand row — slightly tighter on phones (h-14) to reclaim vertical space */}
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
        {/* Logo — Deep Hayaan Green */}
        <button
          onClick={() => setView("home")}
          className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight"
          aria-label="Hayaan Market home"
        >
          {/* Official Hayaan cart mark — dark green variant */}
          <img src="/hayaan-logo-green.svg" alt="" aria-hidden="true" className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="text-sm text-brand sm:text-base">
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
            <Button
              asChild
              variant={onBlogRoute ? "secondary" : "ghost"}
              size="sm"
              className={onBlogRoute ? "" : "text-foreground/80 hover:text-brand"}
            >
              <Link href="/blog">
                <Newspaper className="mr-1 h-4 w-4" /> Blog
              </Link>
            </Button>
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
                  <DropdownMenuItem onClick={() => setView("account")}>
                    <UserRound className="mr-2 h-4 w-4" /> My profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("orders")}>
                    <Package className="mr-2 h-4 w-4" /> My orders
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

          {/* Mobile menu — hamburger below md (nav pills live in the drawer) */}
          <Button
            variant="ghost"
            size="icon"
            className="text-brand hover:bg-secondary md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile search row — phones only. Below sm the header's center search
          zone is hidden, so search lives here in a compact dedicated row;
          nav links moved to the hamburger drawer. */}
      <div className="border-t border-[#e6e2d4] bg-white/90 px-4 py-1.5 sm:hidden">
        <div className="relative mx-auto max-w-7xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {searchInput}
        </div>
      </div>

      {/* Mobile navigation drawer (<md): Shop / Orders / Admin + account */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader className="pb-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <img src="/hayaan-logo-green.svg" alt="" aria-hidden="true" className="h-7 w-7" />
              Hayaan Market
            </SheetTitle>
            <SheetDescription>
              {user ? (
                <span className="block truncate">{user.name} · {user.email}</span>
              ) : (
                "Everyday finds, one market"
              )}
            </SheetDescription>
          </SheetHeader>

          <nav className="flex flex-col gap-1 px-3" aria-label="Mobile navigation">
            <Button
              variant={view === "home" ? "secondary" : "ghost"}
              onClick={goShopFromMenu}
              className={view === "home" ? "justify-start" : "justify-start text-foreground/80 hover:text-brand"}
            >
              <Store className="mr-2 h-4 w-4" /> Shop
            </Button>
            {user && (
              <Button
                variant={view === "orders" ? "secondary" : "ghost"}
                onClick={menuAction(() => setView("orders"))}
                className={view === "orders" ? "justify-start" : "justify-start text-foreground/80 hover:text-brand"}
              >
                <Package className="mr-2 h-4 w-4" /> Orders
              </Button>
            )}
            <Button
              asChild
              variant={onBlogRoute ? "secondary" : "ghost"}
              onClick={menuAction(() => {})}
              className={onBlogRoute ? "justify-start" : "justify-start text-foreground/80 hover:text-brand"}
            >
              <Link href="/blog">
                <Newspaper className="mr-2 h-4 w-4" /> Blog
              </Link>
            </Button>
            {user?.role === "admin" && (
              <Button asChild variant="ghost" onClick={menuAction(() => {})} className="justify-start text-foreground/80 hover:text-brand">
                <Link href="/admin">
                  <LayoutGrid className="mr-2 h-4 w-4" /> Admin dashboard
                </Link>
              </Button>
            )}
          </nav>

          <div className="mx-3 border-t border-[#e6e2d4]" aria-hidden="true" />

          <nav className="flex flex-col gap-1 px-3" aria-label="Mobile account">
            {user ? (
              <>
                <Button
                  variant="ghost"
                  onClick={menuAction(() => setView("account"))}
                  className="justify-start text-foreground/80 hover:text-brand"
                >
                  <UserRound className="mr-2 h-4 w-4" /> My profile
                </Button>
                <Button
                  variant="ghost"
                  onClick={menuAction(handleLogout)}
                  className="justify-start text-destructive hover:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={menuAction(() => setAuthOpen(true))}
                className="justify-start text-foreground/80 hover:text-brand"
              >
                <LogIn className="mr-2 h-4 w-4" /> Sign in
              </Button>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
