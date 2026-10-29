import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  FileSearch,
  Layers,
  LineChart,
  Mail,
  Rocket,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
} from "lucide-react";
import { StoreShell } from "@/components/store/store-shell";
import { InvestorForm } from "@/components/store/investor-form";
import { SUPPORT_EMAIL } from "@/lib/support-email";

// Fully static by design (Task 128): investor traffic arrives as direct
// shares — the page must render even when the catalog/DB routes are having
// a bad moment. The only numbers quoted are stable catalog facts.
export const metadata: Metadata = {
  title: "Invest in Hayaan Market — Equity round",
  description:
    "Hayaan Market is opening a limited equity round to scale Somalia's fixed-price online marketplace — 100+ live listings, USD pricing, EVC Plus/Edahab payments, nationwide delivery. Express interest and receive the investor deck.",
  alternates: { canonical: "/investors" },
  openGraph: {
    title: "Invest in Hayaan Market — Equity round",
    description:
      "Back the marketplace making online shopping in Somalia as simple as it should be: fixed USD prices, mobile-money payments, delivery nationwide.",
    url: "/investors",
    type: "website",
  },
};

const FAQS = [
  {
    q: "How can I invest in Hayaan Market?",
    a: "Submit the expression-of-interest form below. The founding team replies within two business days with the investor deck and a time for an intro call. Investments close via a SAFE or a priced equity round, depending on the ticket size and the round stage at the time you come in.",
  },
  {
    q: "What is the minimum investment ticket?",
    a: "Tickets from $10,000 are welcome in the current round, and angels pooling through an SPV are fine too. Larger checks ($250k and above) get lead economics and a board-observer conversation.",
  },
  {
    q: "What will the funding be used for?",
    a: "Four things: a structured fulfillment and delivery network, a digital-goods line (instant delivery of vouchers and subscriptions), deeper payment and buyer-trust infrastructure, and expanding the catalog into more departments with the content engine that already ships SEO and AEO buyer guides.",
  },
  {
    q: "Is this page an offer of securities?",
    a: "No. Everything here is an invitation to express interest and start a conversation. Any actual investment would happen only after due diligence, and only through definitive agreements signed by both parties, in accordance with the laws of the relevant jurisdiction.",
  },
  {
    q: "Do I need to be based in Somalia to invest?",
    a: "No. The process is remote-first — deck, data room, and calls over email and video. Instruments are denominated in USD. A handful of investors choose to visit Mogadishu and walk the supplier pipeline, but that is optional.",
  },
  {
    q: "What does Hayaan Market actually do?",
    a: "Hayaan Market is an online marketplace for Somalia: a live catalog of 100+ listings across five departments — phones and wearables, computers and gaming, home and office, power and audio, health and supplements — every item at a fixed USD price, payable with EVC Plus, Edahab, or card, and delivered across the country. It also runs bulk quotes for businesses and publishes buyer guides in English and Somali.",
  },
];

const STATS = [
  { icon: Store, value: "100+", label: "live listings on the storefront" },
  { icon: Layers, value: "5", label: "departments, from phones to health" },
  { icon: Banknote, value: "USD", label: "fixed pricing — no haggling" },
  { icon: Truck, value: "Nationwide", label: "delivery across Somalia" },
];

const WHY = [
  {
    icon: LineChart,
    title: "A market nobody has structured yet",
    body: "Somalis buy electronics on Facebook posts and trust-of-the-day. The demand is real and the money rails exist — what's missing is a marketplace with exact prices, real stock, and delivery you can plan around. That is the gap Hayaan occupies.",
  },
  {
    icon: Smartphone,
    title: "Built on the rails people already use",
    body: "Every listing is priced in USD and payable with EVC Plus, Edahab, or card — no new behavior to teach. The buyer already knows how to pay; Hayaan just makes the catalog and the delivery trustworthy.",
  },
  {
    icon: FileSearch,
    title: "Demand is compounding through content",
    body: "The blog already ranks for buyer searches like laptop, Galaxy foldable, and appliance prices in Somalia, with structured data built for both Google and AI answer engines. Content is a customer-acquisition channel the competitors simply don't operate.",
  },
  {
    icon: ShieldCheck,
    title: "Asset-light by design",
    body: "The marketplace model keeps inventory exposure low while the supplier pipeline deepens — margin comes from the platform relationship, not from warehousing every SKU. Growth capital goes into fulfillment and trust, not dead stock.",
  },
];

