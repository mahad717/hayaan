"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useStore } from "@/hooks/use-store";

type Lead = {
  id: string;
  type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  business: string | null;
  message: string | null;
  source: string;
  status: string;
  createdAt: string;
};

const STATUSES = ["new", "contacted", "won", "lost"] as const;

const STATUS_STYLE: Record<string, string> = {
  new: "bg-[#fef1de] text-[#7a4a14]",
  contacted: "bg-blue-50 text-blue-700",
  won: "bg-green-50 text-green-700",
  lost: "bg-gray-100 text-gray-500",
};

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Admin Leads tab (Task 57 lead engine). Every contact captured on the
 * storefront — newsletter signups, popup joins, bulk-quote requests — lands
 * here with a status pipeline: new -> contacted -> won | lost.
 */
export function AdminLeads() {
  const { toast } = useStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/leads", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't load leads.");
        return;
      }
      setLeads(data.leads ?? []);
    } catch {
      setError("Network error while loading leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    const res = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      setLeads(prev);
      toast("Couldn't update the lead status.", "error");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this lead? This can't be undone.")) return;
    const prev = leads;
    setLeads((ls) => ls.filter((l) => l.id !== id));
    const res = await fetch(`/api/admin/leads?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      setLeads(prev);
      toast("Couldn't delete the lead.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading leads…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#f2d3a4] bg-[#fef1de] p-6 text-sm text-[#7a4a14]">
        <p className="font-semibold">Leads aren't available yet.</p>
        <p className="mt-1">
          {error} If this says the table is missing, run{" "}
          <code className="rounded bg-white/60 px-1">src/lib/supabase/migrations/2026-09-17-leads.sql</code>{" "}
          in the Supabase SQL editor.
        </p>
      </div>
    );
  }

  const newCount = leads.filter((l) => l.status === "new").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {leads.length} lead{leads.length === 1 ? "" : "s"}
          {newCount > 0 ? ` · ${newCount} new` : ""} — newest first. Work them while they're warm:
          WhatsApp or email within a day.
        </p>
        <button
          onClick={load}
          className="rounded-md border border-[#e6e2d4] bg-white px-3 py-1 text-xs font-medium hover:bg-secondary"
        >
          Refresh
        </button>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e6e2d4] bg-white p-10 text-center text-sm text-muted-foreground">
          No leads yet. Newsletter signups, popup joins, and bulk-quote requests will show up here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e6e2d4] bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#e6e2d4] bg-[#faf8f1] text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Reach</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-[#f0ede2] align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {fmtDate(l.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.type === "quote" ? "bg-[#fef1de] text-[#7a4a14]" : "bg-secondary text-foreground/80"
                      }`}
                    >
                      {l.type === "quote" ? "Quote" : "Newsletter"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.name ?? "—"}</p>
                    {l.business && <p className="text-xs text-muted-foreground">{l.business}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.phone && <p className="font-medium">{l.phone}</p>}
                    {l.email && <p className="text-muted-foreground">{l.email}</p>}
                    {!l.phone && !l.email && "—"}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-foreground/80">
                    <p className="line-clamp-3 whitespace-pre-wrap" title={l.message ?? ""}>
                      {l.message ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.source}</td>
                  <td className="px-4 py-3">
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l.id, e.target.value)}
                      className={`cursor-pointer rounded-full px-2 py-1 text-xs font-medium outline-none ${STATUS_STYLE[l.status] ?? "bg-gray-100"}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(l.id)}
                      aria-label="Delete lead"
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
