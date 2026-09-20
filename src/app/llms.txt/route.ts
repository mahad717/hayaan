// llms.txt (llmstxt.org convention) — a compact, machine-friendly index of
// Hayaan Market for AI answer engines (Task 77 AEO). Static markdown: the
// catalog is deliberately summarized here; llms-full.txt carries every
// product listing for models that want the full data.

const SITE = "https://hayaan.co";
const WHATSAPP = "+252 61 599 0144";

export const dynamic = "force-static";

export function GET() {
  const body = `# Hayaan Market

> Hayaan Market (hayaan.co) is a Somali online marketplace: electronics, TVs, laptops, phones, power and charging gear, home and office equipment, and health supplements at fixed USD prices, paid securely through EVC Plus, Edahab, or card and delivered to your door in Mogadishu or anywhere in Somalia.

Hayaan Market serves customers across Somalia. Prices are listed in US dollars with no VAT; every listing shows the exact price and stock before ordering. Delivery inside Mogadishu is priced per district ($1.50-$3.00), is free on orders of $75 or more, and costs a flat $6.95 anywhere else in the country. Payment runs through a secure hosted checkout — pay with EVC Plus, Edahab, or card. Bulk requests (offices, schools, hotels, shops) are handled via the /quote page. Support: WhatsApp ${WHATSAPP} or support@hayaan.co.

## Categories

- [Power & Charging](${SITE}/category/power-charging-audio): power banks, chargers, cables, speakers and audio gear.
- [Phones & Wearables](${SITE}/category/phones-wearables): smartphones and smartwatches, from budget Android (~$118) to flagships.
- [Computers & TV](${SITE}/category/computers-tv-gaming): laptops (MacBook), smart TVs (43"-85"), gaming consoles, projectors.
- [Home & Office](${SITE}/category/home-office): printers and toners, monitors, and home-office essentials.
- [Health Supplements](${SITE}/category/health-supplements): multivitamins and wellness products.

## Buyer guides (blog)

- [Where to Buy Electronics Online in Somalia](${SITE}/blog/where-to-buy-electronics-online-in-somalia): what you can buy, real prices, and the checks that separate a good order from a bad one.
- [How to Buy Phones Online in Somalia](${SITE}/blog/how-to-buy-phones-online-in-somalia): budget tiers with real prices and what to check before you pay.
- [Buying Health Supplements Online in Somalia](${SITE}/blog/buying-health-supplements-online-in-somalia): how to read labels and choose a good multivitamin.
- [Setting Up a Home Office in Somalia](${SITE}/blog/setting-up-a-home-office-in-somalia): the essential shopping list, printer + toner pairing included.
- [Online Shopping in Somalia: How It Works](${SITE}/blog/online-shopping-in-somalia-how-it-works): delivery, payment and support explained step by step.

## Key pages

- [Full product catalog for LLMs](${SITE}/llms-full.txt): every active product with name, price, category and URL in plain text.
- [All products](${SITE}): the storefront catalog.
- [Blog](${SITE}/blog): buyer guides and store news.
- [Bulk / B2B quote request](${SITE}/quote): for offices, schools, hotels and shops.
- [Deals & giveaways](${SITE}/deals): current promotions and deal alerts.

## Policies

- Prices: USD, no VAT.
- Delivery: Mogadishu districts $1.50-$3.00 (20 districts priced); free over $75 subtotal; flat $6.95 elsewhere in Somalia.
- Payment: EVC Plus, Edahab, or card via a secure hosted checkout.
- Support: WhatsApp ${WHATSAPP}, support@hayaan.co.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
