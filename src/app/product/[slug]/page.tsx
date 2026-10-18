import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getProductBySlug, prewarmCatalog } from "@/lib/products-server";
import { StoreShell } from "@/components/store/store-shell";
import { ProductDetail } from "@/components/store/product-detail";
import { FaqSection } from "@/components/store/faq-section";
import { guidesForProduct } from "@/lib/product-guides";
import { brandForProduct, genericPdpDescription, genericPdpTitle, pdpSeoFor, type PdpSeoCtx } from "@/lib/pdp-seo";
import { isLang, LANG_COOKIE, productDescription, translate, type DictKey } from "@/lib/i18n/dictionary";
import { looksLikeHtml, stripHtml } from "@/lib/rich-text";
import { listApprovedReviews } from "@/lib/reviews";

// SSR per request — catalog changes are visible immediately and crawlers
// always see fresh content.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: "Product not found", robots: { index: false, follow: true } };

  // Honor the language cookie so shares/crawl previews render the Somali
  // description for Somali-preferring visitors.
  const cookieStore = await cookies();
  const lang = isLang(cookieStore.get(LANG_COOKIE)?.value)
    ? (cookieStore.get(LANG_COOKIE)!.value as "en" | "so")
    : "en";
  const soDesc = productDescription(product.description, lang);
  // Meta tags need PLAIN text — strip formatting HTML if present.
  const plainDesc = looksLikeHtml(soDesc) ? stripHtml(soDesc) : soDesc;
  // Task 99: slug-keyed SEO override wins for targeted products — its meta
  // description interpolates the LIVE price, so a reprice can never go stale.
  // Task 112: every OTHER listing gets the generic keyword template
  // ("{Product} Price in Somalia — $X", live price/stock) for English;
  // Somali keeps the existing name + translated-description behavior.
  const override = pdpSeoFor(product.slug);
  const seoCtx: PdpSeoCtx = { price: product.price, inStock: product.stock > 0 };
  const customTitle = override
    ? override.title(seoCtx)
    : lang === "en" && product.price > 0
      ? genericPdpTitle(product.name, product.price, product.currency)
      : null;
  const description =
    override && lang === "en"
      ? override.metaDescription(seoCtx)
      : lang === "en" && product.price > 0
        ? genericPdpDescription(product.name, product.price, product.currency, plainDesc, product.stock > 0)
        : plainDesc.length > 157
          ? `${plainDesc.slice(0, 157)}…`
          : plainDesc;
  const image = product.images[0];

  return {
    // { absolute } bypasses the layout's "%s — Hayaan Market" template —
    // the keyword title already carries the brand suffix itself.
    title: customTitle ? { absolute: customTitle } : product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    other: {
      // Facebook/WhatsApp catalog signals — read alongside og:type=product.
      "product:price:amount": product.price.toFixed(2),
      "product:price:currency": product.currency,
    },
    openGraph: {
      title: customTitle ?? product.name,
      description,
      url: `/product/${product.slug}`,
      // NOTE: Next rejects openGraph.type "product" at runtime (Next 16
      // validates the OG type union) — so og:type stays "website" and the
      // product signals ride on the product:price:* meta tags above, which
      // Facebook/WhatsApp/pinterest parsers read from name= or property=.
      type: "website",
      locale: lang === "so" ? "so_SO" : "en_US",
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: customTitle ?? product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) notFound();

  // Task 105: while the visitor reads this product, warm the catalog cache
  // in the background so the (pre-hydration) Back-to-shop tap lands on a
  // fast, already-rendered shop page in EVERY browser — not just the
  // Chromium ones whose Speculation Rules prerender does the same job.
  prewarmCatalog();

  // SSR in the visitor's language (same cookie mechanism as the storefront).
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  const inStock = product.stock > 0;
  // Task 87: contextual buying-guide links — server-rendered so the first
  // HTML the crawler sees carries them (max 3, most-relevant first).
  const guides = guidesForProduct(product.name, product.category?.slug ?? null);
  // Task 99: same override powers the visible FAQ section and the FAQPage
  // JSON-LD — Google requires FAQ content to be on the page, not just in schema.
  const override = pdpSeoFor(product.slug);
  const seoCtx: PdpSeoCtx = { price: product.price, inStock: product.stock > 0 };
  const faqs = override ? override.faqs(seoCtx) : null;
  // Task 113: the newest approved reviews ride in the Product JSON-LD —
  // Google's review snippets read the individual Review nodes (author +
  // rating + body), not just the aggregate. Fails soft: a missing
  // product_reviews table or any fetch error simply omits the array.
  const reviewsForSchema = await listApprovedReviews(product.id, 5).catch(() => []);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: looksLikeHtml(product.description) ? stripHtml(product.description) : product.description,
        image: product.images,
        sku: product.sku ?? undefined,
        productID: product.id,
        brand: { "@type": "Brand", name: brandForProduct(product.name) },
        ...(product.rating > 0 && product.reviewCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.rating,
                reviewCount: product.reviewCount,
              },
            }
          : {}),
        ...(reviewsForSchema.length > 0
          ? {
              review: reviewsForSchema.map((r) => {
                const published = r.createdAt ? new Date(r.createdAt) : null;
                return {
                  "@type": "Review",
                  author: { "@type": "Person", name: r.authorName || "Hayaan customer" },
                  datePublished:
                    published && !Number.isNaN(published.getTime())
                      ? published.toISOString().slice(0, 10)
                      : undefined,
                  reviewBody: r.comment || undefined,
                  reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
                };
              }),
            }
          : {}),
        offers: {
          "@type": "Offer",
          url: `https://hayaan.co/product/${product.slug}`,
          priceCurrency: product.currency,
          price: product.price.toFixed(2),
          // Google recommends a validity horizon on Offer.price — 90 days
          // from render, refreshed on every SSR request.
          priceValidUntil: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10),
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
            ? [{ "@type": "ListItem", position: 2, name: product.category.name, item: `https://hayaan.co/category/${product.category.slug}` }]
            : []),
          { "@type": "ListItem", position: product.category ? 3 : 2, name: product.name, item: `https://hayaan.co/product/${product.slug}` },
        ],
      },
      ...(faqs
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <StoreShell>
      {/* Speculation Rules: while the shopper reads this product, Chrome
          builds the shop page in the background — a "Back to shop" tap then
          ACTIVATES the pre-built document instantly instead of a full reload.
          Task 108b: Chrome 143 (Oct 2026) changed `eager` from "same as
          immediate" to anchor-interaction heuristics (hover/viewport) — a
          LIST rule (urls:["/"]) has no anchor, so the eager prerender quietly
          STOPPED firing and every Back-to-shop paid the full load again (the
          owner's 20261017 video, desktop AND mobile). A DOCUMENT rule with
          eagerness "immediate" states the same intent unambiguously: prerender
          "/" as soon as the rules are observed, on every Chrome since 121. */}
      <script
        type="speculationrules"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            prerender: [{ where: { href_matches: "/" }, eagerness: "immediate" }],
          }),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetail initialProduct={product} />

      {/* Task 99: visible keyword-rich intro + FAQ section (AEO), rendered
          with the site-wide FaqSection accordion-card pattern (same component
          as homepage/category/blog guides) so the store has one FAQ look.
          Server-rendered — the FAQPage JSON-LD above still mirrors this text. */}
      {override && faqs && (
        <FaqSection
          faqs={faqs}
          title={override.heading}
          className="mx-auto max-w-7xl px-4 pb-12 sm:px-6"
          intro={
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground font-original">
              {override.intro(seoCtx)}
            </p>
          }
        />
      )}

      {/* Buying guides (Task 87): internal links from the product page to
          the SEO/AEO guides that answer pre-purchase questions. */}
      {guides.length > 0 && (
        <section
          aria-labelledby="pdp-guides-heading"
          className="mx-auto max-w-7xl px-4 pb-12 sm:px-6"
        >
          <h2
            id="pdp-guides-heading"
            className="flex items-center gap-2 text-lg font-bold text-brand-dark"
          >
            <BookOpen className="h-5 w-5 text-brand" aria-hidden />
            {t("guides.heading")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {guides.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className="group rounded-2xl border border-[#e6e2d4] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-sm font-bold leading-snug text-brand-dark group-hover:text-brand">
                  {g.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground font-original">
                  {g.description}
                </p>
                <span className="mt-3 inline-block text-xs font-bold text-[#f28c28]">
                  {t("guides.cta")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </StoreShell>
  );
}
