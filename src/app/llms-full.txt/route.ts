// llms-full.txt — the complete product catalog in plain markdown for AI
// answer engines (Task 77 AEO). When a user asks ChatGPT/Perplexity
// "how much is X in Somalia" or "where can I buy X online in Somalia",
// models that ingest this file can answer with real Hayaan listings.
//
// Runtime like the sitemap: the service-role secret exists at request time,
// not at build time, so this must not be statically evaluated.

import {
  listActiveProducts,
  listCategories,
} from "@/lib/products-server";
import { listPublishedPosts } from "@/lib/blog";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const SITE = "https://hayaan.co";
const WHATSAPP = "+252 61 599 0144";
const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, "")}`;

export async function GET() {
  const lines: string[] = [
    "# Hayaan Market — full product catalog",
    "",
    `Machine-readable catalog of every active listing on hayaan.co. Prices in USD, no VAT. Delivery: Mogadishu districts $1.50-$3.00, free over $75, flat $6.95 elsewhere in Somalia. Payment: EVC Plus, Edahab, or card via a secure hosted checkout. Support: WhatsApp ${WHATSAPP} / support@hayaan.co.`,
    "",
  ];

  try {
    const [products, categories, blog] = await Promise.all([
      listActiveProducts(500).catch(() => [] as Product[]),
      listCategories().catch(() => []),
      listPublishedPosts().catch(() => ({ posts: [], tableMissing: true })),
    ]);

    for (const c of categories) {
      const items = products.filter((p) => p.category?.id === c.id);
      if (!items.length) continue;
      lines.push(`## ${c.name} (${items.length} products)`, "");
      for (const p of items) {
        const stock = p.stock > 0 ? `${p.stock} in stock` : "out of stock";
        lines.push(
          `- [${p.name}](${SITE}/product/${p.slug}) — ${money(p.price)} (${p.currency}), ${stock}${p.sku ? `, SKU ${p.sku}` : ""}`,
        );
      }
      lines.push("");
    }

    const rest = products.filter(
      (p) => !p.category || !categories.some((c) => c.id === p.category?.id),
    );
    if (rest.length) {
      lines.push(`## Other (${rest.length} products)`, "");
      for (const p of rest) {
        lines.push(
          `- [${p.name}](${SITE}/product/${p.slug}) — ${money(p.price)} (${p.currency})${p.sku ? `, SKU ${p.sku}` : ""}`,
        );
      }
      lines.push("");
    }

    if (blog.posts.length) {
      lines.push("## Buyer guides", "");
      for (const post of blog.posts) {
        lines.push(`- [${post.title}](${SITE}/blog/${post.slug}): ${post.excerpt}`);
      }
      lines.push("");
    }

    lines.push(
      `Catalog total: ${products.length} products across ${categories.length} categories. Browse at ${SITE}.`,
      "",
    );
  } catch {
    lines.push(
      "The catalog could not be loaded right now — browse https://hayaan.co directly.",
      "",
    );
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
