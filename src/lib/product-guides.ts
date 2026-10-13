// Task 87 — internal links from product pages to the buying guides (SEO/AEO).
//
// Every product detail page renders up to 3 guide cards, server-side, so the
// crawler-visible HTML carries contextual links from the deepest (highest-
// authority) commercial pages to the guides that answer the questions shoppers
// ask right before paying. Matching is name-first (specific guides), then
// category, then the universal payment/checkout guide — capped at 3 cards to
// avoid link bloat on the page.

export interface GuideLink {
  title: string;
  href: string;
  description: string;
}

const SITE = "https://hayaan.co";

const G = (slug: string, title: string, description: string): GuideLink => ({
  title,
  href: `${SITE}/blog/${slug}`,
  description,
});

/** The full guide registry — keep in sync with src/lib/blog-seo-posts.ts. */
export const BUYING_GUIDES = {
  shopping: G(
    "online-shopping-in-somalia-how-it-works",
    "Online Shopping in Somalia: How It Works",
    "Fixed prices, secure checkout and door delivery — the full walkthrough.",
  ),
  electronics: G(
    "where-to-buy-electronics-online-in-somalia",
    "Where to Buy Electronics Online in Somalia",
    "TVs, laptops and consoles: real prices and the five checks before you pay.",
  ),
  phones: G(
    "how-to-buy-phones-online-in-somalia",
    "How to Buy Phones Online in Somalia",
    "iPhone or Galaxy — what to check before you pay, from SIM bands to seals.",
  ),
  supplements: G(
    "buying-health-supplements-online-in-somalia",
    "Buying Health Supplements Online in Somalia",
    "How to read labels, avoid fakes and order vitamins with confidence.",
  ),
  homeOffice: G(
    "setting-up-a-home-office-in-somalia",
    "Setting Up a Home Office in Somalia",
    "Printers, desks and networking gear — a working setup, itemised.",
  ),
  ps5: G(
    "ps5-price-in-somalia",
    "PS5 Price in Somalia (2026)",
    "Digital Slim vs Pro 2TB, which edition to buy, and how to order one.",
  ),
  iphone: G(
    "iphone-price-in-somalia",
    "iPhone Price in Somalia (2026)",
    "Every model from $990 to $2,650 — the iPhone 18 lineup included, with SIM-type notes.",
  ),
  pay: G(
    "how-to-pay-online-in-somalia",
    "How to Pay Online in Somalia",
    "EVC Plus, Edahab and card through a secure checkout, step by step.",
  ),
  smartwatch: G(
    "best-smartwatches-online-in-somalia",
    "Best Smartwatches Online in Somalia (2026)",
    "Apple, Galaxy, Huawei or Amazfit — matched to your phone, $55 to $440.",
  ),
  ac: G(
    "air-conditioner-price-in-somalia",
    "Air Conditioner Price in Somalia (2026)",
    "Lightwave 9K–24K from $260, room sizing, and the stabilizer that protects it.",
  ),
  tv: G(
    "what-size-tv-to-buy-in-somalia",
    "What Size TV Should You Buy?",
    "32 to 85 inches priced and matched to your viewing distance.",
  ),
  mogadishu: G(
    "online-shopping-in-mogadishu",
    "Online Shopping in Mogadishu",
    "Delivery fees for every district, and how to order to your door.",
  ),
  router: G(
    "wifi-router-price-in-somalia",
    "Wi-Fi Router Price in Somalia (2026)",
    "From $15 to $145: routers, extenders and access points matched to your home or office.",
  ),
  printer: G(
    "printer-price-in-somalia",
    "Printer Price in Somalia (2026)",
    "HP lasers from $75, print-only vs MFP, and the toner math before you order.",
  ),
  hargeisa: G(
    "online-shopping-in-hargeisa",
    "Online Shopping in Hargeisa",
    "Flat $6.95 citywide delivery, and how to order step by step.",
  ),
  galaxyA18: G(
    "samsung-galaxy-a18-price-in-somalia",
    "Galaxy A18 Price in Somalia (2026)",
    "$187 with 128GB — specs, the A16/A17/A18 ladder, and how to order.",
  ),
} satisfies Record<string, GuideLink>;

/**
 * Pick the guides most relevant to a product. Specific name matches win,
 * then category-level guides, then the universal payment guide and the
 * general shopping walkthrough as fillers. Max 3, deduped, order-stable.
 */
export function guidesForProduct(name: string, categorySlug?: string | null): GuideLink[] {
  const n = (name ?? "").toLowerCase();
  const cat = (categorySlug ?? "").toLowerCase();
  const out: GuideLink[] = [];
  const push = (...guides: GuideLink[]) => {
    for (const g of guides) {
      if (out.length >= 3) return;
      if (!out.some((o) => o.href === g.href)) out.push(g);
    }
  };

  // Specific product-name matches first.
  if (/air conditioner/.test(n)) push(BUYING_GUIDES.ac);
  if (/galaxy a18|sm-a185/.test(n)) push(BUYING_GUIDES.galaxyA18);
  if (/router|access point|extender|wi-?fi|\buni-?fi\b|mikrotik|omada/.test(n)) push(BUYING_GUIDES.router);
  if (/printer|toner/.test(n)) push(BUYING_GUIDES.printer);
  if (/\btv\b|television/.test(n)) push(BUYING_GUIDES.tv);
  if (/playstation|\bps5\b/.test(n)) push(BUYING_GUIDES.ps5);
  if (/iphone/.test(n)) push(BUYING_GUIDES.iphone);
  if (/smart ?watch/.test(n) || (cat === "phones-wearables" && /watch/.test(n))) push(BUYING_GUIDES.smartwatch);

  // Category-level guides next.
  if (cat === "computers-tv-gaming") push(BUYING_GUIDES.electronics);
  if (cat === "phones-wearables") push(BUYING_GUIDES.phones);
  if (cat === "home-office") push(BUYING_GUIDES.homeOffice);
  if (cat === "health-supplements") push(BUYING_GUIDES.supplements);

  // Universal fillers — every shopper needs these.
  push(BUYING_GUIDES.pay);
  push(BUYING_GUIDES.shopping);
  push(BUYING_GUIDES.mogadishu);

  return out;
}
