// Google Merchant Center product feed (Task 62).
// RSS 2.0 + the g: namespace. Point Merchant Center's
// "Add products from a file -> Enter a link to your file" at
// https://hayaan.co/feeds/google-products.xml and Google re-fetches on its
// schedule (owner set daily 12:00 AM), so price/stock changes sync without
// any manual step.
//
// Feed rules implemented:
// * active products only (mirrors the storefront);
// * availability from stock (in_stock / out_of_stock);
// * g:price = regular price (compareAt when a discount exists) and
//   g:sale_price = the current selling price;
// * brand from a conservative known-brands whitelist (first token of the
//   name) — never guessed beyond that; every item ships
//   identifier_exists=no because the catalog carries no GTIN/MPN;
// * on database failure return 500 so Merchant Center keeps the last good
//   feed instead of importing an empty one.

import { NextResponse } from "next/server";

import { listActiveProducts } from "@/lib/products-server";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const BASE = "https://hayaan.co";

// Electronics-leaning brands that actually appear in this catalog's names.
// First-token match only — safer to omit brand than to guess wrong.
const KNOWN_BRANDS = new Set(
  [
    "apple", "samsung", "hp", "dell", "lenovo", "asus", "acer", "msi",
    "xiaomi", "redmi", "poco", "realme", "oppo", "vivo", "huawei", "honor",
    "tecno", "infinix", "itel", "nokia", "sony", "lg", "panasonic", "philips",
    "jbl", "bose", "anker", "oraimo", "remax", "canon", "nikon", "dji",
    "gopro", "fujifilm", "aputure", "godox", "rode", "sennheiser",
    "tp-link", "mercusys", "tenda", "d-link", "netgear", "linksys", "ubiquiti",
    "logitech", "razer", "microsoft", "intel", "amd", "kingston", "sandisk",
    "seagate", "wd", "tcl", "hisense", "electrolux", "bosch", "kenwood",
    "delonghi", "severin", "ramtons", "haier", "garmin", "amcrest", "hikvision",
  ].map((b) => b.toLowerCase()),
);

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanText(raw: string, max: number): string {
  const s = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length <= max ? s : `${Array.from(s).slice(0, max - 1).join("").trimEnd()}…`;
}

function brandOf(name: string): string | null {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return first && KNOWN_BRANDS.has(first) ? first.toUpperCase() : null;
}

function price(v: number, currency: string): string {
  return `${v.toFixed(2)} ${currency}`;
}

function productToItem(p: Product): string {
  const title = xmlEscape(cleanText(p.name, 150));
  const description = xmlEscape(cleanText(p.description || p.name, 5000));
  const link = xmlEscape(`${BASE}/product/${encodeURIComponent(p.slug)}`);
  const availability = p.stock > 0 ? "in_stock" : "out_of_stock";
  const currency = (p.currency || "USD").toUpperCase();

  const regular = p.compareAt && p.compareAt > p.price ? p.compareAt : p.price;
  const onSale = regular !== p.price;

  const images = (Array.isArray(p.images) ? p.images : [])
    .filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u));
  const imageLink = images[0] ?? xmlEscape(`${BASE}/og.png`);
  const extraImages = images
    .slice(1, 10)
    .map((u) => `    <g:additional_image_link>${xmlEscape(u)}</g:additional_image_link>`)
    .join("\n");

  const brand = brandOf(p.name);
  const productType = p.category?.name ? xmlEscape(cleanText(p.category.name, 750)) : null;
  const categorySlug = p.category?.slug ? xmlEscape(p.category.slug) : null;

  return [
    "  <item>",
    `    <g:id>${xmlEscape(p.id)}</g:id>`,
    `    <title>${title}</title>`,
    `    <link>${link}</link>`,
    `    <description>${description}</description>`,
    `    <g:image_link>${imageLink}</g:image_link>`,
    ...(extraImages ? [extraImages] : []),
    `    <g:condition>new</g:condition>`,
    `    <g:availability>${availability}</g:availability>`,
    `    <g:price>${price(regular, currency)}</g:price>`,
    ...(onSale ? [`    <g:sale_price>${price(p.price, currency)}</g:sale_price>`] : []),
    ...(brand ? [`    <g:brand>${xmlEscape(brand)}</g:brand>`] : []),
    `    <g:identifier_exists>no</g:identifier_exists>`,
    ...(productType ? [`    <g:product_type>${productType}</g:product_type>`] : []),
    ...(categorySlug ? [`    <g:custom_label_0>${categorySlug}</g:custom_label_0>`] : []),
    "  </item>",
  ].join("\n");
}

export async function GET() {
  let products: Product[];
  try {
    products = await listActiveProducts(1000);
  } catch (e) {
    console.error("google feed: catalog unavailable", e);
    return NextResponse.json(
      { error: "Catalog unavailable — feed not regenerated." },
      { status: 500 },
    );
  }

  const items = products.map(productToItem).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Hayaan Market</title>
    <link>${BASE}</link>
    <description>Electronics, home and office essentials with nationwide delivery across Somalia — Hayaan Market product feed for Google Shopping.</description>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
