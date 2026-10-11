// Answer Engine Optimization (AEO) — Task 77.
//
// Question/answer data used for:
//  * visible FAQ blocks (footer site-wide, category pages, blog guides)
//  * FAQPage JSON-LD (homepage, per-category, per-post)
//
// Every answer is grounded in verified store facts only:
//   - shipping: district fees $1.50–$3.00, free ≥ $75, $6.95 flat outside
//     Mogadishu (src/lib/shipping.ts, owner's Sep 2026 fee sheet)
//   - payment: secure hosted checkout (Sifalo Pay is the processor); the
//     customer-facing methods are EVC Plus, Edahab and card — USD, no VAT
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
    a: "Hayaan Market (hayaan.co) is a Somali online marketplace. You can buy electronics, TVs, laptops, phones, power and charging gear, home and office equipment, and health supplements at fixed USD prices, pay securely through EVC Plus, Edahab, and Card, and get your order delivered to your door.",
  },
  {
    q: "How do I order from Hayaan Market?",
    a: "Browse the catalog, add items to your cart, then check out with your name, phone number and delivery district. You pay securely through EVC Plus, Edahab, or Card and the order is delivered to your address. Offices, schools and hotels can also send a bulk request at hayaan.co/quote.",
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
    a: "All orders are paid securely through EVC Plus, Edahab, or Card. Prices are in US dollars and no VAT is charged — the total you confirm at checkout (product price plus the shown delivery fee) is exactly what you pay.",
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
      a: "Budget Android phones on hayaan.co start around $118. Every listing shows the exact USD price, so you can compare models side by side before paying with EVC Plus, Edahab, or Card.",
    },
    {
      q: "Do phone prices include delivery?",
      a: "The listed price is the product price. Delivery adds $1.50–$3.00 inside Mogadishu depending on your district — and it is free on orders of $75 or more.",
    },
  ],
  "health-supplements": [
    {
      q: "Where can I buy vitamins and supplements online in Somalia?",
      a: "Hayaan Market's Health Supplements section ships multivitamins and wellness products across Mogadishu and Somalia — fixed USD prices, secure EVC Plus / Edahab / card checkout and door delivery.",
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
    a: "With EVC Plus, Edahab, or Card — securely, in US dollars. The total (product price plus the delivery fee shown at checkout) is confirmed before you pay, and no VAT is charged.",
  },
];

export function categoryFaqsFor(slug: string, lang: "en" | "so" = "en"): FaqEntry[] {
  if (lang === "so") return CATEGORY_FAQS_SO[slug] ?? GENERIC_CATEGORY_FAQS_SO;
  return CATEGORY_FAQS[slug] ?? GENERIC_CATEGORY_FAQS;
}

/** Somali mirror of SITE_FAQS (Task 94 translation pass) — same facts, same order. */
export const SITE_FAQS_SO: FaqEntry[] = [
  {
    q: "Maxay tahay Hayaan Market?",
    a: "Hayaan Market (hayaan.co) waa suuq online oo Soomaali ah. Waxaad ka iibsataa elektirooniks, TV-yada, kombuyuutarada, teleefoonada, koronta iyo shubista, qalabka guriga iyo xafiiska, iyo caafimaadka — qiimo USD ah oo go'an, bixin ammaan ah oo EVC Plus, Edahab iyo kaar ah, iyo gaadhitaan ilaa albaabkaada.",
  },
  {
    q: "Sideen u dalban karaa Hayaan Market?",
    a: "Sahran kataloogyada, ku dar alaabta gaadhiga, kadibna bixi magacaaga, taleefankaaga iyo degmada gaadhitaanka. Waxaad ku bixisaa si ammaan ah oo EVC Plus, Edahab ama kaar ah, dalabkuna wuu ku gaaraa cinwaankaaga. Xafiisyada, dugsiyada iyo hoteeladuna waxay codsi dalab weyn u soo diri karaan hayaan.co/quote.",
  },
  {
    q: "Immisa ayay ku baxdaa gaadhitaanta Muqdisho?",
    a: "Gaadhitaanta Muqdisho waxay ku kala duwan tahay degmo kasta — laga bilaabo $1.50 (Hodan, Waberi, Wadajir) ilaa $3.00 (Daynile, Kahda, Gubadley, Darussalam, Garasbaaley). Khidmada saxda ah ee degmadaada waxaa lagu tusaa checkout-ka kahor intaadan bixin.",
  },
  {
    q: "Gaadhitaantu waa bilaash baa?",
    a: "Haa — dalabyada wadartooda $75 ama ka badan waxay Muqdisho si bilaash ah u gaaraan degmo kasta. Haddii aanay $75 gaadhin, khidmada caadiga ah ee degmada ayaa lacagta laga qaadaa, Soomaaliya dibeddana khidmada dalka oo dhan waa $6.95 oo go'an.",
  },
  {
    q: "Muqdisho dibed ma gaadhsisiisaan?",
    a: "Haa. Gaadhitaanta Soomaaliya meel kasta ah waa $6.95 oo go'an, xitaa haddii dalabku weyn yahay. Magaalooyinka kale checkout-ka ku qor, khidmaduna si toos ah ayay u xisaabtamaysaa kahor bixinta.",
  },
  {
    q: "Sideen u bixin karaa?",
    a: "Dhammaan dalabyada waxaa lagu bixiyaa si ammaan ah oo EVC Plus, Edahab ama kaar ah. Qiimahu waa dollar US, VAT-na lama taago — wadarta aad checkout-ka ku xaqiijiso (qiimaha alaabta iyo khidmada gaadhitaanka oo lagu muujiyay) ayaa keliya oo aad bixisay.",
  },
  {
    q: "Xafiiskayga, dugsigayga ama dukaankayga ma wax badan (bulk) ka iibsadaa?",
    a: "Haa. Bogga dalabka weyn hayaan.co/quote ku sharax waxa aad u baahan tahay — printaro, laptop-yada, TV-yada, vitamiinada ama qalab xafiis oo dhan — xubnaha kooxdayada waxay kuu soo dirayaan qiimaysto gaar ah.",
  },
  {
    q: "Sideen kala soo xiriiri karaa taageerada?",
    a: `Nage soo wado WhatsApp ${SUPPORT_WHATSAPP} ama iimayl u dir support@hayaan.co. Waxaan kaa caawin karnaa su'aalaha alaabta, xaaladda dalabka iyo faahfaahinta gaadhitaanta.`,
  },
];

