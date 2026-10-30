import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronLeft, Newspaper } from "lucide-react";
import { getPublishedPostBySlug } from "@/lib/blog";
import { MarkdownContent } from "@/lib/markdown";
import { faqPageJsonLd } from "@/lib/faq";
import { FaqSection } from "@/components/store/faq-section";
import { ShareButton } from "@/components/store/share-button";
import { StoreShell } from "@/components/store/store-shell";
import { formatDateLang, isLang, LANG_COOKIE, translate, type DictKey } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// Dates render through formatDateLang (dictionary) — Workers ICU silently
// falls back to en-US for "so-SO", so Somali months are explicit there.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug).catch(() => null);
  if (!post) return { title: "Article not found", robots: { index: false, follow: true } };

  const description = post.excerpt || post.content.slice(0, 157);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
      authors: [post.authorName],
      images: post.coverImage ? [{ url: post.coverImage, alt: post.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug).catch(() => null);
  if (!post) notFound();

  const SITE_POST_URL = `https://hayaan.co/blog/${post.slug}`;
  // SSR in the visitor's language (same cookie mechanism as the storefront).
  // Post CONTENT stays in its authored language (English guides / the owner's
  // Somali post); the page CHROME around it is what gets localized here.
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  // AEO (Task 77): BlogPosting + (when the guide defines them) FAQPage and
  // HowTo nodes. Every node mirrors content that is visibly on the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt || post.content.slice(0, 157),
        image: post.coverImage ? [post.coverImage] : undefined,
        datePublished: post.publishedAt ?? undefined,
        dateModified: post.updatedAt ?? undefined,
        author: { "@type": "Organization", name: post.authorName },
        publisher: {
          "@type": "Organization",
          name: "Hayaan Market",
          logo: { "@type": "ImageObject", url: "https://hayaan.co/hayaan-logo-green.svg" },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": SITE_POST_URL },
      },
      ...(post.faqs?.length ? [faqPageJsonLd(post.faqs, SITE_POST_URL)] : []),
      ...(post.howtoSteps?.length
        ? [
            {
              "@type": "HowTo",
              name: post.title,
              step: post.howtoSteps.map((s, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                name: s.name,
                text: s.text,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <StoreShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <Link
          href="/blog"
          className="inline-flex items-center text-sm font-bold text-brand hover:text-brand-dark"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> {t("blog.back")}
        </Link>

        <header className="mt-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#3f7d4a]">
            <Newspaper className="h-4 w-4" aria-hidden /> {t("blog.kicker")}
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-black leading-tight tracking-tight text-brand-dark sm:text-4xl">
              {post.title}
            </h1>
            {/* Share (Task 135) — same component as the PDP share+heart pair;
                native sheet on phones, WhatsApp/copy menu on desktop. */}
            <ShareButton
              url={SITE_POST_URL}
              title={post.title}
              text={post.excerpt ?? undefined}
              ariaLabel={t("share.postAria")}
              className="mt-1 h-9 w-9 shrink-0"
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground font-original">
            {t("blog.by", { name: post.authorName })}
            {post.publishedAt ? ` · ${formatDateLang(post.publishedAt, lang)}` : ""}
          </p>
        </header>

        {post.coverImage && (
          <figure className="mt-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="aspect-[16/9] w-full rounded-2xl object-cover ring-1 ring-[#e6e2d4]"
              fetchPriority="high"
            />
          </figure>
        )}

        {post.excerpt && (
          <p className="mt-8 border-l-4 border-[#3f7d4a] pl-4 text-base leading-relaxed text-foreground/85 font-original">
            {post.excerpt}
          </p>
        )}

        {/* AEO (Task 77): the direct, quotable answer answer engines extract
            for "buy X in Somalia" prompts — 40-60 words, above the fold. */}
        {post.quickAnswer && (
          <div className="mt-6 rounded-2xl border border-[#e6e2d4] bg-[#faf8f1] p-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#3f7d4a]">
              {t("blog.quickAnswer")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{post.quickAnswer}</p>
          </div>
        )}

        <div className="mt-8">
          <MarkdownContent source={post.content} />
        </div>

        {post.faqs?.length ? (
          <FaqSection faqs={post.faqs} title={t("faq.short")} className="mt-10 border-t border-[#e6e2d4] pt-8" />
        ) : null}

        <footer className="mt-12 rounded-2xl bg-[#f3f7f1] p-6 text-center">
          <h2 className="text-lg font-bold text-brand-dark">{t("blog.ctaTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground font-original">
            {t("blog.ctaBody")}
          </p>
          <Link
            href="/"
            className="btn-accent mt-4 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm"
          >
            {t("blog.ctaButton")}
          </Link>
        </footer>
      </article>
    </StoreShell>
  );
}
