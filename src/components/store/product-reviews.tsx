"use client";

// PDP "Ratings & reviews" section (Task 85). Self-contained: fetches the
// product's reviews from /api/products/[id]/reviews on mount, renders the
// summary + distribution, the write/edit form, and the approved list.
//
// Pre-migration behavior: the API returns `unavailable: true` until the owner
// runs 2026-10-05-product-reviews.sql — the section then renders NOTHING on
// the storefront (no broken UI, no console noise) while the admin dashboard
// carries the migration hint.

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Stars, StarInput } from "@/components/store/stars";
import { useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";
import { cn } from "@/lib/utils";
import type { ProductReview, ReviewSummary } from "@/lib/types";

interface ReviewsPayload {
  reviews: ProductReview[];
  summary: ReviewSummary;
  myReview: ProductReview | null;
  canReview: boolean;
  unavailable?: boolean;
}

function formatDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleDateString(lang === "so" ? "so-SO" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return new Date(iso).toISOString().slice(0, 10);
  }
}

export function ProductReviews({ productId }: { productId: string }) {
  const { user, setAuthOpen, toast } = useStore();
  const { t, lang } = useLang();

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, { credentials: "include" });
      const data: ReviewsPayload = await res.json();
      if (data.unavailable) {
        setUnavailable(true);
        return;
      }
      setReviews(data.reviews ?? []);
      setSummary(data.summary ?? null);
      setMyReview(data.myReview ?? null);
      // Prefill the form with the author's existing review (edit mode).
      if (data.myReview) {
        setRating(data.myReview.rating);
        setComment(data.myReview.comment);
      }
    } catch {
      // Network hiccup — keep the section skeleton-free but silent.
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const submit = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (rating < 1) {
      toast(t("reviews.needStars"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? t("reviews.error"), "error");
        return;
      }
      toast(t("reviews.posted"), "success");
      setMyReview(data.review);
      setSummary(data.summary);
      // Repaint the list with the fresh aggregate without a refetch round-trip.
      setReviews((prev) => {
        const rest = prev.filter((r) => r.id !== data.review.id);
        return [data.review as ProductReview, ...rest];
      });
    } catch {
      toast(t("reviews.error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const removeMine = async () => {
    if (!myReview || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast(data?.error ?? t("reviews.error"), "error");
        return;
      }
      setMyReview(null);
      setRating(0);
      setComment("");
      setSummary(data.summary ?? null);
      setReviews((prev) => prev.filter((r) => r.id !== myReview.id));
      toast(t("reviews.deleted"), "success");
    } catch {
      toast(t("reviews.error"), "error");
    } finally {
      setDeleting(false);
    }
  };

  if (unavailable) return null;

  const count = summary?.count ?? 0;
  const average = summary?.average ?? 0;
  const distribution = summary?.distribution ?? {};

  return (
    <section id="pdp-reviews" className="mt-12 border-t border-[#e6e2d4] pt-8" aria-label={t("reviews.title")}>
      <h2 className="text-xl font-semibold tracking-tight text-brand-dark sm:text-2xl">{t("reviews.title")}</h2>

      {loading ? (
        <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
          <Skeleton className="h-40 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
          {/* Summary column */}
          <div>
            <div className="rounded-2xl border border-[#e6e2d4] bg-[#faf8f1] p-5">
              <div className="flex items-end gap-3">
                <span className="text-4xl font-semibold leading-none text-brand-dark">{average > 0 ? average.toFixed(1) : "—"}</span>
                <div className="pb-0.5">
                  <Stars value={average} size={16} label={t("reviews.summaryAria", { r: average, n: count })} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {count > 0 ? t("reviews.countOther", { n: count }) : t("reviews.none")}
                  </p>
                </div>
              </div>

              {/* Distribution bars — only meaningful with reviews */}
              {count > 0 && (
                <div className="mt-4 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = distribution[String(star)] ?? 0;
                    const pct = count > 0 ? Math.round((n / count) * 100) : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-3 text-right tabular-nums">{star}</span>
                        <Star4px />
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6e2d4]">
                          <div className="h-full rounded-full bg-[#f9c27d]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 tabular-nums">{n}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Write / edit form */}
            <div className="mt-4">
              {!user ? (
                <Button variant="outline" className="w-full border-brand text-brand hover:bg-brand hover:text-white" onClick={() => setAuthOpen(true)}>
                  <PenLine className="mr-1.5 h-4 w-4" /> {t("reviews.signInPrompt")}
                </Button>
              ) : (
                <div className="rounded-2xl border border-[#e6e2d4] bg-white p-4">
                  <p className="text-sm font-medium text-foreground">
                    {myReview ? t("reviews.editTitle") : t("reviews.write")}
                  </p>
                  {myReview?.status === "hidden" && (
                    <p className="mt-1 rounded-md bg-[#fef1de] px-2 py-1 text-xs text-[#8a5215]">{t("reviews.hiddenNote")}</p>
                  )}
                  <div className="mt-3">
                    <span className="mb-1.5 block text-xs text-muted-foreground">{t("reviews.yourRating")}</span>
                    <StarInput value={rating} onChange={setRating} ariaLabelFor={(n) => t("reviews.rateAria", { n })} />
                  </div>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("reviews.placeholder")}
                    rows={3}
                    maxLength={2000}
                    className="mt-3 resize-none"
                    aria-label={t("reviews.commentAria")}
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Button className="btn-accent flex-1" onClick={submit} disabled={submitting}>
                      {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PenLine className="mr-1.5 h-4 w-4" />}
                      {myReview ? t("reviews.update") : t("reviews.submit")}
                    </Button>
                    {myReview && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={removeMine}
                        disabled={deleting}
                        aria-label={t("reviews.delete")}
                      >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  {myReview && <p className="mt-2 text-xs text-muted-foreground">{t("reviews.editHint")}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Review list */}
          <div>
            {count === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#e6e2d4] p-6 text-sm text-muted-foreground">
                {t("reviews.empty")}
              </p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <Card className="border-[#e6e2d4]">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Stars value={r.rating} size={14} label={t("reviews.summaryAria", { r: r.rating, n: 1 })} />
                          <span className="text-sm font-medium text-foreground">
                            {myReview?.id === r.id ? t("reviews.you") : r.authorName || "—"}
                          </span>
                          {r.verifiedPurchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef5ec] px-2 py-0.5 text-[11px] font-medium text-brand">
                              <BadgeCheck className="h-3 w-3" aria-hidden />
                              {t("reviews.verified")}
                            </span>
                          )}
                          <span className={cn("ml-auto text-xs text-muted-foreground")}>{formatDate(r.createdAt, lang)}</span>
                        </div>
                        {r.comment && (
                          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{r.comment}</p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Tiny 4px star glyph for the distribution rows. */
function Star4px() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="#f9c27d" aria-hidden className="shrink-0">
      <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7L12 2z" />
    </svg>
  );
}
