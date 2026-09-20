import { StorefrontApp } from "@/components/store/storefront-app";
import { listActiveProducts, listCategories } from "@/lib/products-server";
import { SITE_FAQS, faqPageJsonLd } from "@/lib/faq";
import type { Category, Product } from "@/lib/types";

// Awaiting searchParams makes this route render dynamically per request, so
// the ?view= deep link (Buy now / Proceed-to-checkout redirects, payment
// return "View my orders") reaches the SSR HTML. The client storefront then
// renders the requested view on the very first paint — no homepage flash.
export const dynamic = "force-dynamic";

// Views that may arrive via the /?view= deep link — must match VALID_VIEWS in
// storefront-app.tsx. Only the home view displays the catalog.
const VALID_VIEWS = ["home", "product", "checkout", "orders", "account"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewParam = typeof params.view === "string" ? params.view : undefined;
  const view = viewParam && VALID_VIEWS.includes(viewParam) ? viewParam : "home";

  // Render the catalog INTO the shop page's first HTML. On real phones the
  // "Back to shop" tap often fires before hydration finishes (booting the app
  // bundle on mobile data takes seconds), and a pre-hydration tap silently
  // falls back to a FULL DOCUMENT LOAD of "/" — with client-fetched products
  // that reload painted skeletons until the JS booted AND /api/products
  // answered, which read as "stuck … a few seconds later it shows up". With
  // the cards in the SSR HTML, both this reload path and the prefetched
  // client-side swap paint products the moment the page arrives. The timeout
  // guard falls back to the previous client-fetch behavior if the catalog
  // fetch misbehaves, so this can never be slower than before.
  let initialProducts: Product[] | undefined;
  let initialCategories: Category[] | undefined;
  if (view === "home") {
    try {
      const catalog = await Promise.race([
        Promise.all([listActiveProducts(), listCategories()]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (catalog) {
        [initialProducts, initialCategories] = catalog;
      }
    } catch {
      // SSR catalog fetch failed — undefined props keep the grid on its
      // existing client-side /api fetch path.
    }
  }

  return (
    <>
      <CatalogItemList products={initialProducts ?? []} />
      {/* AEO (Task 77): FAQPage structured data for the site-wide questions.
          The matching VISIBLE answers render in the footer FAQ block, so
          markup and page content agree as answer engines expect. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            ...faqPageJsonLd(SITE_FAQS, "https://hayaan.co"),
          }),
        }}
      />
      <StorefrontApp
        viewParam={viewParam}
        initialProducts={initialProducts}
        initialCategories={initialCategories}
      />
    </>
  );
}

/** Catalog ItemList so crawlers see the full product graph from the landing
 *  page (products are already in the SSR HTML — this names the URLs). */
function CatalogItemList({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: `https://hayaan.co/product/${p.slug}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
