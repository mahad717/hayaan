"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { useLang } from "@/components/store/language-provider";
import { localizeApiError } from "@/lib/i18n/api-errors";

const INPUT_CLASS =
  "bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20";

const TICKET_SIZES = [
  "Under $10k",
  "$10k – $50k",
  "$50k – $250k",
  "$250k – $1M",
  "$1M+",
  "Prefer not to say",
];

const INVESTOR_TYPES = [
  "Angel investor",
  "Venture fund",
  "Family office",
  "Strategic / corporate",
  "Other",
];

/**
 * Investor expression-of-interest form (Task 128). Stored as an `investor`
 * lead in the same pipeline the admin already works (Leads tab + email
 * notification). The ticket size and investor type ride in the message body
 * — no schema change, fully visible in the admin tab and the owner email.
 */
export function InvestorForm() {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    investorType: INVESTOR_TYPES[0],
    ticket: TICKET_SIZES[1],
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const composed = [
        `Ticket size: ${form.ticket}`,
        `Investor type: ${form.investorType}`,
        form.message ? `\n${form.message}` : "",
      ]
        .join("\n")
        .slice(0, 4000);
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "investor",
          name: form.name,
          email: form.email,
          phone: form.phone,
          business: form.organization,
          message: composed,
          source: "investors-page",
          website: honeypot.current?.value ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(localizeApiError(data?.error, t) || t("lead.popupError"));
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
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#14532d]/10">
          <CheckCircle2 className="h-6 w-6 text-[#14532d]" />
        </span>
        <h2 className="text-xl font-semibold text-brand-dark">Interest received</h2>
        <p className="text-sm text-muted-foreground">
          Thank you — the founding team will reach out within two business days with the deck and a
          time for an intro call.
        </p>
        <Button
          variant="outline"
          className="mt-2 border-brand/40 hover:bg-secondary hover:text-brand-dark"
          onClick={() => {
            setForm({
              name: "", email: "", phone: "", organization: "",
              investorType: INVESTOR_TYPES[0], ticket: TICKET_SIZES[1], message: "",
            });
            setDone(false);
          }}
        >
          Submit another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-[#e6e2d4] bg-white p-6 shadow-sm sm:p-8"
    >
      {/* Honeypot — same trap as every other lead form */}
      <input
        ref={honeypot}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-name" className="text-foreground">Full name *</Label>
          <Input id="inv-name" required value={form.name} onChange={set("name")} placeholder="Amina Ahmed" autoComplete="name" className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-org" className="text-foreground">Firm / organization</Label>
          <Input id="inv-org" value={form.organization} onChange={set("organization")} placeholder="Fund, family office, or independent" autoComplete="organization" className={INPUT_CLASS} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-email" className="text-foreground">Email *</Label>
          <Input id="inv-email" type="email" required value={form.email} onChange={set("email")} placeholder="you@fund.com" autoComplete="email" className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-phone" className="text-foreground">Phone / WhatsApp</Label>
          <Input id="inv-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+252 …" autoComplete="tel" className={INPUT_CLASS} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-type" className="text-foreground">Investor type</Label>
          <select
            id="inv-type"
            value={form.investorType}
            onChange={set("investorType")}
            className={`h-9 rounded-md border bg-[#faf8f1] px-3 py-1 text-sm shadow-sm transition hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${"border-brand/40"}`}
          >
            {INVESTOR_TYPES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="inv-ticket" className="text-foreground">Intended ticket size</Label>
          <select
            id="inv-ticket"
            value={form.ticket}
            onChange={set("ticket")}
            className={`h-9 rounded-md border bg-[#faf8f1] px-3 py-1 text-sm shadow-sm transition hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${"border-brand/40"}`}
          >
            {TICKET_SIZES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="inv-message" className="text-foreground">Anything you want us to know?</Label>
        <textarea
          id="inv-message"
          value={form.message}
          onChange={set("message")}
          placeholder="Questions, theses, timelines, references — optional."
          rows={4}
          maxLength={2000}
          className="rounded-md border border-brand/40 bg-[#faf8f1] px-3 py-2 text-sm shadow-sm transition placeholder:text-muted-foreground/70 hover:border-brand/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" disabled={busy} className="btn-accent mt-1">
        {busy ? "Submitting…" : "Request the investor deck"}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Submitting this form is an expression of interest only. It is not an offer to sell — or a
        solicitation of an offer to buy — securities in any jurisdiction; any investment will be
        subject to due diligence and definitive agreements.
      </p>
    </form>
  );
}
