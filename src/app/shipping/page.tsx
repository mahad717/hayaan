import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Download, MapPin, Wallet } from "lucide-react";
import { StoreShell } from "@/components/store/store-shell";
import { MOGADISHU_DISTRICTS, OUTSIDE_MOGADISHU_FEE } from "@/lib/shipping";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { isLang, LANG_COOKIE, translate, type DictKey } from "@/lib/i18n/dictionary";

// Task 136 / audit F4: "Shipping info" used to be a dead footer span. This
// page is DATA-DRIVEN from the same fee table the checkout charges
// (MOGADISHU_DISTRICTS in lib/shipping.ts) — the numbers here can never
// drift from what the customer actually pays.

export const metadata: Metadata = {
  title: "Shipping info — delivery areas & fees",
  description:
    "Delivery fees for every Mogadishu district, the flat fee outside Mogadishu, and how digital delivery works at Hayaan Market.",
  alternates: { canonical: "/shipping" },
};

function usd(n: number) {
  return `$${n.toFixed(2)}`;
}

export default async function ShippingPage() {
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const so = lang === "so";

  const rows = [...MOGADISHU_DISTRICTS].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <StoreShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-legal-page="shipping">
        <h1 className="font-panton text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
          {t("ship.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("ship.intro")}
        </p>

        {/* How delivery is charged — three facts that match checkout exactly */}
        <ul className="mt-6 grid gap-2 sm:grid-cols-3">
          <li className="flex items-start gap-2 rounded-xl border border-[#e6e2d4] bg-white p-3 text-xs leading-snug text-foreground/80 shadow-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#f28c28]" />
            {t("ship.factDistrict")}
          </li>
          <li className="flex items-start gap-2 rounded-xl border border-[#e6e2d4] bg-white p-3 text-xs leading-snug text-foreground/80 shadow-sm">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#f28c28]" />
            {t("ship.factOutside", { fee: usd(OUTSIDE_MOGADISHU_FEE) })}
          </li>
          <li className="flex items-start gap-2 rounded-xl border border-[#e6e2d4] bg-white p-3 text-xs leading-snug text-foreground/80 shadow-sm">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-[#f28c28]" />
            {t("ship.factDigital")}
          </li>
        </ul>

        {/* The live fee table — sorted alphabetically, straight from the
            constants the checkout uses */}
        <div className="mt-8 overflow-x-auto rounded-xl border border-[#e6e2d4]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#faf8f1]">
                <th className="border-b border-[#e6e2d4] px-4 py-3 font-semibold text-brand-dark">
                  {t("ship.colDistrict")}
                </th>
                <th className="border-b border-[#e6e2d4] px-4 py-3 font-semibold text-brand-dark">
                  {t("ship.colFee")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.name}>
                  <td className="border-b border-[#e6e2d4]/60 px-4 py-2.5 text-foreground">{d.name}</td>
                  <td className="border-b border-[#e6e2d4]/60 px-4 py-2.5 font-medium text-brand">{usd(d.fee)}</td>
                </tr>
              ))}
              <tr className="bg-[#faf8f1]/60">
                <td className="px-4 py-2.5 text-foreground">{t("ship.outsideRow")}</td>
                <td className="px-4 py-2.5 font-medium text-brand">{usd(OUTSIDE_MOGADISHU_FEE)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("ship.tableNote")}</p>

        <div className="mt-8 flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-brand-dark">{t("ship.whenTitle")}</h2>
          <p className="text-sm leading-relaxed text-foreground/80">{t("ship.whenBody")}</p>
          <p className="text-sm leading-relaxed text-foreground/80">{t("ship.contactBody")}</p>
        </div>

        <p className="mt-10 rounded-xl border border-[#e6e2d4] bg-[#faf8f1] px-4 py-3 text-sm text-muted-foreground">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-dark underline-offset-2 hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </article>
    </StoreShell>
  );
}
