"use client";

import { Sparkles, ArrowRight, Truck, Shield, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero({ onShop }: { onShop: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-[#e6e2d4] bg-[#faf8f1]">
      {/* Soft botanical gradient — green + apricot wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 50% at 15% 25%, rgba(20,83,45,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 10%, rgba(242,140,40,0.12) 0%, transparent 60%), radial-gradient(40% 40% at 70% 90%, rgba(63,125,74,0.08) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
        {/* Copy */}
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand shadow-sm ring-1 ring-[#e6e2d4]">
            <Sparkles className="h-3.5 w-3.5 text-[#f28c28]" />
            New season · Free shipping over $75
          </span>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-brand-dark sm:text-5xl md:text-6xl">
            Everything you need,
            <br />
            <span className="bg-gradient-to-r from-[#14532d] to-[#3f7d4a] bg-clip-text text-transparent">
              all in one market.
            </span>
          </h1>

          <p className="max-w-prose text-base text-muted-foreground sm:text-lg">
            Hayaan Market brings together curated goods across apparel,
            electronics, home, and beauty — built on Next.js, Supabase, and
            Cloudflare. Browse, add to cart, and check out in under a minute.
          </p>

          {/* CTAs — primary green, secondary outlined green */}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onShop} className="btn-accent group">
              Shop Now
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onShop}
              className="border-brand text-brand hover:bg-brand hover:text-white"
            >
              Explore categories
            </Button>
          </div>

          {/* Reassurance row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-brand" /> Secure checkout
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-brand" /> 30-day returns
            </span>
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-brand" /> Carbon-neutral shipping
            </span>
          </div>
        </div>

        {/* Image collage */}
        <div className="relative">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <img
              src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop"
              alt="Wireless headphones"
              className="aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
            <img
              src="https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&auto=format&fit=crop"
              alt="Linen hoodie"
              className="mt-6 aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
            <img
              src="https://images.unsplash.com/photo-1612196808214-b8d6cd6b1fde?w=600&auto=format&fit=crop"
              alt="Ceramic vase"
              className="aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
            <img
              src="https://images.unsplash.com/photo-1593726852644-9c4ae90db05a?w=600&auto=format&fit=crop"
              alt="Heavyweight sweatshirt"
              className="mt-6 aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
          </div>

          {/* Floating promo chip */}
          <div className="absolute -bottom-3 left-4 hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-md ring-1 ring-[#e6e2d4] sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f28c28]/10 text-[#f28c28]">
              🔥
            </span>
            <span className="font-medium text-foreground">20% OFF</span>
            <span className="text-muted-foreground">first order</span>
          </div>
        </div>
      </div>
    </section>
  );
}