const USE_OF_FUNDS = [
  {
    icon: Truck,
    title: "Fulfillment & delivery network",
    body: "Structured last-mile partnerships and SLAs, so 'delivered across Somalia' becomes a promise with a date attached.",
  },
  {
    icon: Rocket,
    title: "Digital goods, delivered instantly",
    body: "Vouchers, subscriptions, and top-ups delivered the moment payment lands — the highest-frequency habit a marketplace can own.",
  },
  {
    icon: ShieldCheck,
    title: "Payments & buyer trust",
    body: "Escrow-style protections, reviews, and dispute resolution that make a first purchase easy and a second one automatic.",
  },
  {
    icon: Layers,
    title: "Catalog & content expansion",
    body: "More departments, more listings, and the bilingual content engine that turns searches into customers.",
  },
];

const STEPS = [
  {
    title: "Express interest",
    body: "Two minutes on the form below. Tell us who you are and the size you're thinking about.",
  },
  {
    title: "Deck & intro call",
    body: "Within two business days you get the deck, the numbers behind it, and a video call with the founding team.",
  },
  {
    title: "Diligence & term sheet",
    body: "Serious parties get the data room — catalog economics, supplier pipeline, unit tests — and we agree terms together.",
  },
  {
    title: "Close",
    body: "SAFE or priced equity, USD-denominated, signed and funded. You're now part of the company building how Somalia shops.",
  },
];

export default function InvestorsPage() {
  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Hero */}
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#3f7d4a]">
            Investor relations
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-dark sm:text-4xl">
            Invest in Hayaan Market
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            We are opening a limited equity round to scale Somalia&apos;s fixed-price online
            marketplace — the storefront, the delivery, and the trust layer behind it. Tell us who
            you are, and we&apos;ll send the deck, the numbers, and a time to talk.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#invest-form"
              className="inline-flex h-11 items-center rounded-full bg-[#14532d] px-6 text-sm font-black text-[#faf8f1] transition hover:opacity-90"
            >
              Request the investor deck
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#e6e2d4] bg-white px-5 text-sm font-semibold text-brand-dark transition hover:border-brand/50"
            >
              <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
            </a>
          </div>
        </header>

        {/* Stats band */}
        <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-1 rounded-2xl border border-[#e6e2d4] bg-white p-5 text-center shadow-sm"
            >
              <Icon className="h-5 w-5 text-[#f28c28]" aria-hidden />
              <p className="text-2xl font-black tracking-tight text-brand-dark">{value}</p>
              <p className="text-xs leading-snug text-muted-foreground">{label}</p>
            </li>
          ))}
        </ul>

        {/* Why Hayaan */}
        <section className="mt-14">
          <h2 className="text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">
            Why Hayaan, why now
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {WHY.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-[#e6e2d4] bg-white p-6 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14532d]/10">
                  <Icon className="h-5 w-5 text-[#14532d]" aria-hidden />
                </span>
                <h3 className="mt-3 text-base font-bold text-brand-dark">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Use of funds */}
        <section className="mt-14">
          <h2 className="text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">
            What the round funds
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Capital goes to the four things that compound: getting orders to doors faster, adding
            the highest-frequency products, hardening trust, and feeding the demand engine.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {USE_OF_FUNDS.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="flex gap-4 rounded-2xl border border-[#e6e2d4] bg-white p-6 shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fef1de]">
                  <Icon className="h-5 w-5 text-[#f28c28]" aria-hidden />
                </span>
                <div>
                  <h3 className="text-base font-bold text-brand-dark">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Process */}
        <section className="mt-14">
          <h2 className="text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">
            How investing works
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="rounded-2xl border border-[#e6e2d4] bg-white p-5 shadow-sm"
              >
                <p className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14532d] text-sm font-black text-[#faf8f1]">
                  {i + 1}
                </p>
                <h3 className="mt-3 text-sm font-bold text-brand-dark">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">
            Investor FAQ
          </h2>
          <div className="mt-6 flex flex-col gap-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-[#e6e2d4] bg-white p-5 shadow-sm [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold text-brand-dark">
                  {f.q}
                  <span className="shrink-0 text-lg leading-none text-[#f28c28] transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* EOI form */}
        <section id="invest-form" className="mt-14 scroll-mt-24">
          <h2 className="text-center text-2xl font-black tracking-tight text-brand-dark sm:text-3xl">
            Express interest
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
            No commitment — just a conversation. The founding team reads every submission.
          </p>
          <div className="mt-6">
            <InvestorForm />
          </div>
        </section>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          The information on this page is for discussion purposes only and does not constitute an
          offer to sell, or a solicitation of an offer to buy, any security in any jurisdiction.
          Figures describe the storefront as of October 2026. Any investment will be subject to due
          diligence and definitive agreements.
        </p>
      </div>
    </StoreShell>
  );
}
