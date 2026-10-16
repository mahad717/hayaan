// Server-side product reads for SSR routes (product pages, sitemap).
// Same dual path as the API routes: Supabase service-role in production,
// Prisma + SQLite locally. Kept out of the API route so server components
// can reuse it without an HTTP round-trip.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { CATEGORY_SEO_DESCRIPTIONS } from "@/lib/category-seo";
import type { Category, Product } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Catalog read cache (Task 105 + Task 106)                             */
/*                                                                      */
/* Why: every storefront request used to pay the full Worker -> Supabase */
/* round trip for the SAME catalog data. Measured live 2026-10-16:       */
/* GET / TTFB 1.07-2.35s, PDP TTFB 0.44-1.68s — and the owner's screen   */
/* recording shows a ~5s full-screen "Loading the shop…" spinner on the  */
/* PDP -> shop navigation (pre-hydration tap = full document load of /). */
/*                                                                      */
/* Task 106 addendum — why TWO tiers: the isolate-memory cache dies with */
/* the isolate. This site is low-traffic, so the owner's own taps often  */
/* land on a JUST-RECYCLED isolate and paid the full 1-2s Supabase fetch */
/* again ("still slow" after the Task 105 fix). caches.default is shared */
/* per data-center (colo) and OUTLIVES isolate recycles, so the second   */
/* request in the same colo is warm even on a brand-new isolate.         */
/*                                                                      */
/* Contract (production/Supabase path ONLY — local Prisma dev stays     */
/* uncached so admin edits are instant while developing):               */
/*  - Fresh window FRESH_MS: served from isolate memory, zero Supabase  */
/*    work. Typical request latency drops to network + render only.     */
/*  - Past the fresh window: the stale copy is served IMMEDIATELY and   */
/*    one background refresh is started (single-flight — concurrent     */
/*    requests never duplicate the fetch). The Worker is kept alive     */
/*    until the refresh settles via getCloudflareContext().ctx          */
/*    .waitUntil when available.                                        */
/*  - Refresh failure: keep serving the last good copy (up to           */
/*    MAX_STALE_MS, then fall through to a synchronous fetch) instead   */
/*    of erroring the page — strictly more resilient than before.       */
/*  - Edge tier: same timestamps and freshness logic as memory, just a  */
/*    wider sharing scope (per colo). Every edge operation is best-     */
/*    effort and try/catch'd — on any failure the cache silently        */
/*    degrades to memory-only (the pre-Task-106 behavior).              */
/*  - Freshness: storefront/catalog data can lag live DB by <= 60s.     */
/*    Admin panel, checkout, and order writes use other (uncached)      */
/*    paths and are unaffected.                                         */
/* ------------------------------------------------------------------ */

const FRESH_MS = 60_000;
const MAX_STALE_MS = 600_000;
const MAX_KEYS = 400;

type CacheEntry = { value: unknown; at: number };
const catalogCache = new Map<string, CacheEntry>();
const inflightRefreshes = new Map<string, Promise<unknown>>();

/** Evict oldest entries when the per-slug keys proliferate. Map iterates
 *  in insertion order and hot keys are re-inserted on refresh, so this
 *  approximates LRU with almost no code. */
function evictOverflow() {
  while (catalogCache.size > MAX_KEYS) {
    const oldest = catalogCache.keys().next().value;
    if (oldest === undefined) break;
    catalogCache.delete(oldest);
  }
}

/** Best-effort "don't kill my background fetch" for Cloudflare Workers.
 *  Outside Workers (local dev, node scripts) this is a no-op. */
function keepAlive(p: Promise<unknown>) {
  void import("@opennextjs/cloudflare")
    .then(({ getCloudflareContext }) => {
      const ctx = (getCloudflareContext() as unknown as { ctx?: { waitUntil?: (x: Promise<unknown>) => void } })
        ?.ctx;
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p);
    })
    .catch(() => {
      /* no Workers context — the promise may be dropped after the response;
         the next request will simply refresh synchronously via stale logic */
    });
}

