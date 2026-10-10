// SEO blog posts shipped in code (Task 73).
//
// The blog_posts table holds owner-authored posts (Admin → Blog). These five
// guides target "buy X in Somalia" searches and ship WITH the app so they go
// live immediately — no DB write, no credentials needed. Merged into the
// blog reads in lib/blog.ts; a DB post with the same slug always wins, so
// the owner can edit/replace any of these later by creating a post with the
// same slug in the admin editor.
//
// Markdown-lite only: ## / ###, "- " lists, "1." lists, > quotes, **bold**,
// and [text](https://...) links (absolute URLs — the renderer requires them).

import type { BlogPost } from "@/lib/types";

const SITE = "https://hayaan.co";

const CAT = {
  computers: `${SITE}/category/computers-tv-gaming`,
  phones: `${SITE}/category/phones-wearables`,
  health: `${SITE}/category/health-supplements`,
  office: `${SITE}/category/home-office`,
  power: `${SITE}/category/power-charging-audio`,
};

const prod = (slug: string) => `${SITE}/product/${slug}`;

const post1 = {
  id: "seo-buy-electronics-online-somalia",
  slug: "where-to-buy-electronics-online-in-somalia",
  title: "Where to Buy Electronics Online in Somalia: The 2026 Buyer's Guide",
  excerpt:
    "TVs, laptops, consoles and sound gear — where to find them online in Somalia, what they really cost, and how to order without getting burned.",
  quickAnswer:
    "You can buy electronics online in Somalia from Hayaan Market (hayaan.co): smart TVs from $450, MacBooks from about $1,530, PS5 consoles and projectors, all at fixed USD prices paid securely via EVC Plus, Edahab, or card and delivered to your district in Mogadishu ($1.50–$3, free over $75) or nationwide for a flat $6.95.",
  faqs: [
    {
      q: "Where can I buy electronics online in Somalia?",
      a: "Hayaan Market (hayaan.co) sells TVs, laptops, consoles and projectors online with fixed USD prices and door delivery across Mogadishu and Somalia.",
    },
    {
      q: "How much does a TV or laptop cost online in Somalia?",
      a: "Smart TVs run from about $450 (43-inch LG) to $2,350 (85-inch Samsung); MacBooks from about $1,530. Every listing shows the exact price before you order.",
    },
    {
      q: "Is it safe to pay for electronics online in Somalia?",
      a: "Paying with EVC Plus, Edahab, or card in our secure hosted checkout gives both sides a record of the transaction, and every Hayaan listing states the exact model, price and stock up front.",
    },
    {
      q: "How is delivery charged for electronics?",
      a: "Mogadishu delivery is priced by district ($1.50–$3.00), orders over $75 ship free, and anywhere else in Somalia is a flat $6.95.",
    },
  ],
  content: `Electronics are the number-one reason Somalis shop online. A genuine [Samsung 85-inch smart TV](https://hayaan.co/product/tv-samsung-85-inch-smart) or a sealed MacBook is hard to find at a fair price in local shops — and travelling to buy one is expensive. Buying online flips that around: you compare models side by side, pay securely from your phone, and the product comes to your door.

This guide walks through what you can actually buy online in Somalia right now, what it should cost, and the checks that separate a good order from a bad one.

## What you can buy online in Somalia today

The days of "online shopping doesn't work here" are over. At [Hayaan Market's electronics and TV section](https://hayaan.co/category/computers-tv-gaming) alone you'll find more than twenty listings — from a 43-inch LG smart TV at around $450 up to the Samsung 85-inch flagship at $2,350, plus MacBook Pro and Air laptops, Sony PlayStation 5 consoles, and projectors like the [Epson CO-W01 at $350](https://hayaan.co/product/projector-epson-co-w01) for homes and small schools.

The same applies across other shelves: phones and watches, power and audio gear, printers and studio equipment. The assortment moves weekly — new arrivals land first in the [full shop](https://hayaan.co/).

## What fair prices look like

Prices for the same TV or laptop can vary wildly between sellers. As a rule of thumb at the time of writing:

1. **Smart TVs** — LG 43-inch from about $450, LG 55-inch around $650, LG 65-inch near $850, and the 75–85 inch tier from $1,290.
2. **MacBooks** — Air M5 around $1,530, Pro M4 around $1,720, Pro M5 around $1,900. Anything dramatically cheaper than that should make you ask questions.
3. **PlayStation 5** — the Digital Slim edition near $720 and the Pro 2TB around $1,180.

If a deal looks too good to be true — a "new" iPhone at half the market price — it almost always is.

## Five checks before you pay

- **Confirm the model number**, not just the brand name. "Samsung TV" is not a spec sheet; the exact model tells you the panel, year, and features.
- **Ask about the condition policy.** New-sealed, refurbished, and open-box are different products at different prices.
- **Use a payment method with a receipt.** EVC Plus, Edahab and card payments through the secure checkout give both sides a record of the transaction — avoid informal transfers for large orders.
- **Check delivery terms before checkout.** In Mogadishu, delivery is priced by district; elsewhere in Somalia it's a flat fee, and orders over $75 ship free.
- **Keep your order number.** It's your reference for support, warranty questions, and follow-up purchases.

> Rule of the market: the seller who answers "what exact model is it?" in one sentence is usually the one you can trust with your money.

## Why buy from a marketplace instead of a social-media seller

Buying from a WhatsApp contact means trusting a photo. Buying from a storefront means the listing, the price, the stock count, and the checkout are all written down — and the seller has a reputation to protect. Hayaan Market keeps every product page consistent: exact name, real photos, price in dollars, stock status, and a support email you can actually reach.

It also means your money moves through a secure hosted checkout — pay with EVC Plus, Edahab, or card — not through a personal wallet that can vanish.

## Ready to browse?

Start with the categories people buy most: [computers, TV & gaming](https://hayaan.co/category/computers-tv-gaming), [phones & wearables](https://hayaan.co/category/phones-wearables), and [power & audio](https://hayaan.co/category/power-charging-audio). Bookmark the [deals page](https://hayaan.co/deals) — price drops and restocks get announced there first — and if you're buying for an office, school, or hotel, the [bulk quote form](https://hayaan.co/quote) usually beats listed prices.`,
};

