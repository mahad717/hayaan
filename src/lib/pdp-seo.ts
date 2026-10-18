/**
 * Task 99 — per-product PDP SEO overrides.
 *
 * Target keywords (owner request): "samsung galaxy a18", "a18 samsung",
 * "samsung a18 price", "a18 samsung price".
 *
 * Design rules:
 * - Overrides are keyed by product slug; products not in the map keep the
 *   existing generic metadata (name + DB-derived description).
 * - Price-dependent strings are FUNCTIONS of the live catalog price, so a
 *   future reprice can never leave a stale number in the <title>, meta
 *   description or visible FAQ text (the lesson of the $187->$190 sync).
 * - FAQ content is rendered BOTH as visible HTML (Google requires FAQ
 *   content on-page) and as FAQPage JSON-LD in the PDP @graph.
 * - No shipping-promo claims here — fee language stays the post-$75-rule
 *   baseline: Mogadishu districts $1.50–$3.00, flat $6.95 nationwide.
 */

export type PdpSeoCtx = { price: number; inStock: boolean };
export type PdpFaq = { q: string; a: string };

export type PdpSeoOverride = {
  /** Visible heading of the FAQ section. */
  heading: string;
  /** <title> / og:title / twitter:title. */
  title: (ctx: PdpSeoCtx) => string;
  /** Meta description (keep <=160 chars at typical prices). */
  metaDescription: (ctx: PdpSeoCtx) => string;
  /** Server-rendered keyword-rich intro paragraph. */
  intro: (ctx: PdpSeoCtx) => string;
  /** Q&A rendered on-page and mirrored into FAQPage JSON-LD. */
  faqs: (ctx: PdpSeoCtx) => PdpFaq[];
};

export const PDP_SEO: Record<string, PdpSeoOverride> = {
  "samsung-galaxy-a18": {
    heading: "Samsung Galaxy A18 — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A18 Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A18 price in Somalia: $${price} at Hayaan Market. Genuine 128GB Galaxy A18 4G with 90Hz AMOLED, 50MP camera, 5000mAh battery.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A18 price in Somalia is $${price} at Hayaan Market — the 128GB Galaxy A18 4G in Black${inStock ? ", in stock and ready to order" : ""}. That buys Samsung's Exynos 1610 chipset, a 6.7-inch 90Hz Super AMOLED display, a 50MP triple camera with 4K video, a 5000mAh battery with 25W charging and software updates promised until 2032, delivered to your door in Mogadishu or anywhere in the country.`,
    faqs: ({ price }) => [
      {
        q: "How much does the Samsung Galaxy A18 cost in Somalia?",
        a: `The Samsung Galaxy A18 price in Somalia is $${price} at Hayaan Market for the 128GB model in Black — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "Is the Galaxy A18 a good phone for the price?",
        a: `For $${price} you get Samsung's newest budget chipset (Exynos 1610), a 6.7-inch 90Hz Super AMOLED display, a 50MP triple camera with 4K video, a 5000mAh battery, IP64 water resistance and Android 17 with updates promised until 2032 — the strongest spec sheet under $200 in the catalog.`,
      },
      {
        q: "Does the Samsung Galaxy A18 have 128GB storage?",
        a: "Yes — this listing is the 128GB variant with a microSD slot for expansion, paired with 4GB of RAM. It is a 4G LTE phone, which is what most everyday mobile data in Somalia runs on.",
      },
      {
        q: "How do I order the Galaxy A18 and how much is delivery?",
        a: "Add it to your cart on this page, sign in, and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 depending on your Mogadishu district, and a flat $6.95 anywhere else in Somalia — the exact fee is shown before you pay.",
      },
    ],
  },
};

export function pdpSeoFor(slug: string): PdpSeoOverride | null {
  return PDP_SEO[slug] ?? null;
}

/**
 * Task 112 — generic per-product SEO templates.
 *
 * The Task 99 layer above hand-tunes individual slugs; this layer gives
 * EVERY other listing a keyword-led <title> / meta description built from
 * LIVE catalog data (name, price, stock) — the same
 * "{Product} Price in Somalia — $X" pattern shoppers actually type into
 * Google, without fabricating specs we don't have. Only the <title>, meta
 * description and og/twitter titles change; the visible page (h1, body
 * copy) is untouched. Per-slug overrides above always win.
 */

