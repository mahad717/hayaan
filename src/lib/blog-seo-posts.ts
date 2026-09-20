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
- **Use a payment method with a receipt.** Sifalo Pay gives both sides a record of the transaction — avoid informal transfers for large orders.
- **Check delivery terms before checkout.** In Mogadishu, delivery is priced by district; elsewhere in Somalia it's a flat fee, and orders over $75 ship free.
- **Keep your order number.** It's your reference for support, warranty questions, and follow-up purchases.

> Rule of the market: the seller who answers "what exact model is it?" in one sentence is usually the one you can trust with your money.

## Why buy from a marketplace instead of a social-media seller

Buying from a WhatsApp contact means trusting a photo. Buying from a storefront means the listing, the price, the stock count, and the checkout are all written down — and the seller has a reputation to protect. Hayaan Market keeps every product page consistent: exact name, real photos, price in dollars, stock status, and a support email you can actually reach.

It also means your money moves through [Sifalo Pay](https://sifalo.com), Somalia's payment network — not through a personal wallet that can vanish.

## Ready to browse?

Start with the categories people buy most: [computers, TV & gaming](https://hayaan.co/category/computers-tv-gaming), [phones & wearables](https://hayaan.co/category/phones-wearables), and [power & audio](https://hayaan.co/category/power-charging-audio). Bookmark the [deals page](https://hayaan.co/deals) — price drops and restocks get announced there first — and if you're buying for an office, school, or hotel, the [bulk quote form](https://hayaan.co/quote) usually beats listed prices.`,
};

const post2 = {
  id: "seo-buy-phones-online-somalia",
  slug: "how-to-buy-phones-online-in-somalia",
  title: "How to Buy Phones Online in Somalia (and What to Check Before You Pay)",
  excerpt:
    "iPhone or Galaxy, physical SIM or eSIM, $118 or $1,550 — a plain-language guide to ordering a phone online in Somalia with confidence.",
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
4. Pay with **Sifalo Pay** and keep the confirmation — it is your receipt.
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
  content: `Health supplements are one of the fastest-growing searches in Somali online shopping — and also the category where quality questions matter most. When you cannot hold the bottle before paying, the listing itself has to do the convincing. Here is how to read one like a pro.

## What a trustworthy supplement listing shows

A good listing answers three questions on one page: **what exactly is in it**, **who it is for**, and **what condition it arrives in**. Take the [Men's Multivitamins listing](https://hayaan.co/product/multivitamines-pour-hommes--boost-immunitaire-aux-vitamines-a-b12-c-d--nergie-quotidienne-et-non-ogm) on Hayaan Market at $6.50: the name alone states the actives — vitamins A, B12, C and D — plus the positioning (daily energy and immune support) and the formulation claim (non-GMO). That is the level of specificity you want before any supplement purchase.

Listings that hide behind phrases like "immunity booster" without naming actives, doses, or counts deserve your skepticism — online or in a pharmacy.

## The four checks that matter most

1. **Named actives and amounts.** Vitamin D3 and vitamin B12 on the label beats a "proprietary blend" every time.
2. **Sealed condition on arrival.** Note the seal when the bottle reaches you, and report anything off the same day.
3. **Realistic prices.** A daily multivitamin in the $5–$10 range is normal. Supplements priced like prescription medicine need prescription-level evidence.
4. **A seller with a record.** Order history, a support email, and a payment receipt via [Sifalo Pay](https://sifalo.com) mean accountability if anything goes wrong.

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

Work from home in Somalia used to mean making do. Now it means a single afternoon of browsing, a secure [Sifalo Pay](https://sifalo.com) payment, and a box at your door — the same week you decided to get serious.`,
};

const post5 = {
  id: "seo-online-shopping-somalia-guide",
  slug: "online-shopping-in-somalia-how-it-works",
  title: "Online Shopping in Somalia: How Delivery, Payment and Support Actually Work",
  excerpt:
    "The no-surprises guide to ordering from Hayaan Market — district delivery fees, Sifalo Pay, free shipping over $75, and what happens after you click Pay.",
  content: `Most questions Somalis ask about online shopping are really the same four: **Can I trust the payment? Where does it deliver? What does it cost? And who do I call when something is wrong?** Here are straight answers for Hayaan Market — the same rules that run at checkout, written down.

## Paying: Sifalo Pay, not a stranger's wallet

Every order goes through [Sifalo Pay](https://sifalo.com), Somalia's payment network. You confirm the order in the checkout, approve the charge, and both you and the store keep a receipt of the same transaction. Nothing moves through personal wallets or informal transfers — which is exactly what you want when the parcel is a $1,290 TV or a $6 bottle of vitamins.

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
3. **Checkout**: pick your district, see the delivery fee, approve the total with Sifalo Pay.
4. **Track** under Orders until the parcel is in your hands.
5. **Write to support** for anything that does not match the page.

That is the entire system. No hidden steps, no calls to strangers, no cash "on trust" — just a market that behaves the same way every time you visit it.`,
};

/** Published-at stamps — staggered weekly so the /blog index reads naturally. */
const publishedAt = (iso: string) => iso;

export const SEO_POSTS: BlogPost[] = [
  { ...post1, coverImage: null, authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-08-24T09:00:00.000Z"), createdAt: "2026-08-24T09:00:00.000Z", updatedAt: "2026-08-24T09:00:00.000Z" },
  { ...post2, coverImage: null, authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-01T09:00:00.000Z"), createdAt: "2026-09-01T09:00:00.000Z", updatedAt: "2026-09-01T09:00:00.000Z" },
  { ...post3, coverImage: null, authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-08T09:00:00.000Z"), createdAt: "2026-09-08T09:00:00.000Z", updatedAt: "2026-09-08T09:00:00.000Z" },
  { ...post4, coverImage: null, authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-14T09:00:00.000Z"), createdAt: "2026-09-14T09:00:00.000Z", updatedAt: "2026-09-14T09:00:00.000Z" },
  { ...post5, coverImage: null, authorName: "Hayaan Team", status: "published", publishedAt: publishedAt("2026-09-19T09:00:00.000Z"), createdAt: "2026-09-19T09:00:00.000Z", updatedAt: "2026-09-19T09:00:00.000Z" },
];



