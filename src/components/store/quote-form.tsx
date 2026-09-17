"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { useLang } from "@/components/store/language-provider";

const INPUT_CLASS =
  "bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20";

/**
 * Bulk-quote request form (Task 57 lead engine) — the storefront analog of
 * Explee's "book a demo": businesses tell us what they need and we come back
 * with a custom price. Stored as a `quote` lead and worked from the admin
 * Leads tab.
 */
export function QuoteForm() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", business: "", phone: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quote",
          name: form.name,
          business: form.business,
          phone: form.phone,
          email: form.email,
          message: form.message,
          source: "quote-page",
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
        <h2 className="text-xl font-semibold text-brand-dark">{t("quote.successTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("quote.successBody")}</p>
        <Button
          variant="outline"
          className="mt-2 border-brand/40 hover:bg-secondary hover:text-brand-dark"
          onClick={() => {
            setForm({ name: "", business: "", phone: "", email: "", message: "" });
            setDone(false);
          }}
        >
          {t("quote.another")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-[#e6e2d4] bg-white p-6 shadow-sm sm:p-8"
    >
      {/* Honeypot — same trap as the popup */}
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
        <Label htmlFor="q-name" className="text-foreground">{t("quote.name")}</Label>
        <Input id="q-name" required value={form.name} onChange={set("name")} placeholder={t("quote.namePh")} autoComplete="name" className={INPUT_CLASS} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="q-business" className="text-foreground">{t("quote.business")}</Label>
          <Input id="q-business" value={form.business} onChange={set("business")} placeholder={t("quote.businessPh")} autoComplete="organization" className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="q-phone" className="text-foreground">{t("quote.phone")}</Label>
          <Input id="q-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder={t("quote.phonePh")} autoComplete="tel" className={INPUT_CLASS} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q-email" className="text-foreground">{t("quote.email")}</Label>
        <Input id="q-email" type="email" value={form.email} onChange={set("email")} placeholder={t("quote.emailPh")} autoComplete="email" className={INPUT_CLASS} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q-items" className="text-foreground">{t("quote.items")}</Label>
        <textarea
          id="q-items"
          required
          value={form.message}
          onChange={set("message")}
          placeholder={t("quote.itemsPh")}
          rows={5}
          className="rounded-md border border-brand/40 bg-[#faf8f1] px-3 py-2 text-sm shadow-sm transition placeholder:text-muted-foreground/70 hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
        <p className="text-xs text-muted-foreground">{t("quote.itemsHint")}</p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" disabled={busy} className="btn-accent mt-1">
        {busy ? t("quote.sending") : t("quote.cta")}
      </Button>
    </form>
  );
}
