// Answer Engine Optimization (AEO) — Task 77.
//
// Question/answer data used for:
//  * visible FAQ blocks (footer site-wide, category pages, blog guides)
//  * FAQPage JSON-LD (homepage, per-category, per-post)
//
// Every answer is grounded in verified store facts only:
//   - shipping: district fees $1.50–$3.00, free ≥ $75, $6.95 flat outside
//     Mogadishu (src/lib/shipping.ts, owner's Sep 2026 fee sheet)
//   - payment: Sifalo Pay is the only method, USD, no VAT
//     (src/components/store/checkout.tsx, src/lib/sifalo-server.ts)
//   - bulk orders: /quote B2B request page (Task 57)
//   - support: WhatsApp +252 61 599 0144 / support@hayaan.co (footer)
// Prices quoted in answers come from the live catalog / Task 73 guides.

export interface FaqEntry {
  q: string;
  a: string;
}

export const SUPPORT_WHATSAPP = "+252 61 599 0144";

export const SITE_FAQS: FaqEntry[] = [
  {
    q: "What is Hayaan Market?",
    a: "Hayaan Market (hayaan.co) is a Somali online marketplace. You can buy electronics, TVs, laptops, phones, power and charging gear, home and office equipment, and health supplements at fixed USD prices, pay securely through Sifalo Pay, and get your order delivered to your door.",
  },
  {
    q: "How do I order from Hayaan Market?",
    a: "Browse the catalog, add items to your cart, then check out with your name, phone number and delivery district. You pay through Sifalo Pay's secure checkout and the order is delivered to your address. Offices, schools and hotels can also send a bulk request at hayaan.co/quote.",
  },
  {
    q: "How much does delivery cost in Mogadishu?",
    a: "Delivery inside Mogadishu is priced per district — from $1.50 (Hodan, Waberi, Wadajir) up to $3.00 (Daynile, Kahda, Gubadley, Darussalam, Garasbaaley). The exact fee for your district is shown at checkout before you pay.",
  },
  {
    q: "Is shipping free?",
    a: "Yes — orders with a subtotal of $75 or more ship free to any Mogadishu district. Below $75 the standard district fee applies, and outside Mogadishu the flat nationwide fee is $6.95.",
  },
  {
    q: "Do you deliver outside Mogadishu?",
    a: "Yes. Delivery anywhere else in Somalia is a flat $6.95 regardless of order size. Enter your city at checkout and the fee is calculated automatically before payment.",
  },
  {
    q: "How do I pay?",
    a: "All orders are paid securely through Sifalo Pay. Prices are in US dollars and no VAT is charged — the total you confirm at checkout (product price plus the shown delivery fee) is exactly what you pay.",
  },
  {
    q: "Can I buy in bulk for my office, school or shop?",
    a: "Yes. Use the bulk request page at hayaan.co/quote to describe what you need — printers, laptops, TVs, supplements or a full office setup — and the team will follow up with a tailored offer.",
  },
  {
    q: "How do I contact support?",
    a: `Message us on WhatsApp at ${SUPPORT_WHATSAPP} or email support@hayaan.co. We can help with product questions, order status and delivery details.`,
  },
];