const post2 = {
  id: "seo-buy-phones-online-somalia",
  slug: "how-to-buy-phones-online-in-somalia",
  title: "How to Buy Phones Online in Somalia (and What to Check Before You Pay)",
  excerpt:
    "iPhone or Galaxy, physical SIM or eSIM, $118 or $1,550 — a plain-language guide to ordering a phone online in Somalia with confidence.",
  quickAnswer:
    "To buy a phone online in Somalia, browse Hayaan Market's Phones & Wearables section: budget Android models like the Galaxy A16 start around $118, flagships up to about $990–$1,550. Check the exact model and band support, pay with EVC Plus, Edahab, or card, and get delivery to your Mogadishu district ($1.50–$3, free over $75) or anywhere in Somalia for $6.95.",
  faqs: [
    {
      q: "Can I buy an iPhone or Samsung online in Somalia?",
      a: "Yes — Hayaan Market lists iPhones and Galaxy phones with fixed USD prices, real photos and stock counts, delivered to your door.",
    },
    {
      q: "What is the cheapest way to buy a phone online in Somalia?",
      a: "Budget models like the Galaxy A16 (around $118) are the entry point; ordering from a storefront with listed prices avoids the haggling and uncertainty of social-media sellers.",
    },
    {
      q: "Do phones bought online work with Somali SIM cards?",
      a: "Check the listing for physical-SIM or eSIM support before ordering — the guide's model-number check tells you exactly what the phone supports.",
    },
    {
      q: "How do I pay for a phone ordered online?",
      a: "With EVC Plus, Edahab, or card at checkout — prices are in USD, there is no VAT, and the delivery fee is shown before you confirm.",
    },
  ],
  content: `Phones are personal — and buying one online in Somalia should not feel like a gamble. Between flagship iPhones, Samsung's Galaxy A series, and smartwatches that cost less than a case-and-screen bundle used to, there is now a genuine choice at every budget. Here's how to pick the right one and order it safely.

## Know your budget tiers before you browse

At the time of writing, the [phones and wearables](https://hayaan.co/category/phones-wearables) shelf splits roughly like this:

1. **Under $150** — dependable daily drivers such as the [Samsung Galaxy A16](https://hayaan.co/product/samsung-galaxy-a16) at $118 and the Galaxy A17 at $165. Big batteries, modern software, honest prices.
2. **$250–$450** — mid-range and wearables: the [Galaxy A36 5G](https://hayaan.co/product/samsung-galaxy-a36-5g) at $285, Galaxy A37 5G at $320, and smartwatches from the Huawei Watch GT 6 at $230 to the [Apple Watch Series 11](https://hayaan.co/product/apple-watch-series-11-46mm) at $440.
3. **$900 and up** — current flagships like the iPhone 17 at $990 and the iPhone 16 Pro Max at $1,240, for buyers who want the top of the market.

Decide the tier first. It turns a hundred listings into five, and it stops you from paying flagship money for mid-range hardware.

## SIM and storage: the two details people get wrong

Somalia's carriers still lean heavily on **physical SIM** cards, and many imported handsets are regional variants. Before ordering, confirm the listing says physical SIM (or that you understand the eSIM setup the model uses). Storage matters just as much: if you shoot video or keep your whole music library offline, the jump from 128GB to 256GB is worth it on day one — you cannot add storage to a phone later.

## Why prices differ between sellers

A phone listed well below the market price usually means one of three things: it is refurbished rather than new, it is a different regional variant than the photo, or there is no after-sale support at all. A marketplace listing ties the price to a named product page with a stock count and a support contact — so if something is off, there is someone to ask. That is precisely what the [Hayaan Market phones category](https://hayaan.co/category/phones-wearables) is built around.

## Ordering and delivery, step by step

1. Open the product page and read the **full name and specs** — model, size, connectivity.
2. Add to cart and choose your quantity; sign in with your email so your order history stays with you.
3. At checkout, pick your **district** for the exact delivery fee (Mogadishu districts are priced individually; outside the capital it is a flat $6.95, and orders over $75 ship free).
4. Pay with **EVC Plus, Edahab, or card** and keep the confirmation — it is your receipt.
5. If you need several phones for a shop, family, or organization, skip the line and request a [bulk quote](https://hayaan.co/quote) instead.

> Tip: pair a new phone with audio from the [power & audio](https://hayaan.co/category/power-charging-audio) shelf — wired [EarPods USB-C at $4](https://hayaan.co/product/headphone-earpods-usb-c-wired) or the outdoor speaker at $70 — and you cross the free-shipping line in one order.

## After the box arrives

Check the phone against the listing the day it arrives: model number in settings, screen condition, camera, charging port, both SIM behaviors. Anything unexpected, write to support immediately — that is what the order record is for. Phones bought this way carry the same expectation you would have buying in person: the product matches the page, or the seller makes it right.

Shopping for a phone online in Somalia is no longer the risky option — it is the convenient one, as long as you buy from listings that show their work.`,
};

