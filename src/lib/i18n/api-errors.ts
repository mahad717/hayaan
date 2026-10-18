/**
 * Task 94 — Somali translation completeness pass.
 *
 * The REST API keeps returning English error messages on purpose: they land
 * in logs, support tickets and admin tooling where English is the working
 * language. But several of those strings surface directly in client toasts
 * (`data?.error ?? t(...)`), so a Somali shopper could hit e.g. the raw
 * "Sign in to write a review." after an auth edge case.
 *
 * `localizeApiError()` maps the KNOWN English messages (API bodies + the
 * English fallbacks thrown by src/hooks/use-store.ts) to dictionary keys and
 * returns the translated copy. Unknown / gateway-returned strings fall
 * through untouched (same policy as gateway message bodies: not translated).
 */
import { type DictKey } from "./dictionary";

type TFn = (key: DictKey, vars?: Record<string, string | number>) => string;

const MAP: Record<string, DictKey> = {
  // Auth (src/app/api/auth/*)
  "Invalid email or password.": "err.invalidCreds",
  "Email and password are required.": "err.emailPwRequired",
  "An account with that email already exists.": "err.emailExists",
  "Password must be at least 6 characters.": "err.pwShort",
  "Could not set the password. Please try again.": "err.pwFail",
  "Login failed. Please try again.": "err.generic",
  "Signup failed. Please try again.": "err.generic",

  // Generic sign-in gates
  "Please sign in.": "err.signIn",
  "Please sign in first.": "err.signIn",
  "Sign in first.": "err.signIn",
  "Please sign in to add items to your cart.": "err.signInCart",
  "Please sign in to place an order.": "err.signInOrder",
  "Please sign in to check out.": "err.signInOrder",
  "Please sign in to download your purchase.": "err.signIn",
  "Sign in to write a review.": "err.signInReview",
  "Sign in to save items to your wishlist.": "err.signInWishlist",
  "Sign in to update your wishlist.": "err.signInWishlist",  // Task 115: PATCH /api/wishlist gate

  // Orders / checkout (src/app/api/orders/*, /api/payments/sifalo/*)
  "Order not found": "err.orderNotFound",
  "Please sign in to place an order": "err.signInOrder",
  "Checkout failed": "co.errGeneric",
  "Could not start the checkout": "co.errGeneric",
  "Could not start the checkout.": "co.errGeneric",

  // Cart (src/hooks/use-store.ts fallbacks)
  "Failed to update cart": "err.cartFail",
  "Failed to remove item": "err.cartFail",
  "Failed to clear cart": "err.cartFail",
  "We couldn't find your cart — please refresh and try again.": "err.cartFail",  // Task 115

  // Wishlist (API + hook fallbacks)
  "Failed to save the item": "err.wishlistFail",
  "Failed to save the item.": "err.wishlistFail",
  "Failed to update the wishlist": "err.wishlistFail",
  "Failed to update your wishlist.": "err.wishlistFail",  // Task 115: PATCH fallback text
  "Failed to load your wishlist.": "err.generic",

  // Digital downloads (Task 115: /api/digital/download — the orders-view
  // download button now fetches and toasts, so these MUST be localized)
  "Download not found for this account.": "err.downloadMissing",
  "This download unlocks as soon as your payment is confirmed.": "err.downloadLocked",
  "This item is not a digital download.": "err.notDigital",
  "Could not generate the download link — try again.": "err.downloadFail",
  "This product's download link is misconfigured — please contact support@hayaan.co.": "err.downloadFail",  // Task 115

  // Order validation (Task 115: /api/orders 400s that reach the checkout toast)
  "Please add your full name so we can record the order.": "err.fullName",
  "Please complete your shipping details so we know where to deliver.": "err.shippingDetails",
  "Your cart is empty — add an item before checking out.": "err.cartEmpty",
  "Payments are not configured on this deployment.": "err.payNotConfigured",

  // Misc customer-facing (Task 115)
  "Too many submissions — please try again later.": "err.tooMany",
  "Email, password, and name are required.": "err.emailPwRequired",

  // Reviews (src/app/api/products/[id]/reviews)
  "Rating must be a whole number from 1 to 5.": "err.ratingRange",
  "Failed to load reviews.": "err.generic",
  "Failed to save the review.": "err.generic",
  "You have not reviewed this product.": "err.generic",

  // Account
  "Name cannot be empty.": "err.nameEmpty",
  "SUPABASE_SERVICE_ROLE_KEY is missing at runtime — cannot write the profile.": "err.generic",  // Task 115: misconfig must not leak jargon to the shopper

  // Leads (quote / popup / newsletter / deals forms)
  "Please tell us your name.": "err.tellName",
  "Please describe what you need.": "err.describe",
  "Leave a phone number or email so we can send the quote.": "err.leaveContact",
  "Leave your email or WhatsApp number so we can reach you.": "err.leaveContact",
  "That email address doesn't look right.": "err.emailLooks",
};

/**
 * Translate a known API/hook error message into the active language.
 * Unknown messages pass through unchanged (graceful degradation).
 */
export function localizeApiError(
  msg: string | null | undefined,
  t: TFn,
): string {
  if (!msg) return "";
  const trimmed = msg.trim();
  const key = MAP[trimmed];
  if (key) return t(key);
  // Task 115: the reviews route interpolates the limit into the message
  // ("Comments are limited to 2000 characters.") — match the stable prefix.
  if (trimmed.startsWith("Comments are limited to ")) return t("err.commentLong");
  return msg;
}

/** Convenience for catch blocks: map a thrown Error's message. */
export function localizeThrownError(err: unknown, t: TFn): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return localizeApiError(msg, t);
}
