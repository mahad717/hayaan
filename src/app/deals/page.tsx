import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BellRing, MessageCircle, Zap } from "lucide-react";
import { StoreShell } from "@/components/store/store-shell";
import { DealsSignupForm } from "@/components/store/deals-signup-form";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { isLang, LANG_COOKIE, translate, type DictKey } from "@/lib/i18n/dictionary";

export const metadata: Metadata = {
  title: "Electronics deals & price drops",
  description:
    "Join the Hayaan Market deal list — price drops, restocks and flash offers on phones, laptops, TVs and home appliances, sent to this list first on WhatsApp or email. No spam, leave anytime.",
  alternates: { canonical: "/deals" },
  openGraph: {
    title: "Never miss an electronics deal — Hayaan Market",
    description:
      "Price drops, restocks and flash offers on phones, laptops, TVs and appliances — the deal list hears first. Join free.",
    url: "/deals",
    type: "website",
  },
};

export default async function DealsPage() {
  // SSR in the visitor's language (same cookie mechanism as the storefront).
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  const benefits = [
    { icon: Zap, key: "deals.benefit1" as const },
    { icon: MessageCircle, key: "deals.benefit2" as const },
    { icon: BellRing, key: "deals.benefit3" as const },
  ];

  return (
    <StoreShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="font-panton text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
            {t("deals.heading")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("deals.sub")}
          </p>
        </header>

        <ul className="mx-auto mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">
          {benefits.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="flex items-start gap-2 rounded-xl border border-[#e6e2d4] bg-white p-3 text-xs leading-snug text-foreground/80 shadow-sm"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#f28c28]" />
              {t(key)}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <DealsSignupForm />
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-brand-dark underline-offset-2 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </StoreShell>
  );
}
