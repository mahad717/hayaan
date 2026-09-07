import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { listPublishedPosts } from "@/lib/blog";
import { StoreShell } from "@/components/store/store-shell";

// Rendered per request so newly published posts appear immediately.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Shopping guides, product care tips, and stories from Hayaan Market — useful reading before your next order.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog — Hayaan Market",
    description: "Shopping guides, product care tips, and stories from Hayaan Market.",
    url: "/blog",
    type: "website",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default async function BlogIndexPage() {
  const { posts, tableMissing } = await listPublishedPosts().catch(() => ({ posts: [], tableMissing: true }));

  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "Hayaan Market Blog",
            url: "https://hayaan.co/blog",
            publisher: { "@type": "Organization", name: "Hayaan Market" },
            ...(posts.length > 0
              ? { blogPost: posts.slice(0, 10).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `https://hayaan.co/blog/${p.slug}` })) }
              : {}),
          }),
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <header className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#3f7d4a]">
            <Newspaper className="h-4 w-4" /> Hayaan Market
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-dark sm:text-4xl">Blog</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground font-original">
            Shopping guides, product care tips, and stories from the market — everything we
            wish we knew before buying, written down for you.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-[#e6e2d4] bg-white p-12 text-center">
            <Newspaper className="mx-auto h-10 w-10 text-[#3f7d4a]/60" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-brand-dark">No stories yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground font-original">
              {tableMissing
                ? "The blog is being set up — check back soon for guides and picks."
                : "Our first guide is on its way. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="group">
                <Link
                  href={`/blog/${post.slug}`}
                  className="block overflow-hidden rounded-2xl border border-[#e6e2d4] bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-[#faf8f1]">
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f3f7f1] to-[#e9f0e9]">
                        <Newspaper className="h-10 w-10 text-[#3f7d4a]/40" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-5">
                    <p className="text-xs uppercase tracking-wide text-[#3f7d4a]">
                      {formatDate(post.publishedAt)}
                    </p>
                    <h2 className="line-clamp-2 text-base font-bold leading-snug text-brand-dark group-hover:text-brand">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground font-original">
                        {post.excerpt}
                      </p>
                    )}
                    <span className="mt-1 text-sm font-bold text-[#f28c28]">Read more →</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </StoreShell>
  );
}