/** $190, $6.95, $1,899 — integer prices drop the decimals. */
export function formatUsd(n: number): string {
  const [int, dec] = n.toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === "00" ? `$${grouped}` : `$${grouped}.${dec}`;
}

function money(price: number, currency: string): string {
  return currency === "USD" ? formatUsd(price) : `${price.toFixed(2)} ${currency}`;
}

/** Word-boundary clip; result is never longer than max (ellipsis included). */
function clipWords(s: string, max: number): string | null {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > 20 ? cut.slice(0, at) : cut).replace(/[,;:.\-]+$/, "")}…`;
}

export function genericPdpTitle(name: string, price: number, currency: string): string {
  // A few catalog names run 100+ chars (imported listings) — clamped so the
  // "Price in Somalia — $X" pattern the shopper scans for stays visible.
  const nm = name.length > 60 ? clipWords(name, 60)! : name;
  const base = `${nm} Price in Somalia — ${money(price, currency)}`;
  // Google truncates ~60-65 chars: keep the "| Hayaan Market" suffix only
  // when the WHOLE title still fits, so the price is never the part cut.
  return base.length <= 52 ? `${base} | Hayaan Market` : base;
}

export function genericPdpDescription(
  name: string,
  price: number,
  currency: string,
  plainDesc: string,
  inStock: boolean,
): string {
  const nm = name.length > 60 ? clipWords(name, 60)! : name;
  const base = `${nm} price in Somalia: ${money(price, currency)} at Hayaan Market.`;
  const cta = inStock ? " Order online." : " Check back soon.";
  // Spend the remaining 160-char budget on the product's own description
  // (specs sell), clipped at a word boundary — never mid-spec.
  const budget = 160 - base.length - cta.length - 1;
  const snippet = budget >= 24 ? clipWords(plainDesc, budget) : null;
  return `${base}${snippet ? ` ${snippet}` : ""}${cta}`;
}

/**
 * Brand for Product JSON-LD. The seller (Hayaan Market) is NOT the brand of
 * a Samsung/Apple/HP product — Google's product rich results read `brand`,
 * and "Samsung" is what reinforces brand+model queries like
 * "samsung galaxy a18". Falls back to the store name for unbranded goods.
 */
const BRAND_PATTERNS: Array<[RegExp, string]> = [
  [/\bsamsung\b/i, "Samsung"],
  [/\bapple\b|\biphone\b|\bipad\b|\bmacbook\b/i, "Apple"],
  [/\bhuawei\b/i, "Huawei"],
  [/\bxiaomi\b|\bredmi\b|\bpoco\b/i, "Xiaomi"],
  [/\bnokia\b/i, "Nokia"],
  [/\bgoogle\b|\bpixel\b/i, "Google"],
  [/\bsony\b|\bplaystation\b|\bps5\b/i, "Sony"],
  [/\bjbl\b/i, "JBL"],
  [/\btcl\b/i, "TCL"],
  [/\bhisense\b/i, "Hisense"],
  [/\btecno\b/i, "Tecno"],
  [/\binfinix\b/i, "Infinix"],
  [/\bamazfit\b/i, "Amazfit"],
  [/\banker\b/i, "Anker"],
  [/\boppo\b/i, "OPPO"],
  [/\bhonor\b/i, "HONOR"],
  [/\blenovo\b|\bthinkpad\b|\bideapad\b/i, "Lenovo"],
  [/\bhp\b|laserjet|deskjet|\bpavilion\b/i, "HP"],
  [/\bdell\b|\binspiron\b/i, "Dell"],
  [/\bcanon\b/i, "Canon"],
  [/\bepson\b/i, "Epson"],
  [/\bxerox\b/i, "Xerox"],
];

export function brandForProduct(name: string): string {
  for (const [pattern, brand] of BRAND_PATTERNS) {
    if (pattern.test(name)) return brand;
  }
  return "Hayaan Market";
}
