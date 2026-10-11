"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { hydrateWishlist, saveToWishlist, unsaveFromWishlist, useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";

/**
 * The wishlist heart (Task 88). Rendered on product cards (top-right of the
 * image) and on the PDP gallery (Amazon's placement). Behavior:
 *  • Guest → opens the auth modal (same gate as add-to-cart; Amazon asks
 *    for sign-in on wishlist use too).
 *  • Signed-in → optimistic toggle, then the server call returns the fresh
 *    list which is written back into the store (one source of truth for the
 *    header badge and the wishlist view).
 *  • Hidden entirely while the signed-in session reports the wishlist table
 *    as missing (pre-migration, same degradation as the reviews section).
 *
 * stopPropagation everywhere: the card root is a click target that
 * navigates to the PDP, and the PDP image area sits under the badge stack.
 */
export function WishlistHeartButton({
  productId,
  productName,
  className,
  iconClassName,
}: {
  productId: string;
  productName: string;
  className?: string;
  iconClassName?: string;
}) {
  const { wishlist, setWishlist, wishlistAvailable, user, setAuthOpen, toast } = useStore();
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const saved = wishlist.some((p) => p.id === productId);

  // Pre-migration degradation (signed-in only): hide hearts entirely until
  // the owner runs 2026-10-11-wishlist.sql — same idea as the reviews
  // section hiding itself. Guests keep seeing hearts (optimistic default).

  if (!wishlistAvailable) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    if (!user) {
      toast(t("wl.signIn"), "default");
      setAuthOpen(true);
      return;
    }
    const prev = useStore.getState().wishlist;
    // Optimistic flip — the heart reacts instantly; the server response
    // below is authoritative and repairs any drift. The optimistic ADD
    // re-uses the product row already in the store (hearts only render on
    // product surfaces, so it's always available).
    if (saved) {
      setWishlist(prev.filter((p) => p.id !== productId));
    } else {
      const product = useStore.getState().products.find((p) => p.id === productId)
        ?? useStore.getState().selectedProduct;
      if (product) setWishlist([product, ...prev.filter((p) => p.id !== productId)]);
    }
    setBusy(true);
    try {
      const list = saved ? await unsaveFromWishlist(productId) : await saveToWishlist(productId);
      setWishlist(list);
      toast(saved ? t("wl.removed") : t("wl.saved"), "success");
    } catch (err) {
      // Revert to the pre-click list and re-sync availability (the failure
      // may be the pre-migration unavailable path).
      await hydrateWishlist().catch(() => setWishlist(prev));
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? t("card.unsaveAria", { name: productName }) : t("card.saveAria", { name: productName })}
      className={cn(
        "group/heart flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        "bg-white/95 shadow-sm ring-1 ring-black/5 backdrop-blur-sm",
        "transition-all duration-150 hover:scale-105 hover:bg-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f28c28]",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn(
          "h-4 w-4 transition-colors",
          saved
            ? "fill-[#f28c28] text-[#f28c28]"
            : "text-foreground/60 group-hover/heart:text-[#f28c28]",
          iconClassName,
        )}
      />
    </button>
  );
}
