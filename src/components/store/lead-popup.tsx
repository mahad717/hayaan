"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PartyPopper } from "lucide-react";
import { useLang } from "@/components/store/language-provider";

const SEEN_KEY = "hayaan_offer_seen";
const SHOW_AFTER_MS = 18_000; // let the visitor look around first
const AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // re-ask at most weekly

const INPUT_CLASS =
  "bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20";

/**
 * Offer popup (Task 57 lead engine) — the on-site equivalent of Explee's
 * "get hot leads" hook: trade a soft offer for a reachable contact point.
 * Fires once per visit after a delay, then at most once a week (localStorage),
 * and never for visitors who already joined or explicitly declined.
 */
export function LeadPopup() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    try {
      const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0);
      if (Date.now() - seen < AGAIN_AFTER_MS) return;
      timer = setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    } catch {
      // Private mode may block localStorage — still show, but rely on the
      // in-memory `done` state for the rest of this page view.
      timer = setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    }
    return () => clearTimeout(timer);
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      /* non-fatal */
    }
  };

  const dismiss = () => {
    markSeen();
    setOpen(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setError(t("lead.popupContactHint"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "newsletter",
          email: email.trim() || null,
          phone: phone.trim() || null,
          source: "popup",
          website: honeypot.current?.value ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t("lead.popupError"));
        return;
      }
      setDone(true);
      markSeen();
    } catch {
      setError(t("lead.popupError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fef1de]">
              <PartyPopper className="h-6 w-6 text-[#f28c28]" />
            </span>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-semibold text-brand-dark">
                {t("lead.popupSuccessTitle")}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t("lead.popupSuccessBody")}
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)} className="btn-accent mt-2">
              {t("lead.popupNoThanks")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-semibold text-brand-dark">
                {t("lead.popupTitle")}
              </DialogTitle>
              <DialogDescription className="text-center">{t("lead.popupBody")}</DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="flex flex-col gap-3 pt-1">
              {/* Honeypot — visually hidden, ignored by humans, tempting to bots */}
              <input
                ref={honeypot}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("lead.popupEmailPh")}
                autoComplete="email"
                className={INPUT_CLASS}
              />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("lead.popupPhonePh")}
                autoComplete="tel"
                className={INPUT_CLASS}
              />
              <p className="text-xs text-muted-foreground">{error ?? t("lead.popupContactHint")}</p>
              <Button type="submit" disabled={busy} className="btn-accent mt-1">
                {busy ? "…" : t("lead.popupCta")}
              </Button>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {t("lead.popupNoThanks")}
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
