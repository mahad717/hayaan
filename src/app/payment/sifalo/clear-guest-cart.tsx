"use client";

// Task 136 (guest checkout): rendered by the /payment/sifalo success card on
// a GUEST return. The local cart snapshot the visitor checked out with is now
// paid-for stock — drop it so the storefront doesn't show it again. Storage
// only: no server calls here, and the guest order id stays in the local
// registry so "Track your order" keeps showing the purchase.

import { useEffect } from "react";
import { clearGuestCart } from "@/hooks/use-store";

export function ClearGuestCart() {
  useEffect(() => {
    clearGuestCart();
  }, []);
  return null;
}