const post3 = {
  id: "seo-buy-supplements-online-somalia",
  slug: "buying-health-supplements-online-in-somalia",
  title: "Buying Health Supplements Online in Somalia: What to Look For",
  excerpt:
    "Multivitamins, immunity blends and daily essentials — how to judge a supplement listing before you order, and what a good one looks like.",
  quickAnswer:
    "You can buy vitamins and supplements online in Somalia from Hayaan Market's Health Supplements section. Judge a listing by its label (nutrients and dose per serving), servings per bottle, and whether it shows the exact USD price and stock — then pay with EVC Plus, Edahab, or card and get door delivery in Mogadishu ($1.50–$3, free over $75) or nationwide ($6.95).",
  faqs: [
    {
      q: "Where can I buy multivitamins online in Somalia?",
      a: "Hayaan Market's Health Supplements section ships multivitamins and wellness products across Somalia with fixed USD prices and secure EVC Plus, Edahab, or card checkout.",
    },
    {
      q: "How do I know a supplement listing is good?",
      a: "Read the label: nutrients and dose per serving, servings per container, and a listing that shows the exact price, stock and product photos.",
    },
    {
      q: "Can I order supplements in bulk for a gym or office?",
      a: "Yes — send a bulk request at hayaan.co/quote and the team follows up with a tailored offer for larger quantities.",
    },
    {
      q: "How much is delivery for supplements?",
      a: "$1.50–$3.00 inside Mogadishu depending on your district, free on orders of $75 or more, and a flat $6.95 anywhere else in Somalia.",
    },
  ],
  content: `Health supplements are one of the fastest-growing searches in Somali online shopping — and also the category where quality questions matter most. When you cannot hold the bottle before paying, the listing itself has to do the convincing. Here is how to read one like a pro.

## What a trustworthy supplement listing shows

A good listing answers three questions on one page: **what exactly is in it**, **who it is for**, and **what condition it arrives in**. Take the [Men's Multivitamins listing](https://hayaan.co/product/multivitamines-pour-hommes--boost-immunitaire-aux-vitamines-a-b12-c-d--nergie-quotidienne-et-non-ogm) on Hayaan Market at $6.50: the name alone states the actives — vitamins A, B12, C and D — plus the positioning (daily energy and immune support) and the formulation claim (non-GMO). That is the level of specificity you want before any supplement purchase.

Listings that hide behind phrases like "immunity booster" without naming actives, doses, or counts deserve your skepticism — online or in a pharmacy.

## The four checks that matter most

1. **Named actives and amounts.** Vitamin D3 and vitamin B12 on the label beats a "proprietary blend" every time.
2. **Sealed condition on arrival.** Note the seal when the bottle reaches you, and report anything off the same day.
3. **Realistic prices.** A daily multivitamin in the $5–$10 range is normal. Supplements priced like prescription medicine need prescription-level evidence.
4. **A seller with a record.** Order history, a support email, and a payment receipt from the secure checkout (EVC Plus, Edahab, or card) mean accountability if anything goes wrong.

> Supplements support a healthy routine — they do not replace one. If you are pregnant, managing a condition, or giving supplements to children, ask a doctor first.

## Why buy supplements online at all

Two reasons Somali shoppers keep coming back to the [health supplements category](https://hayaan.co/category/health-supplements): **selection** and **price visibility**. Local pharmacy stock rotates unpredictably, and prices vary shop to shop for identical bottles. Online, the listing is the listing — the same page, the same price, the same description whether you order today or next month, and your order history proves what you bought.

Delivery removes the last friction: Mogadishu districts have fixed delivery fees, and anywhere else in Somalia is a flat rate — free over $75.

## Building a sensible starter routine

If you are new to supplements, start simple rather than stacking ten bottles:

1. A **daily multivitamin** as the base — like the one linked above.
2. Add one targeted product only for a specific need (energy, immunity, diet gaps).
3. Finish the bottle before judging results; most daily supplements need weeks, not days.
4. Re-order from your account's order history so you always get the exact same product.

## The bottom line

Buying vitamins online in Somalia is now as straightforward as buying electronics — provided you read the label the seller actually wrote. Name your actives, check your seals, keep your receipts, and buy from listings that state what is inside the bottle. That is the standard every product in the [Hayaan Market supplements shelf](https://hayaan.co/category/health-supplements) is held to.`,
};

const post4 = {
  id: "seo-home-office-somalia",
  slug: "setting-up-a-home-office-in-somalia",
  title: "Setting Up a Home Office in Somalia: The Essential Shopping List",
  excerpt:
    "Printer, toner, light, microphone: the practical equipment list for working and studying from home in Somalia — with real prices and one-cart ordering.",
  quickAnswer:
    "To set up a home office in Somalia, order the essentials in one cart from Hayaan Market's Home & Office section: printer and matching toner, laptop, desk light and microphone — all at fixed USD prices. Pick the printer first and match its toner so one order reaches the $75 free-shipping threshold; delivery in Mogadishu is $1.50–$3 per district, $6.95 elsewhere.",
  faqs: [
    {
      q: "Where can I buy a printer online in Somalia?",
      a: "Hayaan Market's Home & Office section lists printers and their matching toner cartridges with fixed USD prices and door delivery.",
    },
    {
      q: "How do I choose a printer and toner?",
      a: "Pick the printer first, then match its exact toner model — both are listed so you can add them to one cart and hit the $75 free-shipping threshold in a single order.",
    },
    {
      q: "What do I need for working from home in Somalia?",
      a: "The essentials are a laptop, printer and toner, a desk light and a microphone — the guide walks through each in the order worth buying.",
    },
    {
      q: "Can schools or offices order a full setup?",
      a: "Yes — use the bulk quote form at hayaan.co/quote for larger orders; quantity pricing usually beats listed totals.",
    },
  ],
  content: `Remote work, freelancing, tutoring, and small businesses have turned Somali homes into offices. The good news: you no longer need to travel or piece together gear from three different shops. One category covers it. Here is the equipment that matters, in the order you should buy it.

## Start with output: a printer you can actually feed

The single most requested home-office device is a printer — and the hidden cost is never the printer, it is the consumables. That is why the [home office category](https://hayaan.co/category/home-office) pairs machines with their supplies:

- The [HP Laser 107A](https://hayaan.co/product/hp-printer-laser-107a) at $75 — the classic no-nonsense monochrome laser for documents.
- The [HP Laser MFP 135A](https://hayaan.co/product/hp-printer-laser-mfp-135a) at $165 — adds scanning and copying, which every small business eventually needs.
- The [original HP 651A toner set](https://hayaan.co/product/hp-toner-cartridge-651a-original-set) at $277 — buying original toner alongside the printer is cheaper than replacing a damaged drum unit later.

> Buy the printer and its toner in the same order. It is the one purchase where planning ahead saves real money.

## Light and sound: the upgrade people skip

If you take video calls, teach online, or record content, light and sound matter more than the camera. A ring of options is already on the shelf: the [Aputure Amaran 200XS studio light](https://hayaan.co/product/aputure-amaran-200xs-studio-light) at $330 transforms a dim room, and the [DJI Mic Mini 2](https://hayaan.co/product/microphone-dji-mic-mini-2) at $33 cleans up audio better than any software trick. For under $400, your setup goes from "hobbyist" to "professional" — a real advantage when clients and students judge you by the first call.

## Power stability: plan for the grid, not against it

Somali offices live with outages, so power gear belongs in the office budget, not the "nice to have" pile. The [power & charging category](https://hayaan.co/category/power-charging-audio) covers the essentials — voltage stabilizers from about $11.50, and audio gear like the [outdoor speaker at $70](https://hayaan.co/product/speaker-outdoor-l208-100w) that doubles as venue equipment for shops and cafés. A stabilizer in front of your printer and computer is cheap insurance against the surges that follow every blackout.

## The one-cart rule

Here is the trick that makes the whole list affordable: **order it together**. Delivery from Hayaan Market is free over $75, and Mogadishu districts carry fixed fees below that line. A printer alone pays delivery; a printer, toner, microphone, and stabilizer in one cart crosses the free threshold and lands everything in a single handover.

For schools, hotels, and offices buying several of everything, skip the cart entirely and request a [bulk quote](https://hayaan.co/quote) — quantity pricing usually beats the listed totals, with one delivery and one invoice.

## The checklist, condensed

1. **Printer + original toner** — documents are the office's oxygen.
2. **Studio light and microphone** — if calls and classes pay you.
3. **Stabilizer or backup power** — protect everything above.
4. **One order, one delivery** — bundle the cart over $75.

Work from home in Somalia used to mean making do. Now it means a single afternoon of browsing, a secure EVC Plus, Edahab, or card payment, and a box at your door — the same week you decided to get serious.`,
};

