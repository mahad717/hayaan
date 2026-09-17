"use client";

import { useState } from "react";
import { Instagram, Twitter, Mail } from "lucide-react";
import { useLang } from "@/components/store/language-provider";
import { useStore } from "@/hooks/use-store";
import { SUPPORT_EMAIL } from "@/lib/support-email";

export function Footer() {
  const { t } = useLang();
  const { toast } = useStore();
  const [nlEmail, setNlEmail] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [nlDone, setNlDone] = useState(false);

  // Footer newsletter (Task 57 lead engine) — one field, zero friction.
  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlEmail.trim()) return;
    setNlBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "newsletter", email: nlEmail.trim(), source: "footer" }),
      });
      if (res.ok) {
        setNlDone(true);
        toast(t("ft.subscribed"), "success");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error ?? t("lead.popupError"), "error");
      }
    } catch {
      toast(t("lead.popupError"), "error");
    } finally {
      setNlBusy(false);
    }
  };
  return (
    <footer className="mt-auto bg-brand-dark text-[#faf8f1]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              {/* Official Hayaan cart mark — orange variant pops on the dark footer */}
              <img src="/hayaan-logo-orange.svg" alt="" aria-hidden="true" className="h-8 w-8" />
              <span className="text-base font-semibold">
                Hayaan <span className="font-normal opacity-70">Market</span>
              </span>
            </div>
            <p className="mt-3 text-sm opacity-70 font-original">
              {t("ft.blurb")}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{t("ft.shop")}</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm opacity-70 font-original">
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.shopAll")}</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.featured")}</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.topRated")}</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.gifts")}</li>
              <li className="transition hover:opacity-100 hover:text-[#f9c27d]">
                <a href="/blog" className="inline-flex items-center gap-1">
                  {t("ft.blog")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{t("ft.support")}</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm opacity-70 font-original">
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.help")}</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.shippingInfo")}</li>
              <li className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.track")}</li>
              <li className="transition hover:opacity-100 hover:text-[#f9c27d]">
                <a href="/quote" className="inline-flex items-center gap-1">
                  {t("ft.bulkOrders")}
                </a>
              </li>
              <li className="transition hover:opacity-100 hover:text-[#f9c27d]">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1">
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{t("ft.stay")}</h3>
            <p className="mt-3 text-sm opacity-70 font-original">
              {t("ft.stayBlurb")}
            </p>
            {nlDone ? (
              <p className="mt-3 text-sm font-medium text-[#f9c27d]">{t("ft.subscribed")}</p>
            ) : (
              <form onSubmit={subscribe} className="mt-3 flex gap-2">
                <input
                  type="email"
                  value={nlEmail}
                  onChange={(e) => setNlEmail(e.target.value)}
                  placeholder={t("ft.newsletterPh")}
                  aria-label={t("ft.subscribe")}
                  autoComplete="email"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 focus:border-[#f28c28] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={nlBusy}
                  className="h-9 shrink-0 rounded-lg bg-[#f28c28] px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {t("ft.subscribe")}
                </button>
              </form>
            )}
            <div className="mt-3 flex gap-2">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 transition hover:border-[#f28c28] hover:bg-[#f28c28] hover:text-white"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs opacity-60 font-original sm:flex-row">
          <p>{t("ft.rights", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-4">
            <span className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.privacy")}</span>
            <span className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.terms")}</span>
            <span className="cursor-pointer transition hover:opacity-100 hover:text-[#f9c27d]">{t("ft.cookies")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