/* ---------------- Edge tier (Task 106): Cloudflare Cache API ---------------- */

type EdgeEnvelope = { at: number; value: unknown };

/** The Cache API needs an absolute URL; the production zone is fixed and
 *  the path is never requested by real traffic. On non-hayaan.co hosts
 *  (e.g. a workers.dev preview) put/match is cross-zone: the runtime
 *  rejects it and every helper below falls back to memory-only. */
const EDGE_BASE = "https://hayaan.co/__hayaan-swr/";

function edgeCache(): Cache | null {
  try {
    const c = (globalThis as { caches?: { default?: Cache } }).caches;
    return c && typeof c.default?.match === "function" ? c.default : null;
  } catch {
    return null;
  }
}

function edgeRequest(key: string): Request {
  return new Request(`${EDGE_BASE}${encodeURIComponent(key)}`, { method: "GET" });
}

async function edgeGet(key: string): Promise<EdgeEnvelope | null> {
  const cache = edgeCache();
  if (!cache) return null;
  try {
    const res = await cache.match(edgeRequest(key));
    if (!res) return null;
    const env = (await res.json()) as EdgeEnvelope | null;
    if (!env || typeof env.at !== "number") return null;
    return env;
  } catch {
    return null;
  }
}

/** Never awaited on the request path — always wrapped in keepAlive(). */
async function edgePut(key: string, value: unknown): Promise<void> {
  const cache = edgeCache();
  if (!cache) return;
  try {
    const body = JSON.stringify({ at: Date.now(), value } as EdgeEnvelope);
    const res = new Response(body, {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
    });
    await cache.put(edgeRequest(key), res);
  } catch {
    /* best effort — memory tier already holds the value */
  }
}

/* ---------------- End edge tier ---------------- */

function serveCopy<T>(value: unknown, shallowCopy: boolean): T {
  return (shallowCopy && Array.isArray(value) ? [...value] : value) as T;
}

/** One single-flight background refresh; populates BOTH cache tiers. */
function startRefresh(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
  const p = fetcher()
    .then((fresh) => {
      catalogCache.delete(key);
      catalogCache.set(key, { value: fresh, at: Date.now() });
      evictOverflow();
      keepAlive(edgePut(key, fresh));
      return fresh;
    })
    .catch(() => {
      /* keep last good copy; if it is beyond MAX_STALE_MS the next
         request falls through to a synchronous fetch below */
    })
    .finally(() => inflightRefreshes.delete(key));
  inflightRefreshes.set(key, p);
  keepAlive(p);
  return p;
}

async function swr<T>(key: string, fetcher: () => Promise<T>, shallowCopy = false): Promise<T> {
  // Local Prisma dev path: always live, zero staleness while developing.
  if (!isSupabaseServerEnabled) return fetcher();

  // Tier 1 — isolate memory (hottest, dies with the isolate).
  const entry = catalogCache.get(key);
  if (entry) {
    const age = Date.now() - entry.at;
    if (age < FRESH_MS) return serveCopy<T>(entry.value, shallowCopy);
    // Stale — start exactly one background refresh and serve the copy now.
    if (!inflightRefreshes.has(key)) startRefresh(key, fetcher);
    if (age <= MAX_STALE_MS) return serveCopy<T>(entry.value, shallowCopy);
    // Dangerously old (refresh kept failing for 10+ minutes) — block on it.
    const fresh = (await inflightRefreshes.get(key)) ?? (await fetcher());
    return serveCopy<T>(fresh, shallowCopy);
  }

  // Tier 2 — edge (shared per colo, survives isolate recycles). A brand-new
  // isolate hydrates its memory cache from here so the NEXT request skips
  // even the edge read. Same freshness logic as the memory tier.
  const edge = await edgeGet(key);
  if (edge) {
    catalogCache.set(key, { value: edge.value, at: edge.at });
    evictOverflow();
    const age = Date.now() - edge.at;
    if (age < FRESH_MS) return serveCopy<T>(edge.value, shallowCopy);
    if (!inflightRefreshes.has(key)) startRefresh(key, fetcher);
    if (age <= MAX_STALE_MS) return serveCopy<T>(edge.value, shallowCopy);
    const fresh = (await inflightRefreshes.get(key)) ?? (await fetcher());
    return serveCopy<T>(fresh, shallowCopy);
  }

  // Tier 3 — cold: fetch once, populate both tiers.
  const fresh = await fetcher();
  catalogCache.set(key, { value: fresh, at: Date.now() });
  evictOverflow();
  keepAlive(edgePut(key, fresh));
  return serveCopy<T>(fresh, shallowCopy);
}

