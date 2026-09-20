import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getCategoryBySlug,
  listProductsByCategorySlug,
  listCategories,
} from "@/lib/products-server";
import { ProductCard } from "@/components/store/product-card";
import { StoreShell } from "@/components/store/store-shell";
import {
  categoryName,
  isLang,
  LANG_COOKIE,
  translate,
  type DictKey,
} from "@/lib/i18n/dictionary";
import { categoryFaqsFor, faqPageJsonLd } from "@/lib/faq";
import { FaqSection } from "@/components/store/faq-section";

// SSR per request — catalog changes appear immediately and crawlers always
// see fresh category listings.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const SITE = "https://hayaan.co";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug).catch(() => null);
  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: true } };
  }

  const cookieStore = await cookies();
  const lang = isLang(cookieStore.get(LANG_COOKIE)?.value)
    ? (cookieStore.get(LANG_COOKIE)!.value as "en" | "so")
    : "en";
  const name = categoryName(category.name, category.slug, lang);

  const description =
    category.description?.trim() ||
    `Shop ${category.name} online at Hayaan Market — curated picks, delivery across Somalia, secure EVC Plus, Edahab & card checkout.`;
  const metaDescription =
    description.length > 157 ? `${description.slice(0, 157).trimEnd()}…` : description;

  return {
    title: `${category.name} — shop online in Somalia`,
    description: metaDescription,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} — Hayaan Market`,
      description: metaDescription,
      url: `/category/${category.slug}`,
      type: "website",
      locale: lang === "so" ? "so_SO" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} — Hayaan Market`,
      description: metaDescription,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug).catch(() => null);
  if (!category) notFound();

  const [products, allCategories] = await Promise.all([
    listProductsByCategorySlug(slug).catch(() => []),
    listCategories().catch(() => []),
  ]);

  // SSR in the visitor's language (same cookie mechanism as the storefront).
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);
  const name = categoryName(category.name, category.slug, lang);
  const others = allCategories.filter((c) => c.slug !== category.slug);

  const faqs = categoryFaqsFor(category.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name,
        url: `${SITE}/category/${category.slug}`,
        description: category.description || undefined,
        isPartOf: { "@id": `${SITE}/#website` },
      },
      {
        "@type": "ItemList",
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: p.name,
          url: `${SITE}/product/${p.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          {
            "@type": "ListItem",
            position: 2,
            name,
            item: `${SITE}/category/${category.slug}`,
          },
        ],
      },
      // AEO (Task 77): per-category Q&A — the visible copy renders below the
      // product grid via <FaqSection>, so markup matches page content.
      faqPageJsonLd(faqs, `${SITE}/category/${category.slug}`),
    ],
  };

  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Visible breadcrumb — mirrors the BreadcrumbList structured data */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="transition hover:text-brand">
            {t("ft.shop")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-foreground" aria-current="page">
            {name}
          </span>
        </nav>

        <header className="mt-4">
          <h1 className="text-3xl font-black font-panton tracking-tight text-brand-dark sm:text-4xl">
            {name}
          </h1>
          {/* Owner-authored category description (SEO content) wins over the
              generic blurb; both render in the visitor's language path. */}
          {category.description?.trim() ? (
            <p className="mt-2 max-w-3xl text-muted-foreground">{category.description}</p>
          ) : (
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t("catpage.shopFrom", { name })}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length === 1
              ? t("catpage.countOne")
              : t("catpage.count", { n: products.length })}
          </p>
        </header>

        {products.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-muted-foreground">{t("catpage.inStockOnly")}</p>
        )}

        {/* AEO (Task 77): buyer questions for this category ("where can I
            buy X online in Somalia"-style prompts), answered with the store's
            real delivery/payment facts. */}
        <FaqSection faqs={faqs} className="mt-12" />

        {others.length > 0 && (
          <section className="mt-12 border-t border-[#e6e2d4] pt-8">
            <h2 className="text-lg font-semibold text-brand-dark">
              {t("catpage.browse")}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="inline-flex h-9 items-center rounded-full border border-[#e6e2d4] bg-white px-4 text-sm font-medium text-brand-dark transition hover:border-brand/50 hover:bg-[#faf8f1]"
                  >
                    {categoryName(c.name, c.slug, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </StoreShell>
  );
}
