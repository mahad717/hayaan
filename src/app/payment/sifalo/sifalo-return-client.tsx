"use client";

// Client actions for the Sifalo Pay return page:
//  • "Check payment again" — re-runs server verification and reloads the page
//    so the server component re-renders with the fresh state.

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLang } from "@/components/store/language-provider";

export function SifaloReturnActions({
  orderId,
  initialState,
}: {
  orderId: string;
  initialState: "pending" | "unknown";
}) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { t } = useLang();

  const checkAgain = async () => {
    setChecking(true);
    setNote(null);
    try {
      const res = await fetch("/api/payments/sifalo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data.state === "paid" || data.state === "failed")) {
        // Verified end-state — reload so the server-rendered result updates.
        window.location.reload();
        return;
      }
      setNote(
        (data?.state === "pending" && t("sf.pendingNote")) ||
          (data?.error ?? t("sf.notConfirmed")),
      );
    } catch {
      setNote(t("ord.verifyNetwork"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={checkAgain}
        disabled={checking}
        className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
        {checking ? t("sf.checking") : initialState === "pending" ? t("sf.checkAgain") : t("sf.checkNow")}
      </button>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
