"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { useLang } from "@/components/store/language-provider";

const INPUT_CLASS =
  "bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20";

// Interest chips — shown localized, stored in English so the owner can
// segment the CSV cleanly when importing into campaign tools.
const INTERESTS: { key: "deals.i1" | "deals.i2" | "deals.i3" | "deals.i4" | "deals.i5" | "deals.i6"; value: string }[] = [
  { key: "deals.i1", value: "Phones" },
  { key: "deals.i2", value: "Laptops & computing" },
  { key: "deals.i3", value: "TV & audio" },
  { key: "deals.i4", value: "Home appliances" },
  { key: "deals.i5", value: "Accessories" },
  { key: "deals.i6", value: "Everything" },
];

/**
 * Deal-alerts signup (the electronics lead magnet) — phone-first capture for
 * the deal list. Every free channel (TikTok bio, Facebook groups, WhatsApp
 * status, giveaway posts) points here; signups land in the admin Leads tab
 * as `deals` leads with the interest stored in the message field.
 */
export function DealsSignupForm() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", phone: "", email: "", interest: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phone.replace(/[^0-9]/g, "").length < 7) {
      setError(t("lead.popupError"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const interest = INTERESTS.find((i) => i.value === form.interest);
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "deals",
          name: form.name || null,
          phone: form.phone,
          email: form.email || null,
          message: interest ? `Interested in: ${interest.value}` : null,
          source: "deals-page",
          website: honeypot.current?.value ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t("lead.popupError"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("lead.popupError"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-[#e6e2d4] bg-white p-8 text-center shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fef1de]">
          <CheckCircle2 className="h-6 w-6 text-[#f28c28]" />
        </span>
        <h2 className="text-xl font-semibold text-brand-dark">{t("deals.successTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("deals.successBody")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-[#e6e2d4] bg-white p-6 shadow-sm sm:p-8"
    >
      {/* Honeypot — same trap as the popup and quote form */}
      <input
        ref={honeypot}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="d-name" className="text-foreground">{t("deals.name")}</Label>
        <Input id="d-name" value={form.name} onChange={set("name")} placeholder={t("deals.namePh")} autoComplete="name" className={INPUT_CLASS} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="d-phone" className="text-foreground">{t("deals.phone")}</Label>
        <Input id="d-phone" type="tel" required value={form.phone} onChange={set("phone")} placeholder={t("deals.phonePh")} autoComplete="tel" className={INPUT_CLASS} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="d-email" className="text-foreground">{t("deals.email")}</Label>
        <Input id="d-email" type="email" value={form.email} onChange={set("email")} placeholder={t("deals.emailPh")} autoComplete="email" className={INPUT_CLASS} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="d-interest" className="text-foreground">{t("deals.interest")}</Label>
        <select
          id="d-interest"
          value={form.interest}
          onChange={set("interest")}
          className="h-9 rounded-md border border-brand/40 bg-[#faf8f1] px-3 text-sm shadow-sm transition hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        >
          <option value="">{t("deals.interestPh")}</option>
          {INTERESTS.map((i) => (
            <option key={i.key} value={i.value}>
              {t(i.key)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" disabled={busy} className="btn-accent mt-1">
        {busy ? t("deals.sending") : t("deals.cta")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">{t("deals.privacy")}</p>
    </form>
  );
}