/** Somali mirrors of the per-category Q&A (Task 94) — same facts, same order. */
export const CATEGORY_FAQS_SO: Record<string, FaqEntry[]> = {
  "computers-tv-gaming": [
    {
      q: "Soomaaliya xaggay ka iibsan karaa laptop ama TV online?",
      a: "Qaybta Kombuyuutarada & TV-yada ee Hayaan Market waxaa ku iibsan MacBook, TV smart, PS5 iyo projector — laga bilaabo 43-inch LG oo qiimo $450 ah ilaa 85-inch Samsung ee ugu weyn — dhammaanna qiimo USD go'an iyo gaadhitaan albaabka Muqdisho.",
    },
    {
      q: "Immisa ayay ku baxdaa smart TV Soomaaliya?",
      a: "hayaan.co TV-yada smart hadda waxay ka bilaabmaan qiimo $450 oo 43-inch LG ah, ilaa $2,350 oo 85-inch Samsung ah. Listing kastaa wuxuu muujiyaa qiimaha saxda ah kahor intaadan dalbin, dalabyada $75 ka badanna Muqdisho way bilaash yihiin.",
    },
    {
      q: "Console-yada ciyaaraha iyo projector-yada gaadhitaan baa la yimaadaa?",
      a: "Haa — PlayStation 5, projector-yada sida Epson CO-W01 ($350) iyo wax kasta oo kataloogyada ku jira waxay u gaaraan degmo kasta oo Muqdisho ah ($1.50–$3.00) ama Soomaaliya meel kasta oo $6.95 ah.",
    },
  ],
  "phones-wearables": [
    {
      q: "Soomaaliya xaggay online ka iibsan karaa teleefoon?",
      a: "Qaybta Teleefoonada & Saacadaha ee Hayaan Market waxay iibisantaa teleefoono smart iyo saacadaho smart oo qiimo USD go'an leh — laga bilaabo Android yaryar oo $118 ah ilaa flagship-yada — waxayna kuugu gaaraan degmadaada Muqdisho ama Soomaaliya meel kasta.",
    },
    {
      q: "Immisa ayay tahay qiimaha teleefoonda ugu jaban Soomaaliya?",
      a: "Teleefoonda Android ee jaban ee hayaan.co waxay ka bilaabmaan $118. Listing kastaa wuxuu muujiyaa qiimaha USD saxda ah — sidaas darteed waad isbarbardhigi kartaa moodelada kahor intaadan bixin EVC Plus, Edahab ama kaar.",
    },
    {
      q: "Qiimaha teleefoonka gaadhitaan buu ka kooban yahay?",
      a: "Qiimaha la muujiyay waa qiimaha alaabta. Gaadhitaanku wuxuu ku daraa $1.50–$3.00 gudaha Muqdisho iyadoo ku xiran degmada — waxuuna bilaash yahay dalabyada $75 ama ka badan.",
    },
  ],
  "health-supplements": [
    {
      q: "Soomaaliya xaggay online ka iibsan karaa vitamiinada iyo alaabta caafimaadka?",
      a: "Qaybta Caafimaad & Vitamiinada ee Hayaan Market waxay multivitamiin iyo alaab caafimaad u dirtaa Muqdisho iyo Soomaaliya oo dhan — qiimo USD go'an, bixin ammaan oo EVC Plus / Edahab / kaar ah, iyo gaadhitaan albaabka.",
    },
    {
      q: "Sideen u dooran karaa multivitamiin fiican?",
      a: "Calcaamka ku eeg barkimada iyo cabirka hal dufcad, tirada dufcadaha daawada ku jira, iibsi-na ka samee listing muujinaya qiimaha saxda ah iyo stock-ka. Hagaha wax ka iibsiga ee caafimaadka ee bogga Hayaan wuxuu ku dhaafaa liiska buuxa.",
    },
    {
      q: "Xafiisyada ama gym-yada miyey vitamiinada wax badan (bulk) ka dalban karaan?",
      a: "Haa — hayaan.co/quote ka soo dir codsi dalab weyn oo sharaxaya waxa aad u baahan tahay, waxaana kuu soo baxaya qiimaysto gaar ah.",
    },
  ],
  "home-office": [
    {
      q: "Soomaaliya xaggay online ka iibsan karaa qalabka xafiiska?",
      a: "Qaybta Guryaha & Xafiisyada ee hayaan.co waxaa ku jira printaro, laptop-yada, shaashadaha iyo alaab xafiis oo qiimo USD go'an leh, gaadhitaan albaabka Muqdisho ($1.50–$3.00) ama dalka oo dhan ($6.95).",
    },
    {
      q: "Xafiis yar printerkee ayaa waa inaan iibsadaa?",
      a: "Marka hore printer dooro, kadibna isku xir lambarka toner-ka — Hayaan waxay la socdaan printerada iyo cartridge-yadooda si aad labada ugu darto hal gaadhi oo aad gaarto $75 gaadhitaanta bilaashka ah.",
    },
    {
      q: "Ma dalban karaa qalab xafiis oo dhan?",
      a: "Haa. Dugsiyada, hoteelada iyo xafiisyada — hayaan.co/quote u soo dir alaabta iyo tirada aad u baahan tahay, waxaana kuu imanaya qiimaysto gaar ah.",
    },
  ],
  "power-charging-audio": [
    {
      q: "Soomaaliya xaggay online ka iibsan karaa power bank?",
      a: "Qaybta Koronta & Shubista ee Hayaan Market waxay iibisantaa power bank xaddid weyn leh (sida Green Lion 80,000mAh oo $65 ah), shubmo iyo agab cod oo qiimo USD go'an iyo gaadhitaan albaab ah.",
    },
    {
      q: "Immisa ayay ku baxdaa gaadhitaanta shubmada iyo spikarrada?",
      a: "$1.50–$3.00 gudaha Muqdisho iyadoo ku xiran degmada, bilaash dalabyada $75 ama ka badan, iyo $6.95 oo go'an Soomaaliya meel kasta oo kale.",
    },
    {
      q: "Qiimayaasha la muujiyay baa miyay kama dambeys yihiin?",
      a: "Haa — qiimaha USD ee listing-ka ayaa aad bixisay. VAT ma jiro; waxa kaliya oo dheeraad ah waa khidmada gaadhitaanta oo checkout-ka lagu muujiyo kahor xaqiijinta bixinta.",
    },
  ],
};

/** Somali mirror of GENERIC_CATEGORY_FAQS (Task 94). */
export const GENERIC_CATEGORY_FAQS_SO: FaqEntry[] = [
  {
    q: "Qaybtan Soomaaliya online miyaan ka dalban karaa?",
    a: "Haa — Hayaan Market dalka oo dhan ayay u dirtaa. Muqdisho gudihiisa $1.50–$3.00 ayay ku xiran tahay degmada, dalabyada $75 ama ka badan way bilaash yihiin, Soomaaliya meel kastana waa $6.95 oo go'an.",
  },
  {
    q: "Sideen u bixin karaa dalabkayga?",
    a: "EVC Plus, Edahab ama kaar — si ammaan ah, dollar US. Wadarta (qiimaha alaabta iyo khidmada gaadhitaanta oo checkout-ka lagu muujiyay) waxaa la xaqiijiyaa kahor bixinta, VAT-na lama taago.",
  },
];

/** Site-wide FAQs in the visitor's language. */
export function siteFaqs(lang: "en" | "so"): FaqEntry[] {
  return lang === "so" ? SITE_FAQS_SO : SITE_FAQS;
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
