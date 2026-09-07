import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Newspaper } from "lucide-react";
import { getPublishedPostBySlug } from "@/lib/blog";
import { MarkdownContent } from "@/lib/markdown";
import { StoreShell } from "@/components/store/store-shell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

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

  const jsonLd = {
    "@context": "https://schema.org",
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
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://hayaan.co/blog/${post.slug}` },
  };

  return (
    <StoreShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <Link
          href="/blog"
          className="inline-flex items-center text-sm font-bold text-brand hover:text-brand-dark"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to blog
        </Link>

        <header className="mt-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#3f7d4a]">
            <Newspaper className="h-4 w-4" aria-hidden /> Hayaan Market Blog
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight text-brand-dark sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground font-original">
            By {post.authorName}
            {post.publishedAt ? ` · ${formatDate(post.publishedAt)}` : ""}
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

        <div className="mt-8">
          <MarkdownContent source={post.content} />
        </div>

        <footer className="mt-12 rounded-2xl bg-[#f3f7f1] p-6 text-center">
          <h2 className="text-lg font-bold text-brand-dark">Ready to shop the story?</h2>
          <p className="mt-1 text-sm text-muted-foreground font-original">
            Browse the market — useful finds across fashion, beauty, electronics, and home.
          </p>
          <Link
            href="/"
            className="btn-accent mt-4 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm"
          >
            Start shopping
          </Link>
        </footer>
      </article>
    </StoreShell>
  );
}
