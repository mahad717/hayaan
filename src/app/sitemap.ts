import type { MetadataRoute } from "next";
import {
  listActiveProductSlugs,
  listCategories,
} from "@/lib/products-server";
import { listPublishedPosts } from "@/lib/blog";

// Evaluated per-request (runtime) so the product/blog listings come from the
// live database — at build time the service-role secret isn't available.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://hayaan.co";

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/deals`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/quote`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/investors`, changeFrequency: "monthly", priority: 0.5 },
    // Task 136 / audit F4: the trust pages linked from the footer.
    { url: `${base}/shipping`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const categories = await listCategories();
    for (const c of categories) {
      entries.push({
        url: `${base}/category/${c.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Categories unavailable — ship the static entries rather than a 500.
  }

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
