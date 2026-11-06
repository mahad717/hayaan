"use client";

import dynamic from "next/dynamic";
import { Truck, Shield, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonWithIcon } from "@/components/ui/button-with-icon";
import { useLang } from "@/components/store/language-provider";

// Task 149: framer-motion shipped in every first load just for the hero's
// decorative beams (~50KB, ~500ms of throttled scripting — the 01n-… chunk
// Lighthouse flagged). It is a purely decorative aria-hidden layer, so it
// now loads client-side only, after hydration, and renders nothing until
// then (no layout impact — absolute inset-0 wrapper, no CLS). Same content,
// same animation, zero first-load cost.
const BackgroundBeamsWithCollision = dynamic(
  () =>
    import("@/components/ui/background-beams-with-collision").then(
      (m) => m.BackgroundBeamsWithCollision
    ),
  { ssr: false, loading: () => null }
);

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

      {/* Animated light beams with floor collision (Aceternity
          background-beams-with-collision) — owner swap for the GLSL hills.
          Decorative full-section layer under the copy: brand-green beams fall
          from the top and burst at the hero base. Client-mounted after width
          measure, paused off-screen, reduced-motion safe → SSR/LCP untouched. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <BackgroundBeamsWithCollision className="h-full bg-none md:h-full" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
        {/* Copy */}
        <div className="flex flex-col gap-5">
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

          {/* CTAs — primary sliding-arrow pill (hero-only style), secondary outlined green */}
          <div className="flex flex-wrap items-center gap-3">
            <ButtonWithIcon onClick={onShop}>{t("hero.ctaShop")}</ButtonWithIcon>
            {/* Label flip to white on the brand-green hover fill lives in
                globals.css (.hover\:bg-brand:hover) — a utilities-layer
                hover:text-white! can't win there (important-inverts-layer
                order vs .text-brand). */}
            <Button
              size="lg"
              variant="outline"
              onClick={onShop}
              className="h-12 rounded-full border-brand px-6 text-brand hover:bg-brand hover:text-white"
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

        {/* Hero artwork — owner-provided 3D "online shopping" render
            (Task 140, cache-busted to -v2 in Task 141; owner then replaced
            the bytes twice via GitHub web-UI — current asset is their
            1563x938 cut, and the width/height attrs below are synced to it
            because the stale 1200x770 pair was stretching their image ~7%).
            Task 142: the illustration and the Pay-your-way chip are taken
            apart — on md+ the img floats 48px higher via translate (layout,
            wrapper and chip anchor untouched), so the chip no longer sits
            on the artwork's platform. Mobile keeps the original overlap. */}
        <div className="relative">
          {/* Task 149: mobile gets a 760px cut of the artwork. The full
              1563x938 webp (97KB) served into a ~380px-wide slot wasted
              80.8KB (Lighthouse image-delivery flagged it as the page's
              entire 79KiB opportunity). Same aspect ratio, so the synced
              width/height attrs below stay correct for both sources. */}
          <picture>
            <source
              media="(max-width: 639px)"
              srcSet="/images/hero-shopping-3d-m760.webp"
              type="image/webp"
            />
            <img
              src="/images/hero-shopping-3d-v2.webp"
              alt={t("hero.alt3d")}
              width={1563}
              height={938}
              fetchPriority="high"
              className="w-full h-auto drop-shadow-md md:-translate-y-12"
            />
          </picture>

          {/* Floating promo chip — real payment variety, not a fake discount.
              Deliberately anchored to the wrapper (not the raised img): the
              translate above moves the artwork only, leaving the chip where
              it was — that separation is the point of Task 142. */}
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
