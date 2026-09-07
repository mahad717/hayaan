import type { MetadataRoute } from "next";
import { listActiveProductSlugs } from "@/lib/products-server";
import { listPublishedPosts } from "@/lib/blog";

// Evaluated per-request (runtime) so the product/blog listings come from the
// live database — at build time the service-role secret isn't available.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://hayaan.co";

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
  ];

  try {
    const products = await listActiveProductSlugs();
    for (const p of products) {
      entries.push({
        url: `${base}/product/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // Catalog unavailable — ship the static entries rather than a 500.
  }

  try {
    const { posts } = await listPublishedPosts(500);
    for (const post of posts) {
      entries.push({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.updatedAt ? new Date(post.updatedAt) : undefined,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Blog table not migrated yet — skip.
  }

  return entries;
}
