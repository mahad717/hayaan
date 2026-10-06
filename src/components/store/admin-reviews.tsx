"use client";

// Admin → Reviews tab (Task 85). Moderation queue: every customer review,
// newest first, with product context, the star rating, and one-click
// hide/show/delete. Hiding keeps the row (the author still sees it with a
// "hidden" note) but immediately excludes it from the product's public
// aggregate on cards, the PDP, and the JSON-LD.

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/store/stars";
import type { ProductReview } from "@/lib/types";

type AdminReview = ProductReview & {
  product: { name: string; slug: string } | null;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso).slice(0, 10);
  }
}

export function AdminReviews() {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reviews", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (data?.unavailable) {
        setUnavailable(true);
        setReviews([]);
        return;
      }
      if (res.ok) {
        setReviews(data.reviews ?? []);
        setUnavailable(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "hide" | "show" | "delete") => {
    setBusyId(id);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/admin/reviews/${id}`, { method: "DELETE", credentials: "include" })
          : await fetch(`/api/admin/reviews/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ status: action === "hide" ? "hidden" : "approved" }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Action failed.");
        return;
      }
      if (action === "delete") setReviews((prev) => prev.filter((r) => r.id !== id));
      else setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: action === "hide" ? "hidden" : "approved" } : r)));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-[#faf8f1]" />
        ))}
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="mt-6 rounded-lg border border-[#f28c28]/40 bg-[#f28c28]/10 px-4 py-3 text-sm text-[#8a5215]">
        Reviews are not migrated yet — the storefront review section stays hidden and customers cannot post until the SQL below is run in the
        Supabase SQL editor:{" "}
        <code className="ml-1 rounded bg-white/70 px-1.5 py-0.5 text-xs">src/lib/supabase/migrations/2026-10-05-product-reviews.sql</code>
      </div>
    );
  }

  const hiddenCount = reviews.filter((r) => r.status === "hidden").length;
  const visible = showHidden ? reviews : reviews.filter((r) => r.status === "approved");

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          { label: "Total reviews", value: reviews.length, color: "text-brand" },
          { label: "Hidden", value: hiddenCount, color: "text-[#f28c28]" },
          {
            label: "Average rating",
            value:
              reviews.length > 0
                ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
                : "—",
            color: "text-[#3f7d4a]",
          },
        ].map((s) => (
          <Card key={s.label} className="border-[#e6e2d4]">
            <CardContent className="py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hiddenCount > 0 && (
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="h-4 w-4 accent-[#2f6b3c]"
          />
          Show hidden reviews
        </label>
      )}

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-[#e6e2d4] p-6 text-sm text-muted-foreground">
          No customer reviews yet. Reviews appear here the moment shoppers post them from a product page.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((r) => (
            <li key={r.id}>
              <Card className="border-[#e6e2d4]">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} size={14} label={`${r.rating} out of 5`} />
                    {r.status === "hidden" ? (
                      <Badge variant="outline" className="border-[#f28c28]/50 text-[#b05e10]">
                        Hidden
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#3f7d4a]/40 text-brand">
                        Live
                      </Badge>
                    )}
                    {r.verifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-xs text-brand">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified purchase
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-foreground">{r.authorName || "—"}</span>
                    <span className="text-muted-foreground">on</span>
                    {r.product ? (
                      <a
                        href={`/product/${r.product.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        {r.product.name}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">deleted product</span>
                    )}
                  </div>

                  {r.comment && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}

                  <div className="mt-3 flex gap-2">
                    {r.status === "approved" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#f28c28]/50 text-[#b05e10] hover:bg-[#f28c28]/10"
                        onClick={() => act(r.id, "hide")}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
                        Hide
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-brand text-brand hover:bg-brand hover:text-white"
                        onClick={() => act(r.id, "show")}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                        Approve
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm("Permanently delete this review? This cannot be undone.")) act(r.id, "delete");
                      }}
                      disabled={busyId === r.id}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