/** Task 105: fire-and-forget catalog pre-warm.
 *
 *  The Speculation Rules prerender on PDPs already warms the catalog on
 *  Chromium browsers while the visitor reads the product. Visitors on
 *  browsers WITHOUT prerender support tap Back-to-shop with a cold catalog
 *  key on the isolate and pay the full 1-2s Supabase fetch. Calling this
 *  when a PDP renders closes that gap for every browser: the catalog is
 *  fetched in the background (kept alive via ctx.waitUntil) so the tap
 *  lands on a warm key. Cheap: one Supabase read per isolate per fresh
 *  window; swr() dedupes and skips work when the key is still fresh. */
export function prewarmCatalog(): void {
  if (!isSupabaseServerEnabled) return;
  const p = listActiveProducts().catch(() => {});
  try {
    void import("@opennextjs/cloudflare")
      .then(({ getCloudflareContext }) => {
        const ctx = (getCloudflareContext() as unknown as { ctx?: { waitUntil?: (x: Promise<unknown>) => void } })
          ?.ctx;
        if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p);
      })
      .catch(() => {
        /* no Workers context — best effort */
      });
  } catch {
    /* best effort */
  }
}

export function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAt: row.compareAt != null ? Number(row.compareAt) : null,
    currency: row.currency ?? "USD",
    sku: row.sku ?? null,
    stock: row.stock,
    rating: Number(row.rating ?? 0),
    // Supabase column is snake_case review_count — the old mapping read only
    // row.reviewCount, which is undefined on every prod row (Task 85).
    reviewCount: Number(row.reviewCount ?? row.review_count ?? 0),
    images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || "[]"),
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || "[]"),
    featured: row.featured,
    isActive: row.isActive ?? row.is_active,
    // Digital delivery (Task 82) — SSR PDP needs the type for the badge,
    // instant-delivery promise, and offer schema.
    productType: (row.productType ?? row.product_type ?? "physical") === "digital" ? "digital" : "physical",
    categoryId: row.categoryId ?? row.category_id,
    category: row.category
      ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description ?? null }
      : undefined,
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isSupabaseServerEnabled) {
    // Task 105: cached per slug (60s SWR). The PDP calls this twice per
    // request (generateMetadata + Page) — both now share one fetch.
    return swr(`product:v1:${decodeURIComponent(slug)}`, async () => {
      const supabase = createServiceClient()!;
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("slug", decodeURIComponent(slug))
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToProduct(data) : null;
    });
  }

  const product = await (await getDb()).product.findFirst({
    where: { slug: decodeURIComponent(slug), isActive: true },
    include: { category: true },
  });
  return product ? rowToProduct(product) : null;
}

/** All active products for the storefront grid — mirrors GET /api/products'
 *  default (newest-first) query. Used by the home page to render the catalog
 *  into the SSR HTML. Limit must exceed the live catalog size: at the old
 *  default of 100, the 2026-10 sanguni mobile sync (141 products) silently
 *  hid 41 cards from the grid and sitemap. */
