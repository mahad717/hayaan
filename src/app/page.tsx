import { StorefrontApp } from "@/components/store/storefront-app";

// Awaiting searchParams makes this route render dynamically per request, so
// the ?view= deep link (Buy now / Proceed-to-checkout redirects, payment
// return "View my orders") reaches the SSR HTML. The client storefront then
// renders the requested view on the very first paint — no homepage flash.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewParam = typeof params.view === "string" ? params.view : undefined;
  return <StorefrontApp viewParam={viewParam} />;
}
