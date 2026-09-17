"use client";

import { Sparkles, ArrowRight, Truck, Shield, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/store/language-provider";

export function Hero({ onShop }: { onShop: () => void }) {
  const { t } = useLang();
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
            {t("hero.badge")}
          </span>

          <h1 className="text-4xl font-black font-panton leading-tight tracking-tight text-brand-dark sm:text-5xl md:text-6xl">
            {t("hero.title1")}
            <br />
            <span className="bg-gradient-to-r from-[#14532d] to-[#3f7d4a] bg-clip-text text-transparent">
              {t("hero.title2")}
            </span>
          </h1>

          <p className="max-w-prose text-base text-muted-foreground font-original sm:text-lg">
            {t("hero.sub")}
          </p>

          {/* CTAs — primary green, secondary outlined green */}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={onShop} className="btn-accent group">
              {t("hero.ctaShop")}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            {/* Label flip to white on the brand-green hover fill lives in
                globals.css (.hover\:bg-brand:hover) — a utilities-layer
                hover:text-white! can't win there (important-inverts-layer
                order vs .text-brand). */}
            <Button
              size="lg"
              variant="outline"
              onClick={onShop}
              className="border-brand text-brand hover:bg-brand hover:text-white"
            >
              {t("hero.ctaCategories")}
            </Button>
          </div>

          {/* Reassurance row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground font-original">
            <span className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-brand" /> {t("hero.reassure1")}
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-brand" /> {t("hero.reassure2")}
            </span>
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5 text-brand" /> {t("hero.reassure3")}
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
              src="https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725484435-41dd6a71-ae1e-46f7-a413-a46102279bae.jpg"
              alt="Matte black ceramic vase"
              className="aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
            <img
              src="https://mqyhgyakhfhuctnvezby.supabase.co/storage/v1/object/public/product-images/1788725481334-42782eff-9837-4cf2-bb56-70377b7f2df7.jpg"
              alt="Heavyweight sweatshirt"
              className="mt-6 aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-black/5"
            />
          </div>

          {/* Floating promo chip — real payment variety, not a fake discount */}
          <div className="absolute -bottom-3 left-4 hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-md ring-1 ring-[#e6e2d4] sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f28c28]/10 text-[#f28c28]">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="font-medium text-foreground">{t("hero.payYourWay")}</span>
            <span className="text-muted-foreground">{t("hero.payMethods")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