// Per-category Q&A targeting "buy X in Somalia" conversational prompts
// (the phrasing people type into ChatGPT / Perplexity / AI Overviews).
export const CATEGORY_FAQS: Record<string, FaqEntry[]> = {
  "computers-tv-gaming": [
    {
      q: "Where can I buy a laptop or TV online in Somalia?",
      a: "Hayaan Market's Computers & TV section lists MacBook laptops, smart TVs, PS5 consoles and projectors — from a 43-inch LG at around $450 up to the 85-inch Samsung flagship — all with fixed USD prices and door delivery in Mogadishu.",
    },
    {
      q: "How much does a smart TV cost in Somalia?",
      a: "On hayaan.co smart TVs currently run from about $450 for a 43-inch LG up to $2,350 for the 85-inch Samsung. Every listing shows the exact price before you order, and orders over $75 ship free inside Mogadishu.",
    },
    {
      q: "Do gaming consoles and projectors come with delivery?",
      a: "Yes — PlayStation 5 consoles, projectors like the Epson CO-W01 ($350) and everything else in the catalog deliver to any Mogadishu district ($1.50–$3.00) or anywhere in Somalia for a flat $6.95.",
    },
  ],
  "phones-wearables": [
    {
      q: "Where can I buy a phone online in Somalia?",
      a: "Hayaan Market's Phones & Wearables section sells smartphones and smartwatches online with fixed USD prices — from budget Android models around $118 up to flagships — delivered to your district in Mogadishu or anywhere in Somalia.",
    },
    {
      q: "What is the cheapest smartphone price in Somalia?",
      a: "Budget Android phones on hayaan.co start around $118. Every listing shows the exact USD price, so you can compare models side by side before paying through Sifalo Pay.",
    },
    {
      q: "Do phone prices include delivery?",
      a: "The listed price is the product price. Delivery adds $1.50–$3.00 inside Mogadishu depending on your district — and it is free on orders of $75 or more.",
    },
  ],
  "health-supplements": [
    {
      q: "Where can I buy vitamins and supplements online in Somalia?",
      a: "Hayaan Market's Health Supplements section ships multivitamins and wellness products across Mogadishu and Somalia — fixed USD prices, secure Sifalo Pay checkout and door delivery.",
    },
    {
      q: "How do I pick a good multivitamin?",
      a: "Check the label for the nutrients and dose per serving, count the servings per bottle, and buy from a listing that shows the exact price and stock. The supplements buyer guide on the Hayaan blog walks through the full checklist.",
    },
    {
      q: "Can offices or gyms order supplements in bulk?",
      a: "Yes — send a bulk request at hayaan.co/quote describing what you need and the team will follow up with a tailored offer.",
    },
  ],
  "home-office": [
    {
      q: "Where can I buy office equipment online in Somalia?",
      a: "The Home & Office section on hayaan.co lists printers, laptops, monitors and office essentials with fixed USD prices and delivery to your door in Mogadishu ($1.50–$3.00) or nationwide ($6.95).",
    },
    {
      q: "Which printer should I buy for a small office?",
      a: "Pick the printer first, then match its toner model — Hayaan lists printers and their cartridges so you can add both to one cart and reach the $75 free-shipping threshold in a single order.",
    },
    {
      q: "Can I order a full office setup?",
      a: "Yes. For schools, hotels and offices, send a bulk request at hayaan.co/quote with the items and quantities you need and you'll get a tailored offer.",
    },
  ],
  "power-charging-audio": [
    {
      q: "Where can I buy power banks online in Somalia?",
      a: "Hayaan Market's Power & Charging section sells high-capacity power banks (like the Green Lion 80,000mAh at $65), chargers and audio gear with fixed USD prices and door delivery.",
    },
    {
      q: "What does delivery cost for chargers and speakers?",
      a: "$1.50–$3.00 inside Mogadishu depending on your district, free on orders of $75 or more, and a flat $6.95 anywhere else in Somalia.",
    },
    {
      q: "Are the listed prices final?",
      a: "Yes — the USD price on the listing is the price you pay. There is no VAT; the only extra is the delivery fee shown at checkout before you confirm payment.",
    },
  ],
};

/** Site-wide fallback for categories without hand-written Q&A. */
export const GENERIC_CATEGORY_FAQS: FaqEntry[] = [
  {
    q: "Can I order this category online in Somalia?",
    a: "Yes — Hayaan Market delivers nationwide. Orders inside Mogadishu cost $1.50–$3.00 to deliver depending on your district, orders of $75 or more ship free, and anywhere else in Somalia is a flat $6.95.",
  },
  {
    q: "How do I pay for my order?",
    a: "Through Sifalo Pay, securely, in US dollars. The total (product price plus the delivery fee shown at checkout) is confirmed before you pay, and no VAT is charged.",
  },
];

export function categoryFaqsFor(slug: string): FaqEntry[] {
  return CATEGORY_FAQS[slug] ?? GENERIC_CATEGORY_FAQS;
}

/** FAQPage JSON-LD graph node from a list of Q&As. */
export function faqPageJsonLd(faqs: FaqEntry[], pageUrl?: string) {
  return {
    "@type": "FAQPage",
    ...(pageUrl ? { url: pageUrl } : {}),
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
