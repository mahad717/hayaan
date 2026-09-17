// The store's public support / sending email identity (Task 59).
// Customer-facing surfaces (footer contact link, quote page, Organization
// JSON-LD) and the lead-notification defaults all read this. Override with
// NEXT_PUBLIC_SUPPORT_EMAIL if the address ever changes.
export const SUPPORT_EMAIL =
  (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim().toLowerCase() ||
  "support@hayaan.co";
