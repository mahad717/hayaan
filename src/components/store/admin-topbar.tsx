"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, LogOut, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SafeUser } from "@/lib/types";

/**
 * Slim top bar exclusive to the /admin area.
 * Deliberately different chrome from the storefront — no search,
 * no cart — so the admin context is always obvious.
 */
export function AdminTopbar({ user }: { user: SafeUser }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#e6e2d4] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-brand"
            aria-label="Back to Hayaan Market storefront"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">
              Hayaan <span className="font-normal text-foreground/70">Market</span>
            </span>
          </Link>
          <span className="text-foreground/30" aria-hidden>/</span>
          <span className="text-sm font-medium text-foreground/80">Admin</span>
          <Badge variant="secondary" className="hidden sm:inline-flex">Dashboard</Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground md:inline">
            {user.name} · {user.email}
          </span>
          <Button asChild variant="ghost" size="sm" className="text-foreground/80 hover:text-brand">
            <Link href="/">
              <Store className="mr-1 h-4 w-4" /> Back to store
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
