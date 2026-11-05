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

  // Task 138 — Samsung Galaxy A17 family (owner request: the base listing
  // plus the two sanguni variants, all SEO/AEO-optimized). Same rules as the
  // A18 override: price-dependent strings stay functions of the live catalog
  // price, and cross-variant answers describe the family WITHOUT hardcoding
  // sibling prices (only this listing's price is interpolated), so a future
  // reprice of any A17 variant can never leave a stale number here.
  "samsung-galaxy-a17": {
    heading: "Samsung Galaxy A17 — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A17 Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A17 price in Somalia: $${price} at Hayaan Market. 128GB Galaxy A17 with a 6.7-inch display, 50MP triple camera and 5000mAh battery.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A17 price in Somalia is $${price} at Hayaan Market — the 128GB Galaxy A17 with 4GB of RAM${inStock ? ", in stock and ready to order" : ""}. That buys a 6.7-inch display, a 50MP triple camera with ultrawide and macro lenses, a 13MP selfie camera and a 5000mAh battery, delivered to your door in Mogadishu or anywhere in the country. The A17 family is also stocked in a 6GB/128GB step-up and an 8GB/256GB top variant if you need more headroom.`,
    faqs: ({ price }) => [
      {
        q: "How much does the Samsung Galaxy A17 cost in Somalia?",
        a: `The Samsung Galaxy A17 price in Somalia is $${price} at Hayaan Market for the 128GB model with 4GB of RAM — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "What storage and RAM does this Galaxy A17 have?",
        a: "This listing is the 128GB storage / 4GB RAM variant. Hayaan Market also stocks the A17 in a 6GB/128GB step-up and an 8GB/256GB top variant if you need more storage or multitasking headroom.",
      },
      {
        q: "Is the Galaxy A17 a good phone for the price?",
        a: `For $${price} you get Samsung's 6.7-inch A17 with a 50MP triple camera (wide, ultrawide and macro), a 13MP selfie camera, 1080p video and a 5000mAh battery — an honest everyday Samsung at the entry of the Galaxy A-series ladder.`,
      },
      {
        q: "How do I order the Galaxy A17 and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 depending on your Mogadishu district, and a flat $6.95 anywhere else in Somalia — the exact fee is shown before you pay.",
      },
    ],
  },
  "samsung-galaxy-a17-6gb128gb": {
    heading: "Samsung Galaxy A17 (6GB/128GB) — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A17 6GB/128GB Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A17 (6GB/128GB) price in Somalia: $${price} at Hayaan Market. The smoother A17 — 6.7-inch display, 50MP triple camera, 5000mAh battery.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A17 (6GB/128GB) price in Somalia is $${price} at Hayaan Market${inStock ? ", in stock and ready to order" : ""}. This is the multitasker's A17: double the RAM of the base model, the same 6.7-inch display, 50MP triple camera with ultrawide and macro lenses, 13MP selfie camera and 5000mAh battery, delivered to your door in Mogadishu or anywhere in Somalia.`,
    faqs: ({ price }) => [
      {
        q: "How much is the Samsung Galaxy A17 (6GB/128GB) in Somalia?",
        a: `The 6GB/128GB Samsung Galaxy A17 price in Somalia is $${price} at Hayaan Market — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "What is the difference between the A17 6GB/128GB and the base A17?",
        a: "Both share the same 6.7-inch display, 50MP triple camera and 5000mAh battery. This variant doubles the RAM to 6GB for smoother multitasking; the base listing runs 4GB. If you also want double the storage, the A17 8GB/256GB tops the family.",
      },
      {
        q: "Is 128GB storage enough on the A17?",
        a: "128GB holds tens of thousands of photos and hundreds of apps, and the A17 keeps a microSD slot so storage can grow later — RAM, which you cannot upgrade, is where this 6GB variant earns its keep.",
      },
      {
        q: "How do I order the Galaxy A17 (6GB/128GB) and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 in Mogadishu by district and a flat $6.95 nationwide — the exact fee is shown before you pay.",
      },
    ],
  },
  "samsung-galaxy-a17-8gb256gb": {
    heading: "Samsung Galaxy A17 (8GB/256GB) — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A17 8GB/256GB Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A17 (8GB/256GB) price in Somalia: $${price} at Hayaan Market. The top A17 — 256GB storage, 8GB RAM, 50MP camera, 5000mAh battery.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A17 (8GB/256GB) price in Somalia is $${price} at Hayaan Market${inStock ? ", in stock and ready to order" : ""}. This is the top of the A17 family: 256GB of storage for years of photos and video, 8GB of RAM, a 6.7-inch display, the 50MP triple camera with ultrawide and macro lenses and a 5000mAh battery, delivered to your door in Mogadishu or anywhere in the country.`,
    faqs: ({ price }) => [
      {
        q: "How much is the Samsung Galaxy A17 (8GB/256GB) in Somalia?",
        a: `The 8GB/256GB Samsung Galaxy A17 price in Somalia is $${price} at Hayaan Market — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "What do you get with the A17 8GB/256GB over the smaller variants?",
        a: "The same 6.7-inch display, 50MP triple camera and 5000mAh battery as every A17, with the most storage (256GB) and the most RAM (8GB) in the family — the pick if you shoot a lot of video or keep your library offline.",
      },
      {
        q: "Is 256GB worth it on a budget phone?",
        a: "Storage is the one thing you cannot add to a phone later, and 256GB is where an A17 stops feeling like a budget phone after two or three years of photos, apps and offline media. Light users are fine on the 128GB listings; heavy users never regret the 256GB.",
      },
      {
        q: "How do I order the Galaxy A17 (8GB/256GB) and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 in Mogadishu by district and a flat $6.95 nationwide — the exact fee is shown before you pay.",
      },
    ],
  },

  // Task 148 — Samsung Galaxy A-series long-tail cluster (owner request: the
  // Google autocomplete suggestions "a56/a57/a15/a16/a17 samsung price in
  // somalia"). The A16/A56/A57 PDPs are the conversion pages for those
  // queries; same rules as every override above — price-dependent strings
  // stay functions of the LIVE catalog price, only THIS listing's price is
  // interpolated, and sibling prices are never hardcoded here (a reprice of
  // any other model can never leave a stale number in these strings).
  // Model-level specs cited from Samsung's published spec sheets (verified
  // 2026-11-05: A16 = 6.7" Super AMOLED / 50MP / IP54 / 25W / six-OS-upgrade
  // promise; A56 5G = Exynos 1580 / 120Hz Super AMOLED / 50MP OIS / 45W;
  // A57 5G = 50MP OIS Nightography / IP68 / six OS upgrades / 6.7" Super
  // AMOLED Plus), hedged to the listing where the catalog copy is thin.
  "samsung-galaxy-a16": {
    heading: "Samsung Galaxy A16 — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A16 Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A16 price in Somalia: $${price} at Hayaan Market. 6.7-inch Super AMOLED, 50MP camera, 5000mAh battery, IP54 rating.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A16 price in Somalia is $${price} at Hayaan Market${inStock ? ", in stock and ready to order" : ""}. Samsung's 2024 budget anchor buys a 6.7-inch Super AMOLED display, a 50MP triple camera, a 5000mAh battery with 25W fast charging, an IP54 rating and one of the longest software runways in its class — delivered to your door in Mogadishu or anywhere in the country. It is the cheapest way into a brand-new Samsung in this catalog.`,
    faqs: ({ price }) => [
      {
        q: "How much does the Samsung Galaxy A16 cost in Somalia?",
        a: `The Samsung Galaxy A16 price in Somalia is $${price} at Hayaan Market — a fixed USD price with no VAT added at checkout, and the lowest-priced new Samsung phone in the catalog.`,
      },
      {
        q: "What does the Galaxy A16 offer at this price?",
        a: "Samsung's October 2024 release gives the A16 a 6.7-inch Super AMOLED display (a step up from the A15's 6.5-inch panel), a 50MP triple camera, a 5000mAh battery with 25W fast charging, an IP54 dust and splash rating and a microSD slot — plus Samsung's budget-class-leading promise of six generations of Android OS upgrades.",
      },
      {
        q: "Is the Galaxy A16 a good budget phone?",
        a: `At $${price} it is the entry rung of the Galaxy ladder: an honest big-screen Samsung for calls, WhatsApp, YouTube and everyday apps. If your budget stretches further, the A17 and A18 above it add sharper cameras, faster chipsets and water resistance — but the A16 covers the essentials for the least money.`,
      },
      {
        q: "How do I order the Galaxy A16 and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 depending on your Mogadishu district, and a flat $6.95 anywhere else in Somalia — the exact fee is shown before you pay.",
      },
    ],
  },

  "samsung-galaxy-a56-5g": {
    heading: "Samsung Galaxy A56 5G — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A56 5G Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A56 5G price in Somalia: $${price} at Hayaan Market. 256GB with Exynos 1580, 120Hz Super AMOLED and a 50MP OIS camera.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A56 5G price in Somalia is $${price} at Hayaan Market${inStock ? ", in stock and ready to order" : ""} — the 256GB model. That buys Samsung's Exynos 1580 chipset, a 6.7-inch 120Hz Super AMOLED display, a 50MP main camera with optical image stabilization plus ultrawide and macro lenses, a 12MP selfie camera, 4K video, a 5000mAh battery with 45W charging and Gorilla Glass Victus+ — delivered to your door in Mogadishu or anywhere in the country.`,
    faqs: ({ price }) => [
      {
        q: "How much does the Samsung Galaxy A56 cost in Somalia?",
        a: `The Samsung Galaxy A56 5G price in Somalia is $${price} at Hayaan Market for the 256GB model — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "What do you get with the Galaxy A56 5G?",
        a: "Samsung's March 2025 mid-ranger: the Exynos 1580 chipset, a 6.7-inch 120Hz Super AMOLED display, a 50MP main camera with OIS plus a 12MP ultrawide and a 5MP macro, a 12MP selfie camera, 4K@30fps video, a 5000mAh battery with 45W Super Fast Charging, Gorilla Glass Victus+ and stereo speakers — Samsung's most complete mid-ranger of 2025.",
      },
      {
        q: "Is the Galaxy A56 5G good for gaming and photography?",
        a: "Yes, within its class: the Exynos 1580 with the Xclipse GPU handles everyday games smoothly on the 120Hz panel, and the OIS-equipped 50MP main camera plus Best Face editing is the same camera philosophy Samsung puts in its pricier phones — 4K video with gyro-EIS included.",
      },
      {
        q: "How do I order the Galaxy A56 5G and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 depending on your Mogadishu district, and a flat $6.95 anywhere else in Somalia — the exact fee is shown before you pay.",
      },
    ],
  },

  "samsung-galaxy-a57-5g-8gb256gb": {
    heading: "Samsung Galaxy A57 5G (8GB/256GB) — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A57 5G 8GB/256GB Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A57 5G (8GB/256GB) price in Somalia: $${price} at Hayaan Market. 50MP OIS Nightography camera, IP68, six OS upgrades.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A57 5G (8GB/256GB) price in Somalia is $${price} at Hayaan Market${inStock ? ", in stock and ready to order" : ""}. Samsung's newest mid-range Galaxy (released March 2026) brings a 50MP main camera with OIS and Nightography, a 6.7-inch Super AMOLED display, a 5000mAh battery that charges to 60% in 30 minutes, IP68 water resistance and six generations of Android OS upgrades promised — delivered to your door in Mogadishu or anywhere in the country.`,
    faqs: ({ price }) => [
      {
        q: "How much is the Samsung Galaxy A57 in Somalia?",
        a: `The Samsung Galaxy A57 5G price in Somalia is $${price} at Hayaan Market for the 8GB RAM / 256GB storage variant — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "What do you get with the Galaxy A57 5G?",
        a: "Samsung's March 2026 release: a 50MP main camera with optical image stabilization and Nightography, joined by a 12MP ultrawide and a 5MP macro, a 12MP selfie camera, 4K@30fps video, a 6.7-inch Super AMOLED display, a 5000mAh battery with fast charging (60% in about 30 minutes), IP68 water resistance and a promise of six generations of Android OS upgrades.",
      },
      {
        q: "What is the difference between the two Galaxy A57 variants?",
        a: "The camera, display, battery and 256GB storage are identical across the family — the step-up variant doubles the RAM to 12GB for heavier multitasking and longer usable life. This listing is the 8GB RAM / 256GB storage variant, which covers everyday use comfortably.",
      },
      {
        q: "How do I order the Galaxy A57 5G and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 depending on your Mogadishu district, and a flat $6.95 anywhere else in Somalia — the exact fee is shown before you pay.",
      },
    ],
  },

  "samsung-galaxy-a57-5g-12gb256gb": {
    heading: "Samsung Galaxy A57 5G (12GB/256GB) — price in Somalia and buying FAQs",
    title: ({ price }) =>
      `Samsung Galaxy A57 5G 12GB/256GB Price in Somalia — $${price} | Hayaan Market`,
    metaDescription: ({ price, inStock }) =>
      `Samsung Galaxy A57 5G (12GB/256GB) price in Somalia: $${price} at Hayaan Market. The top A57 — 12GB RAM, 256GB, 50MP OIS camera, IP68.${inStock ? " Order online." : " Check back soon."}`,
    intro: ({ price, inStock }) =>
      `The Samsung Galaxy A57 5G (12GB/256GB) price in Somalia is $${price} at Hayaan Market${inStock ? ", in stock and ready to order" : ""} — the top of the A57 family. Same hardware that makes the A57 Samsung's strongest mid-ranger yet: the 50MP OIS Nightography camera with ultrawide and macro lenses, a 6.7-inch Super AMOLED display, a 5000mAh battery, IP68 water resistance and six promised Android OS upgrades — with double the RAM (12GB) for years of smooth multitasking, delivered to your door in Mogadishu or anywhere in the country.`,
    faqs: ({ price }) => [
      {
        q: "How much is the Samsung Galaxy A57 (12GB/256GB) in Somalia?",
        a: `The 12GB/256GB Samsung Galaxy A57 5G price in Somalia is $${price} at Hayaan Market — a fixed USD price with no VAT added at checkout.`,
      },
      {
        q: "Who should buy the 12GB Galaxy A57 over the 8GB one?",
        a: "Anyone keeping the phone three-plus years, juggling heavy apps, editing video, or sharing the phone across work and family — RAM is the one spec you cannot upgrade later. The camera, display, battery, IP68 rating and 256GB storage are identical to the 8GB variant; this listing simply doubles the memory.",
      },
      {
        q: "Is the Galaxy A57 5G waterproof?",
        a: "It carries an IP68 rating — dust-tight and protected against submersion, a spec that used to belong to Samsung's flagships. That covers splashes, rain and brief submersion, though like any phone it should be dried before charging.",
      },
      {
        q: "How do I order the Galaxy A57 (12GB/256GB) and how much is delivery?",
        a: "Add it to your cart on this page and pay with EVC Plus, Edahab or card. Delivery is $1.50–$3.00 depending on your Mogadishu district, and a flat $6.95 anywhere else in Somalia — the exact fee is shown before you pay.",
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