export async function listActiveProducts(limit = 500): Promise<Product[]> {
  if (isSupabaseServerEnabled) {
    // Task 105: the heavy one — the full catalog (~1MB JSON) fetched on
    // EVERY home/llms/feed request before. Now 60s SWR, single-flight.
    return swr(
      `catalog:v1:${limit}`,
      async () => {
        const supabase = createServiceClient()!;
        const { data, error } = await supabase
          .from("products")
          .select("*, category:categories(*)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(rowToProduct);
      },
      true,
    );
  }

  const products = await (await getDb()).product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(rowToProduct);
}

/** Categories for the storefront filter pills — mirrors GET /api/categories. */
export async function listCategories(): Promise<Category[]> {
  if (isSupabaseServerEnabled) {
    return swr(
      "categories:v1",
      async () => {
        const supabase = createServiceClient()!;
        const { data, error } = await supabase.from("categories").select("*").order("name");
        if (error) throw new Error(error.message);
        return (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? null,
        }));
      },
      true,
    );
  }

  const categories = await (await getDb()).category.findMany({ orderBy: { name: "asc" } });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
  }));
}

/** One category by slug (for /category/[slug] landing pages).
 *
 *  Description precedence: a SUBSTANTIAL owner-authored DB description
 *  (>= 80 chars) wins outright. Short DB stubs (seed-era labels like
 *  "Laptops, printers, TVs, gaming and accessories.") are replaced by the
 *  keyword-targeted SEO fallback — the owner asked for exactly this in
 *  Task 73 and can still override anything longer via
 *  PATCH /api/admin/categories/[id]. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const decoded = decodeURIComponent(slug);
  const withSeoFallback = (c: Category): Category => {
    const db = c.description?.trim() ?? "";
    const description = db.length >= 80 ? db : CATEGORY_SEO_DESCRIPTIONS[c.slug] || db || null;
    return { ...c, description };
  };

  if (isSupabaseServerEnabled) {
    // Task 105: cache the RAW row; the SEO-description fallback runs on
    // every request so CATEGORY_SEO_DESCRIPTIONS edits stay live.
    const raw = await swr(`category:v1:${decoded}`, async () => {
      const supabase = createServiceClient()!;
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", decoded)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { id: data.id, name: data.name, slug: data.slug, description: data.description ?? null }
        : null;
    });
    return raw ? withSeoFallback(raw) : null;
  }

  const category = await (await getDb()).category.findFirst({ where: { slug: decoded } });
  return category
    ? withSeoFallback({ id: category.id, name: category.name, slug: category.slug, description: category.description ?? null })
    : null;
}

/** Active products in one category, newest-first — mirrors the storefront
 *  grid order so /category/[slug] pages show the same cards. */
export async function listProductsByCategorySlug(slug: string, limit = 500): Promise<Product[]> {
  const decoded = decodeURIComponent(slug);
  if (isSupabaseServerEnabled) {
    return swr(
      `cat-products:v1:${decoded}:${limit}`,
      async () => {
        const supabase = createServiceClient()!;
        const { data, error } = await supabase
          .from("products")
          .select("*, category:categories!inner(id, name, slug, description)")
          .eq("is_active", true)
          .eq("categories.slug", decoded)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(rowToProduct);
      },
      true,
    );
  }

  const products = await (await getDb()).product.findMany({
    where: { isActive: true, category: { slug: decoded } },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(rowToProduct);
}

/** All active product+category slugs (with names) for sitemap + category
 *  hub generation. */
export async function listActiveProductSlugs(): Promise<Array<{ slug: string; updatedAt: Date | string }>> {
  if (isSupabaseServerEnabled) {
    return swr("slugs:v1", async () => {
      const supabase = createServiceClient()!;
      const { data, error } = await supabase
        .from("products")
        .select("slug, updated_at")
        .eq("is_active", true)
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: any) => ({ slug: row.slug, updatedAt: row.updated_at }));
    });
  }

  const products = await (await getDb()).product.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    take: 1000,
  });
  return products;
}