const post5 = {
  id: "seo-online-shopping-somalia-guide",
  slug: "online-shopping-in-somalia-how-it-works",
  title: "Online Shopping in Somalia: How Delivery, Payment and Support Actually Work",
  excerpt:
    "The no-surprises guide to ordering from Hayaan Market — district delivery fees, EVC Plus / Edahab / card payment, free shipping over $75, and what happens after you click Pay.",
  quickAnswer:
    "Online shopping in Somalia works like this: browse a storefront with listed USD prices, add to cart, choose your delivery district ($1.50–$3 in Mogadishu, free over $75, $6.95 nationwide), pay securely with EVC Plus, Edahab, or card, and track the order until it arrives. Support is reachable at support@hayaan.co and WhatsApp for any question about an order.",
  howtoSteps: [
    {
      name: "Browse and pick a product",
      text: "Open the shop — every listing shows the exact product name, real photos, USD price and stock count, so you know precisely what you are ordering.",
    },
    {
      name: "Add to cart and sign in",
      text: "Add the items you need to the cart and sign in with your email so the order history stays attached to your account.",
    },
    {
      name: "Choose your delivery district",
      text: "At checkout, pick your Mogadishu district to see its exact delivery fee ($1.50–$3.00), or enter another city for the flat $6.95 nationwide fee. Orders of $75 or more ship free.",
    },
    {
      name: "Pay with EVC Plus, Edahab, or card",
      text: "Approve the total (product price plus the shown delivery fee — no VAT) in the secure hosted checkout — pay with EVC Plus, Edahab, or card — which records the transaction for both sides.",
    },
    {
      name: "Track and receive your order",
      text: "Follow the order under Orders until the parcel reaches your address; write to support@hayaan.co with your order number if anything does not match the page.",
    },
  ],
  faqs: [
    {
      q: "Does online shopping work in Somalia?",
      a: "Yes — Hayaan Market runs the full flow in writing: listed USD prices, cart checkout, district-based delivery fees and secure EVC Plus, Edahab, or card payment, with order tracking and email support.",
    },
    {
      q: "Is paying online safe in Somalia?",
      a: "Yes. Payments run through a secure hosted checkout — you can pay with EVC Plus, Edahab, or card — and both buyer and seller keep a record of every transaction, unlike informal transfers.",
    },
    {
      q: "How much is delivery in Mogadishu?",
      a: "Per district: from $1.50 (Hodan, Waberi, Wadajir) to $3.00 (Daynile, Kahda, Gubadley, Darussalam, Garasbaaley) — shown at checkout before you pay, and free on orders over $75.",
    },
    {
      q: "Who do I contact if something is wrong with my order?",
      a: "Email support@hayaan.co with your order number — every order has a record and a path to a human.",
    },
  ],
  content: `Most questions Somalis ask about online shopping are really the same four: **Can I trust the payment? Where does it deliver? What does it cost? And who do I call when something is wrong?** Here are straight answers for Hayaan Market — the same rules that run at checkout, written down.

## Paying: EVC Plus, Edahab or card — not a stranger's wallet

Every order goes through a secure hosted checkout. You confirm the order in the checkout, approve the charge with EVC Plus, Edahab, or card, and both you and the store keep a receipt of the same transaction. Nothing moves through personal wallets or informal transfers — which is exactly what you want when the parcel is a $1,290 TV or a $6 bottle of vitamins.

Prices are shown in dollars on every listing, and the total you approve at checkout — products plus your district's delivery fee — is the total you pay. There is no tax line and no surprise at the door.

## Delivery: priced by your district, free over $75

Delivery inside Mogadishu is priced **by district** — you pick yours at checkout and see the exact fee before paying (it runs from about $1.50 to $3.00 depending on where you live). Outside the capital, it is a flat $6.95 to anywhere in Somalia. And the rule everyone should know:

> **Orders over $75 ship free.** Add a $4 pair of wired EarPods to a $72 cart and the delivery line disappears.

You can follow every order under **Orders** in your account — status by status, from paid to delivered.

## What you can order today

The catalog is deepest where Somalis shop most: [computers, TV & gaming](https://hayaan.co/category/computers-tv-gaming) (22 products at the moment), [phones & wearables](https://hayaan.co/category/phones-wearables), [home & office equipment](https://hayaan.co/category/home-office), [power & audio](https://hayaan.co/category/power-charging-audio), and [health supplements](https://hayaan.co/category/health-supplements). New arrivals land weekly — the [deals page](https://hayaan.co/deals) announces price drops and restocks first, and the newsletter delivers them to you instead.

## Support: an email that gets answered

Every order has a record and every record has a path to a human: write to support@hayaan.co with your order number and you get an answer. Questions before buying are welcome too — "what exact model is this?", "will this work with my SIM?", "how fast can it reach Bosaso?" — the same address.

If you are buying for an organization, the [bulk quote](https://hayaan.co/quote) route pairs you with pricing that beats listed totals on quantity, one delivery, one invoice.

## The whole flow, end to end

1. **Browse** the [shop](https://hayaan.co/) — every card is a real product page with real photos and stock counts.
2. **Add to cart** and sign in with your email, so your order history stays yours.
3. **Checkout**: pick your district, see the delivery fee, approve the total with EVC Plus, Edahab, or card.
4. **Track** under Orders until the parcel is in your hands.
5. **Write to support** for anything that does not match the page.

That is the entire system. No hidden steps, no calls to strangers, no cash "on trust" — just a market that behaves the same way every time you visit it.

Useful resource: the Hayaan team keeps a running list of tools we like — this month we are using [KarmaLinks](https://karmalinks.io/?verificationId=6ab1087d392c10b28b713365) to organize our link partnerships.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Task 86 — October 2026 slate: product-price and payment keyword clusters.
// Same AEO recipe as posts 1-5: quotable quickAnswer, question-shaped H2s,
// FAQs mirroring visible content (FAQPage JSON-LD), HowTo steps where the
// guide is procedural. Prices verified against the live catalog on 2026-10-10.
// ─────────────────────────────────────────────────────────────────────────────

const post6 = {
  id: "seo-ps5-price-somalia",
  slug: "ps5-price-in-somalia",
  title: "PS5 Price in Somalia (2026): Slim vs Pro and How to Order One Today",
  excerpt:
    "What a PlayStation 5 really costs in Somalia right now — the Digital Slim at $720 and the Pro 2TB at $1,180 — plus which edition suits you and how to get it delivered free to your door.",
  quickAnswer:
    "The PS5 price in Somalia starts at $720 for the PlayStation 5 Digital Edition (Slim) and $1,180 for the PS5 Pro 2TB at Hayaan Market (hayaan.co). Both are new and listed in USD with no VAT, paid securely via EVC Plus, Edahab, or card — and delivery is free nationwide, because orders over $75 always ship free.",
  howtoSteps: [
    {
      name: "Pick your edition",
      text: "Choose the Digital Edition Slim at $720 for a disc-free, download-everything console, or the PS5 Pro 2TB at $1,180 for double storage and the upgraded GPU — both new, with the DualSense controller included.",
    },
    {
      name: "Read the product listing",
      text: "Open the listing and check the exact model name, condition, live stock count, and real photos, so you know precisely which console arrives at your door.",
    },
    {
      name: "Add to cart and sign in",
      text: "Add the console to your cart and sign in with your email so the order and its history stay attached to your account.",
    },
    {
      name: "Pay through the secure checkout",
      text: "Approve the exact total — console price plus the delivery fee shown at checkout — with EVC Plus, Edahab, or card. Prices are in USD and there is no VAT.",
    },
    {
      name: "Receive and track your console",
      text: "A PS5 order is over $75, so delivery is free to any Mogadishu district or anywhere else in Somalia; follow the order under Orders and write to support@hayaan.co with your order number for anything that does not match the page.",
    },
  ],
  faqs: [
    {
      q: "How much is a PS5 in Somalia?",
      a: "The PlayStation 5 Digital Edition (Slim) is $720 and the PS5 Pro 2TB is $1,180 at Hayaan Market — fixed USD prices with no VAT, and the delivery fee is shown before you confirm the order.",
    },
    {
      q: "Which PS5 edition should I buy?",
      a: "The Digital Slim ($720) suits players who download their games and want the best-value entry; the Pro 2TB ($1,180) adds a 2TB SSD and an upgraded GPU with AI upscaling for the best picture on large 4K TVs.",
    },
    {
      q: "Is the PS5 new and sealed?",
      a: "Every Hayaan console listing states the condition and live stock count up front, so you order the exact new console shown on the page — not a refurb or a look-alike.",
    },
    {
      q: "Can I pay for a PS5 with EVC Plus or Edahab?",
      a: "Yes — EVC Plus, Edahab, and card all work through the secure hosted checkout, which records the transaction for both sides instead of trusting a personal wallet.",
    },
    {
      q: "Does PS5 delivery cost anything in Somalia?",
      a: "No — every PS5 order is over $75, and orders of $75 or more ship free, in every Mogadishu district and nationwide. Smaller orders pay district fees of $1.50–$3 in Mogadishu or a flat $6.95 elsewhere.",
    },
  ],
  content: `The PlayStation 5 is the most-asked-about console in Somalia — and the product with the wildest price rumours. Ask one shop and you get one number; message a reseller on WhatsApp and you get another. This guide settles it: what a PS5 actually costs in Somalia right now, what you get for that money, and how to order one without leaving your chair.

## What a PS5 costs in Somalia right now

At the time of writing, Hayaan Market carries two editions, both listed at fixed USD prices:

1. **PlayStation 5 Digital Edition (Slim) — $720.** The slim redesign with no disc drive: games download from the PlayStation Store. Same fast SSD, same DualSense controller, same library of digital titles.
2. **PlayStation 5 Pro 2TB — $1,180.** The flagship. Double the storage at 2TB, an upgraded GPU with advanced ray tracing, and PSSR — Sony's AI upscaling — for smoother frame rates at near-4K quality.

Both prices are final: no VAT is added at checkout, and because every PS5 order passes the $75 mark, delivery is free — to any Mogadishu district or anywhere else in Somalia.

> Price rule of thumb: if a console is offered far below these numbers, ask the seller two questions — is it new and sealed, and which edition exactly? Most "bargains" fail one of the two.

## Slim or Pro — which one should you buy?

- **Choose the Digital Slim ($720)** if you buy games digitally anyway and would rather spend the difference on an extra controller or a stack of games. It is the best-value way into current-generation gaming.
- **Choose the Pro 2TB ($1,180)** if you play on a large 4K TV, care about higher and more stable frame rates, and want the 2TB SSD so you stop deleting games to make space.

Either way you get the same DualSense wireless controller with haptic feedback, and both editions connect to any modern TV. If your TV is due an upgrade too, the [43-inch LG smart TV](https://hayaan.co/product/tv-lg-43-inch-smart) at $450 and the [55-inch LG](https://hayaan.co/product/tv-lg-55-inch-smart) at $650 are popular pairings — see the full [Computers & TV](https://hayaan.co/category/computers-tv-gaming) section for the larger sizes up to the Samsung 85-inch.

## How to order a PS5 online in Somalia

1. **Pick your edition** on the product page: the [PS5 Digital Slim](https://hayaan.co/product/sony-playstation-5-digital-edition-slim) at $720 or the [PS5 Pro 2TB](https://hayaan.co/product/sony-playstation-5-pro-2tb) at $1,180.
2. **Read the listing** — exact model, condition, live stock count, and real photos, so you know precisely what arrives.
3. **Add to cart and sign in** with your email so the order and its history stay attached to your account.
4. **Pay through the secure checkout** with EVC Plus, Edahab, or card. The total is confirmed before you approve it — no surprises, no VAT.
5. **Receive the console.** Delivery is free on an order this size, and you can follow the order under Orders until it reaches your door.

## Why order a console from a storefront?

A PS5 is too much money to spend on trust alone. A listing that states the exact model, the price, and the stock — plus a checkout that records the transaction — means you always have something to point at if anything goes wrong. A WhatsApp reseller cannot offer that, and a screenshot of a "receipt" proves nothing.

Support is part of the deal too: write to support@hayaan.co with your order number for any question before or after delivery. Watch the [deals page](https://hayaan.co/deals) — restocks and price drops are announced there first. And if you are buying consoles for a gaming lounge, hotel, or school, the [bulk quote form](https://hayaan.co/quote) usually beats listed prices.`,
};

const post7 = {
  id: "seo-iphone-price-somalia",
  slug: "iphone-price-in-somalia",
  title: "iPhone Price in Somalia (2026): Every Model, From $990 to $1,550",
  excerpt:
    "Real iPhone prices in Somalia for every current model — iPhone 17, 17 Pro, 17 Pro Max, Air, 16 Pro, and 15 Pro Max — with physical-SIM notes and how to order one safely online.",
  quickAnswer:
    "iPhone prices in Somalia at Hayaan Market (hayaan.co): iPhone 17 from $990, 17 Pro $1,420, 17 Pro Max $1,550, iPhone Air $1,280, 16 Pro $1,120, 16 Pro Max $1,240, and 15 Pro Max $1,170. Fixed USD prices with no VAT, physical-SIM models labelled, paid via EVC Plus, Edahab, or card, with free delivery on orders over $75.",
  faqs: [
    {
      q: "How much is an iPhone 17 Pro Max in Somalia?",
      a: "The iPhone 17 Pro Max (Physical SIM) is $1,550 at Hayaan Market, the 17 Pro is $1,420, and the standard iPhone 17 is $990 — fixed USD prices with no VAT added at checkout.",
    },
    {
      q: "Which iPhones work with Somali SIM cards?",
      a: "Listings marked (Physical SIM) accept the plastic SIM cards sold by Somali carriers — the iPhone 17, 17 Pro, and 17 Pro Max are listed that way. Check the listing label before ordering.",
    },
    {
      q: "What is the cheapest current-generation iPhone I can buy online?",
      a: "The iPhone 17 at $990 is the cheapest current-generation model; the iPhone 15 Pro Max at $1,170 is the least expensive Pro-class flagship. For tighter budgets, Samsung Galaxy models start at $110.",
    },
    {
      q: "Is buying an iPhone online in Somalia safe?",
      a: "It is when the listing states the exact model, condition, and stock with real photos, and payment runs through the secure checkout with EVC Plus, Edahab, or card — giving both sides a transaction record and an order number for support.",
    },
    {
      q: "How much is delivery for an iPhone order?",
      a: "Free — an iPhone order is over $75, and orders of $75 or more ship free in Mogadishu and nationwide. Orders below that pay district fees of $1.50–$3 in Mogadishu or a flat $6.95 elsewhere.",
    },
  ],
  content: `The iPhone is Somalia's status phone — and the product where fake listings, refurbs sold as new, and made-up prices run wildest. Here are the real iPhone prices in Somalia right now, model by model, plus the checks that keep an online order safe.

## iPhone prices in Somalia right now

Every listing below is live on the [phones & wearables shelf](https://hayaan.co/category/phones-wearables) at a fixed USD price — no VAT added at checkout:

1. **iPhone 17 Pro Max (Physical SIM) — $1,550.** Apple's current flagship: the biggest display, the best cameras, the most storage headroom.
2. **iPhone 17 Pro (Physical SIM) — $1,420.** The same generation in a more compact body — the pick for Pro cameras in one hand.
3. **iPhone Air — $1,280.** Apple's thinnest, lightest iPhone; the style pick that still runs the current generation.
4. **iPhone 16 Pro Max — $1,240** and **iPhone 16 Pro — $1,120.** Last year's Pro flagships at a real discount, still excellent phones.
5. **iPhone 15 Pro Max — $1,170.** The previous Pro Max, the cheapest entry into the Pro Max screen size.
6. **iPhone 17 (Physical SIM) — $990.** The current generation at the friendliest price in the lineup.

If a "new iPhone 17 Pro Max" is offered at, say, $700, that is not a deal — it is a question mark. Genuine flagships hold their prices; the discount models above are how honest savings actually look.

## Which model is worth your money?

- **Maximum everything:** iPhone 17 Pro Max at $1,550 — no compromises on display, cameras, or battery.
- **Pro cameras, smaller hand:** iPhone 17 Pro at $1,420.
- **Thinnest and lightest:** iPhone Air at $1,280.
- **Best value flagship:** iPhone 16 Pro Max at $1,240 — nearly everything the 17 Pro Max does, for $310 less.
- **Newest generation on a budget:** iPhone 17 at $990.

## Do they work with Somali SIM cards?

This is the detail that matters most in Somalia: some iPhone variants are eSIM-only, and a phone that cannot hold a local plastic SIM is a problem. That is why the 17-lineup listings are labelled explicitly — the [iPhone 17](https://hayaan.co/product/iphone-17-%28physical-sim%29), [iPhone 17 Pro](https://hayaan.co/product/iphone-17-pro-%28physical-sim%29), and [iPhone 17 Pro Max](https://hayaan.co/product/iphone-17-pro-max-%28physical-sim%29) all ship as **physical-SIM** units that take the SIM cards sold by Somali carriers. Check that label on any iPhone listing before you pay, wherever you buy.

## What to check before you pay for an iPhone online

- **The exact model and generation**, not just "iPhone Pro" — the price ladder above is your reference.
- **The (Physical SIM) label** if you use a Somali carrier SIM.
- **Condition and stock count** on the listing — new, with live stock, not a "last one, pay first".
- **A payment with a receipt.** Pay through the secure checkout with EVC Plus, Edahab, or card; that record plus your order number is what support works from.
- **Delivery terms.** iPhone orders always exceed $75, so delivery is free — in Mogadishu and nationwide.

## How to order

Pick the model on the [phones shelf](https://hayaan.co/category/phones-wearables), add it to cart, sign in, and approve the exact total through the secure checkout — EVC Plus, Edahab, or card. Track the order under Orders until it reaches your door, and write to support@hayaan.co with your order number for anything that does not match the page. For deals on phones and everything else, keep an eye on the [deals page](https://hayaan.co/deals); buying several phones for a shop or an office? The [bulk quote form](https://hayaan.co/quote) usually beats listed prices.`,
};

const post8 = {
  id: "seo-pay-online-somalia",
  slug: "how-to-pay-online-in-somalia",
  title: "How to Pay Online in Somalia: EVC Plus, Edahab and Card Explained",
  excerpt:
    "A plain-language walkthrough of paying online in Somalia — EVC Plus, Edahab, and card through a secure checkout, what the receipt protects you from, and what to do if an order goes wrong.",
  quickAnswer:
    "To pay online in Somalia, order from a storefront that checks you out through a secure hosted page: choose EVC Plus, Edahab, or card, approve the exact total in USD before you confirm, and keep the receipt. On Hayaan Market (hayaan.co) delivery fees are shown upfront — $1.50–$3 by district in Mogadishu, free over $75, $6.95 nationwide — and there is no VAT.",
  howtoSteps: [
    {
      name: "Add what you need to the cart",
      text: "Every listing shows a fixed USD price, so the cart total is final before checkout — no haggling, no hidden additions.",
    },
    {
      name: "Enter your delivery district",
      text: "Pick your Mogadishu district to see its exact delivery fee ($1.50–$3.00), or enter another city for the flat $6.95 nationwide fee. Orders of $75 or more ship free.",
    },
    {
      name: "Choose EVC Plus, Edahab, or card",
      text: "Pick your payment method and you are redirected to a secure hosted checkout page — your payment details stay with the payment provider, not the shop.",
    },
    {
      name: "Approve the exact total",
      text: "The checkout shows the product price plus the delivery fee shown earlier — nothing else. Approve it and the transaction is recorded for both sides.",
    },
    {
      name: "Keep the receipt and track the order",
      text: "Your order number is the reference for everything after payment: follow the order under Orders, and write to support@hayaan.co with that number if anything does not match the page.",
    },
  ],
  faqs: [
    {
      q: "Is it safe to pay online in Somalia?",
      a: "Yes, when the checkout is a secure hosted page rather than a transfer to someone's personal wallet: you approve an exact total, the transaction is recorded for both sides, and you keep a receipt tied to your order number.",
    },
    {
      q: "Which payment methods can I use?",
      a: "EVC Plus, Edahab, and card — all processed through the secure hosted checkout in USD. No card is required; the two mobile-money options work from any phone.",
    },
    {
      q: "Do I pay extra fees or VAT when ordering online?",
      a: "No VAT is added. You pay the product price plus the delivery fee shown at checkout — $1.50–$3 by district in Mogadishu, free on orders of $75 or more, and a flat $6.95 nationwide.",
    },
    {
      q: "What happens after I approve the payment?",
      a: "The order is confirmed and appears under Orders with your order number; physical orders go out for district or nationwide delivery, and digital products unlock instantly as downloads.",
    },
    {
      q: "What if something goes wrong with my order?",
      a: "Write to support@hayaan.co — or the store's WhatsApp — with your order number. Because the payment went through a recorded checkout, both sides have the same transaction to work from.",
    },
  ],
  content: `Ask Somalis why they hesitate to shop online and the answer is almost always the same one: "How exactly does my money move?" The goods part of online shopping is easy — the photos, the prices, the delivery. The payment is where trust is won or lost. This guide walks through how paying online in Somalia works on a modern storefront, method by method, and what each step protects you from.

## The three ways to pay online in Somalia

Hayaan Market accepts the methods Somalis already use every day, all through one secure hosted checkout:

1. **EVC Plus** — the mobile-money wallet most of Mogadishu runs on. Approve the payment from your phone; no card needed.
2. **Edahab** — the second major mobile-money option, same flow: approve the exact total from your phone.
3. **Card** — Visa and Mastercard payments for those who prefer banking rails or are ordering from abroad.

All three settle in USD. There is no VAT added at checkout — you pay the product price plus the delivery fee that was shown before you confirmed.

## What "secure hosted checkout" actually means for you

A hosted checkout is a payment page run by the payment provider, not the shop. Two things follow from that, and both protect you.

First, **you approve an exact total before any money moves** — the product price plus the delivery fee, itemised. Nobody adds a "transport surcharge" after the fact, because the amount you approved is the amount that moves. Second, **the transaction is recorded for both sides**. If a question ever comes up about what was paid and when, the record exists — something that never happens when money goes to a personal wallet over WhatsApp.

> The safest payment is the one that leaves a receipt. Cash handed to a stranger, or a transfer to a personal number, gives you nothing to point at later.

## Paying online, step by step

1. **Fill the cart.** Every listing shows a fixed USD price, so the total is final before checkout even starts.
2. **Enter your delivery district.** Mogadishu districts are priced individually ($1.50–$3.00); other cities pay a flat $6.95; orders of $75 or more ship free nationwide.
3. **Choose EVC Plus, Edahab, or card.** You are redirected to the secure checkout page.
4. **Approve the exact total.** Products plus the shown delivery fee — nothing else.
5. **Keep the receipt and order number.** Track the order under Orders; support works from that number at support@hayaan.co.

Digital products add a wrinkle worth knowing: for downloads, no delivery fee applies at all, and the file unlocks in your Orders as soon as the payment is confirmed.

## Quick safety checklist for any online payment

- **Pay through the storefront's checkout**, never to a personal wallet number you were sent over chat.
- **Check the total before approving** — price plus the delivery fee you were shown, nothing else.
- **Expect a receipt or order number.** If a seller cannot produce either, that is your answer.
- **Keep the order number** until the goods are in your hands; it is the key support works from.

That is the whole system: fixed prices, a checkout that records what you approved, and an order number that unlocks support. Paying online in Somalia is not the risky part anymore — paying the *wrong way* is.

Ready to try it? Browse the [full shop](https://hayaan.co/), or start with the categories people order from most: [phones & wearables](https://hayaan.co/category/phones-wearables), [computers & TV](https://hayaan.co/category/computers-tv-gaming), and [power & charging](https://hayaan.co/category/power-charging-audio).`,
};

const post9 = {
  id: "seo-smartwatch-somalia",
  slug: "best-smartwatches-online-in-somalia",
  title: "Best Smartwatches to Buy Online in Somalia (2026): From $55 to $440",
  excerpt:
    "Apple Watch, Galaxy Watch, Huawei or Amazfit — every smartwatch price in Somalia right now, which watch pairs with your phone, and how to order one online safely.",
  quickAnswer:
    "Smartwatch prices in Somalia at Hayaan Market (hayaan.co) start at $55 for the Maxwell, with the Amazfit Active at $130, Samsung Galaxy Watch 7 at $190, Huawei Watch GT 6 at $230, and Apple Watch from $250 (SE) to $440 (Series 11). Fixed USD prices paid via EVC Plus, Edahab, or card, with free delivery on orders over $75.",
  faqs: [
    {
      q: "How much is an Apple Watch in Somalia?",
      a: "At Hayaan Market the Apple Watch SE 40mm is $250, Series 9 is $360, Series 10 is $390, and the current Series 11 46mm is $440 — fixed USD prices, no VAT.",
    },
    {
      q: "Which smartwatch works with an iPhone?",
      a: "The Apple Watch is the full-experience option on iPhone. Android users should pick the Samsung Galaxy Watch 7, Huawei Watch GT 6, or Amazfit Active instead — Apple Watch requires an iPhone.",
    },
    {
      q: "What is the best budget smartwatch in Somalia?",
      a: "The Maxwell smart watch at $55 covers the basics — notifications, step counting, a week of battery — and the Amazfit Active at $130 is the best-value fitness-focused pick with GPS.",
    },
    {
      q: "Do smartwatch prices include delivery?",
      a: "Orders of $75 or more ship free — Mogadishu and nationwide — which covers most watches here. Below that, Mogadishu districts pay $1.50–$3 and other cities a flat $6.95.",
    },
    {
      q: "Are the watches new, and what if mine has an issue?",
      a: "Every listing states its condition and live stock count, and your order number is the reference support works from — write to support@hayaan.co if anything does not match the page.",
    },
  ],
  content: `A smartwatch is the cheapest way to feel like you upgraded your phone — and the most common gift purchase on the shop right now. But the price spread is wide, from $55 to $440, and picking the wrong family of watch for your phone is the classic mistake. Here is the full smartwatch lineup you can order online in Somalia, and how to choose between them.

## Smartwatch prices in Somalia right now

Live on the [phones & wearables shelf](https://hayaan.co/category/phones-wearables), fixed USD prices:

1. **Maxwell smart watch — $55.** The entry point: notifications, step counting, sleep tracking, and battery that lasts a week. A great first smartwatch or gift.
2. **Amazfit Active 42mm — $130.** The best-value fitness pick: GPS, heart-rate tracking, workout coaching, and roughly two weeks of battery.
3. **Samsung Galaxy Watch 7 44mm — $190.** The Android-native pick, with Samsung Health, sleep scoring, and tight Galaxy phone integration.
4. **Huawei Watch GT 6 GPS 46mm — $230.** Big battery life, serious outdoor tracking, and a bright AMOLED display.
5. **Apple Watch SE 40mm — $250.** The gateway into the Apple ecosystem: the full watchOS experience at the friendliest Apple price.
6. **Apple Watch Series 9 — $360, Series 10 — $390, Series 11 — $440.** The latest Apple line: brighter always-on displays, faster chips, and the best health features on any watch.

## Rule one: match the watch to your phone

- **iPhone owners:** the Apple Watch is the only watch with the complete experience — message replies, Apple Pay-style unlocks, deep health integration. Start at the SE ($250) if the price matters; the [Series 11 at $440](https://hayaan.co/product/apple-watch-series-11-46mm) is the flagship.
- **Android owners:** pick the [Galaxy Watch 7 at $190](https://hayaan.co/product/samsung-galaxy-watch-7-44mm) (best with Samsung phones), the [Huawei GT 6 at $230](https://hayaan.co/product/huawei-watch-gt-6-gps-46-mm) for battery life, or the Amazfit Active at $130 for fitness-first use.

An Apple Watch paired with Android loses most of what you paid for — that is the single most common smartwatch mistake, and it is entirely avoidable.

## What your money buys at each tier

- **$55–$130 (Maxwell, Amazfit):** the essentials — notifications, steps, sleep, workouts. Battery measured in days-to-weeks, not hours.
- **$190–$250 (Galaxy Watch 7, Huawei GT 6, Apple Watch SE):** proper smartwatch platforms — app ecosystems, on-wrist calls, mobile wallets, richer health tracking.
- **$360–$440 (Apple Watch 9/10/11):** the top of the market — the brightest displays, the fastest chips, ECG-class health features, and the smoothest phone pairing that exists.

## Ordering a watch online in Somalia

Check the pairing rule above, open the listing to confirm the exact model and condition, and add it to cart. Orders of $75 or more ship free — every watch in this guide qualifies — so delivery costs you nothing in Mogadishu or anywhere else in Somalia. Pay with EVC Plus, Edahab, or card through the secure checkout, track the order under Orders, and write to support@hayaan.co with your order number for anything that does not match the page.

If you are kitting out a team — delivery riders, gym staff, a corporate gift batch — the [bulk quote form](https://hayaan.co/quote) usually beats listed prices, and the [deals page](https://hayaan.co/deals) is where watch restocks and price drops land first.`,
};

/** Published-at stamps — staggered weekly so the /blog index reads naturally.
 *  Cover images (Task 80): branded 16:9 JPGs shipped in /public/images/blog —
 *  absolute URLs so og:image / twitter:image / BlogPosting JSON-LD resolve
 *  without metadataBase rounding-trips. */
const publishedAt = (iso: string) => iso;

export const SEO_POSTS: BlogPost[] = [
  { ...post1, coverImage: "https://hayaan.co/images/blog/where-to-buy-electronics-online-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-08-24T09:00:00.000Z"), createdAt: "2026-08-24T09:00:00.000Z", updatedAt: "2026-08-24T09:00:00.000Z" },
  { ...post2, coverImage: "https://hayaan.co/images/blog/how-to-buy-phones-online-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-01T09:00:00.000Z"), createdAt: "2026-09-01T09:00:00.000Z", updatedAt: "2026-09-01T09:00:00.000Z" },
  { ...post3, coverImage: "https://hayaan.co/images/blog/buying-health-supplements-online-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-08T09:00:00.000Z"), createdAt: "2026-09-08T09:00:00.000Z", updatedAt: "2026-09-08T09:00:00.000Z" },
  { ...post4, coverImage: "https://hayaan.co/images/blog/setting-up-a-home-office-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-14T09:00:00.000Z"), createdAt: "2026-09-14T09:00:00.000Z", updatedAt: "2026-09-14T09:00:00.000Z" },
  { ...post5, coverImage: "https://hayaan.co/images/blog/online-shopping-in-somalia-how-it-works.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-19T09:00:00.000Z"), createdAt: "2026-09-19T09:00:00.000Z", updatedAt: "2026-09-19T09:00:00.000Z" },
  // Task 86 — October 2026 slate (prices verified against the live catalog on publish day).
  { ...post6, coverImage: "https://hayaan.co/images/blog/ps5-price-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-10-10T09:00:00.000Z"), createdAt: "2026-10-10T09:00:00.000Z", updatedAt: "2026-10-10T09:00:00.000Z" },
  { ...post7, coverImage: "https://hayaan.co/images/blog/iphone-price-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-10-10T09:30:00.000Z"), createdAt: "2026-10-10T09:30:00.000Z", updatedAt: "2026-10-10T09:30:00.000Z" },
  { ...post8, coverImage: "https://hayaan.co/images/blog/how-to-pay-online-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-10-10T10:00:00.000Z"), createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z" },
  { ...post9, coverImage: "https://hayaan.co/images/blog/best-smartwatches-online-in-somalia.jpg", authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-10-10T10:30:00.000Z"), createdAt: "2026-10-10T10:30:00.000Z", updatedAt: "2026-10-10T10:30:00.000Z" },
];



