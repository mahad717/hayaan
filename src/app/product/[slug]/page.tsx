import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products-server";
import { StoreShell } from "@/components/store/store-shell";
import { ProductDetail } from "@/components/store/product-detail";

// SSR per request — catalog changes are visible immediately and crawlers
// always see fresh content.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: "Product not found", robots: { index: false, follow: true } };

  const description =
    product.description.length > 157 ? `${product.description.slice(0, 157)}…` : product.description;
  const image = product.images[0];

  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/product/${product.slug}`,
      type: "website",
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) notFound();

  const inStock = product.stock > 0;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: product.images,
        sku: product.sku ?? undefined,
        productID: product.id,
        brand: { "@type": "Brand", name: "Hayaan Market" },
        ...(product.rating > 0 && product.reviewCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.rating,
                reviewCount: product.reviewCount,
              },
            }
          : {}),
        offers: {
          "@type": "Offer",
          url: `https://hayaan.co/product/${product.slug}`,
          priceCurrency: product.currency,
          price: product.price.toFixed(2),
          availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: "Hayaan Market" },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://hayaan.co" },
          ...(product.category
            ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: `https://hayaan.co/#${product.category.slug}` }]
            : []),
          { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name, item: `https://hayaan.co/product/${product.slug}` },
        ],
      },
    ],
  };

  return (
    <StoreShell>
      {/* Speculation Rules (Task 47): while the shopper reads this product,
          Chrome/Samsung Internet builds the shop page in the background — a
          "Back to shop" tap then ACTIVATES the pre-built document instantly
          instead of a multi-second frozen reload. On browsers without
          Speculation Rules this tag is ignored; those fall back to the SSR
          catalog (products in the first HTML) plus the pre-hydration
          tap-feedback overlay from the root layout. */}
      <script
        type="speculationrules"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            prefetch: [{ source: "list", urls: ["/"], eagerness: "eager" }],
            prerender: [{ source: "list", urls: ["/"], eagerness: "eager" }],
          }),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetail initialProduct={product} />
    </StoreShell>
  );
}
