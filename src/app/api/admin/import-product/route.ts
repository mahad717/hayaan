// POST /api/admin/import-product — Alibaba / AliExpress dropshipping import
// (Task 65). The owner pastes a supplier product URL; we fetch the page
// server-side and extract a draft (name, description, price, images) from
// JSON-LD structured data first, falling back to OpenGraph / meta tags.
// The draft only PREFILLS the admin product form — the owner always reviews
// pricing and edits before saving. The URL itself is stored on the product
// as supplier_url so fulfillment can link back to the listing.
//
// Supplier sites (especially AliExpress) aggressively block non-browser
// agents; when a fetch or parse fails we return a clear 422 so the owner can
// fall back to copy-pasting details into the normal Create product form.

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/accounting";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML = 3_000_000; // 3 MB is plenty for a product page
const MAX_DESC = 2000;
const MAX_IMAGES = 10;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanText(s: unknown, max = MAX_DESC): string | null {
  if (typeof s !== "string") return null;
  const t = decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function absoluteize(url: string, base: string): string | null {
  try {
    const u = new URL(url, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function collectJsonLdProducts(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ?? [parsed];
      for (const n of nodes) {
        const t = n?.["@type"];
        const types = Array.isArray(t) ? t : [t];
        if (types.some((x: string) => /Product/i.test(String(x)))) out.push(n);
      }
    } catch {
      // malformed JSON-LD block — skip
    }
  }
  return out;
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

function allMetaImages(html: string, base: string): string[] {
  const urls: string[] = [];
  const re = /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*>/gi;
  for (const m of html.matchAll(re)) {
    const c = m[0].match(/content=["']([^"']*)["']/i)?.[1];
    const abs = c ? absoluteize(decodeEntities(c).trim(), base) : null;
    if (abs) urls.push(abs);
  }
  return urls;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser(req);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const raw = body?.url?.trim();
  if (!raw) return NextResponse.json({ error: "Paste a supplier product URL." }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("scheme");
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  // SSRF guard: only public http(s) pages.
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(target.hostname)) {
    return NextResponse.json({ error: "Only public supplier URLs can be imported." }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(target.href, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `The supplier page responded ${res.status} (these sites often block automated fetching). Create the product manually and paste the URL into the Supplier URL field.`,
        },
        { status: 422 },
      );
    }
    html = (await res.text()).slice(0, MAX_HTML);
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't reach that page (timeout or blocked). Create the product manually and paste the URL into the Supplier URL field.",
      },
      { status: 422 },
    );
  }

  // --- Extract a draft -----------------------------------------------------
  let name = cleanText(metaContent(html, "og:title"), 200);
  let description = cleanText(metaContent(html, "og:description")) ?? cleanText(metaContent(html, "description"));
  let images = allMetaImages(html, target.href);
  let price: number | null = null;
  let currency: string | null = cleanText(metaContent(html, "product:price:currency"), 10);

  const ldProducts = collectJsonLdProducts(html);
  for (const p of ldProducts) {
    if (!name && p.name) name = cleanText(String(p.name), 200);
    if (!description && p.description) description = cleanText(String(p.description));
    const imgs = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
    for (const im of imgs) {
      const u = typeof im === "string" ? im : im?.url ?? im?.["@id"];
      const abs = typeof u === "string" ? absoluteize(u, target.href) : null;
      if (abs) images.push(abs);
    }
    const offers = p.offers ?? p?.offers?.offers;
    const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
    for (const o of offerList) {
      const raw = o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price;
      const n = raw != null ? Number(String(raw).replace(/[^0-9.]/g, "")) : NaN;
      if (Number.isFinite(n) && n > 0 && (price == null || n < price)) price = n;
      if (!currency && o?.priceCurrency) currency = cleanText(String(o.priceCurrency), 10);
    }
  }

  // itemprop price fallback (common on Alibaba listing pages) and Shopify's
  // og product price meta
  if (price == null) {
    const candidates = [
      html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i),
      html.match(/content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i),
      html.match(/property=["']product:price:amount["'][^>]*content=["']([\d.,]+)["']/i),
      html.match(/content=["']([\d.,]+)["'][^>]*property=["']product:price:amount["']/i),
    ];
    const ip = candidates.find(Boolean);
    const n = ip ? Number(ip[1].replace(/,/g, "")) : NaN;
    if (Number.isFinite(n) && n > 0) price = n;
  }

  // Dedupe images, keep http(s) only.
  images = [...new Set(images)].filter(Boolean).slice(0, MAX_IMAGES);

  if (!name && images.length === 0 && price == null) {
    return NextResponse.json(
      {
        error:
          "Fetched the page but couldn't find product data in it. Create the product manually and paste the URL into the Supplier URL field.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    draft: {
      name: name ?? "",
      description: description ?? "",
      price: price != null ? Math.round(price * 100) / 100 : "",
      currency: currency ?? "USD",
      images,
      supplierUrl: target.href,
      source: target.hostname.replace(/^www\./, ""),
    },
  });
}
