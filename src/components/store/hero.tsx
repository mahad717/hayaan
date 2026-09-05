"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero({ onShop }: { onShop: () => void }) {
  return (
    <section className="relative overflow-hidden border-b">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 20%, hsl(150 60% 92%) 0%, transparent 60%), radial-gradient(60% 60% at 80% 0%, hsl(35 90% 92%) 0%, transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> New season · Free shipping over $75
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Curated goods,
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-amber-500 bg-clip-text text-transparent">
              honest prices.
            </span>
          </h1>
          <p className="max-w-prose text-base text-muted-foreground sm:text-lg">
            A modern storefront built on Next.js, Supabase-ready auth, and a Prisma
            data layer. Browse the catalog, manage your cart, and check out in
            under a minute.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onShop}>
              Shop the catalog
            </Button>
            <a
              href="https://supabase.com/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium underline-offset-4 hover:underline self-center"
            >
              Read the Supabase docs →
            </a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
            <span>✓ Secure checkout</span>
            <span>✓ 30-day returns</span>
            <span>✓ Carbon-neutral shipping</span>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <img
              src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop"
              alt="Wireless headphones"
              className="aspect-square w-full rounded-2xl object-cover shadow-sm"
            />
            <img
              src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&auto=format&fit=crop"
              alt="Linen hoodie"
              className="mt-6 aspect-square w-full rounded-2xl object-cover shadow-sm"
            />
            <img
              src="https://images.unsplash.com/photo-1612196808214-b8d6cd6b1fde?w=600&auto=format&fit=crop"
              alt="Ceramic vase"
              className="aspect-square w-full rounded-2xl object-cover shadow-sm"
            />
            <img
              src="https://images.unsplash.com/photo-1593726852644-9c4ae90db05a?w=600&auto=format&fit=crop"
              alt="Heavyweight sweatshirt"
              className="mt-6 aspect-square w-full rounded-2xl object-cover shadow-sm"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
