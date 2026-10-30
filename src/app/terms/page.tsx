import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StoreShell } from "@/components/store/store-shell";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";

// Task 136 / audit F4. The terms below describe how the store actually
// behaves: USD pricing, Sifalo Pay as the payment rail, district-based
// delivery fees (see /shipping), instant digital delivery, and support by
// WhatsApp/email. No invented policy windows — every promise here maps to
// something the store really does.

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "How orders, prices, delivery, and payments work at Hayaan Market — plain-language terms for shopping with us.",
  alternates: { canonical: "/terms" },
};

type Section = { h: string; p: string[] };

const EN: { title: string; intro: string; sections: Section[] } = {
  title: "Terms of service",
  intro:
    "These terms cover shopping at hayaan.co. They are written in plain language on purpose — if anything is unclear, ask us before you order and we will happily explain.",
  sections: [
    {
      h: "Orders and prices",
      p: [
        "Prices are shown in US dollars (USD). The total you see at checkout is exactly what you are asked to pay: item subtotal plus the delivery fee for your area. There is no extra tax or hidden charge.",
        "An order is confirmed when your payment completes through Sifalo Pay. If a price was obviously wrong (a typo, for example), we will contact you before charging or dispatching, and you can choose to continue or cancel.",
        "Stock is live: if an item sells out between your payment and dispatch, we contact you straight away to agree a replacement or a full refund.",
      ],
    },
    {
      h: "Delivery",
      p: [
        "We deliver across Mogadishu district by district — each district has its own delivery fee, shown at checkout and listed on the shipping info page. Outside Mogadishu, a flat delivery fee applies.",
        "Digital products (when offered) are delivered online: after payment is confirmed, the download unlocks in your orders — no delivery fee and no address needed.",
        "Every order carries the name, address, and phone number you enter. For guest orders, keep your order reference — it is how we find your purchase if you contact us.",
      ],
    },
    {
      h: "Payments",
      p: [
        "All payments go through Sifalo Pay's secure hosted checkout, which supports the mobile wallets and cards Somali customers actually use. We never see or store your card or wallet credentials.",
        "If a payment fails or is left pending, the order is not treated as paid; you can retry from checkout, and pending payments can be checked on the payment return page.",
      ],
    },
    {
      h: "If something is wrong",
      p: [
        "If your order arrives damaged, incorrect, or incomplete, contact us as soon as possible through WhatsApp or the email below — include your order reference and photos if you can.",
        "We look at every case individually and, where an item is confirmed faulty or wrong, we arrange a replacement or a refund with you directly.",
      ],
    },
    {
      h: "The rest",
      p: [
        "These terms, and the contract for each order, sit under the law applicable in Somalia.",
        "We may update this page as the store grows — the version live here is the one that applies to your order.",
      ],
    },
  ],
};

const SO: typeof EN = {
  title: "Shuruudaha adeegga",
  intro:
    "Shuruudahani waxay khuseeyaan iibsiga hayaan.co. Luuqad fudud ayay ku qoran yihiin — haddii ay waxaan cadlaan, waydii ka hor intaadan dalban, si farxad ayaanu u sharixaynaa.",
  sections: [
    {
      h: "Dalabka iyo qiimaha",
      p: [
        "Qiimaha waa dollar maraykan (USD). Wadarta aad arkayso xilliga bixinta waa waxa aad la weydiisatay oo keliya: wadarta alaabta iyo kharashka gaadhitaanka aagaaga. Canshuur dheeraad ah ama kharash qarsoon ma jiro.",
        "Dalabku wuu xaqiijaa marka bixintaadu ka dhammaato Sifalo Pay. Haddii qiimo ay si cad u khaldan tahay (tusaale: qalad qorista), waanu kula soo xiriiri doonaa ka hor bixinta ama dirista — adigu waxaad dooran kartaa inaad sii wato ama aad joojiso.",
        "Stock-ku waa mid nool: haddii alaab ay iibanto u dhexeysa bixintaada iyo dirista, waanu kula soo xiriiri doonnaa si degdeg ah beddel ama lacag celin buuxda.",
      ],
    },
    {
      h: "Gaadhitaanka",
      p: [
        "Waxaanu gaadhinnaa Muqdisho degmo kasta — degmaddu waxay leedahay kharashkeeda gaadhitaanka, laga arko xilliga bixinta oo lagu qoran yahay bogga xogta gaadhitaanka. Muqdisho ka bannaan, kharash fidsan ayaa lagu qaadaa.",
        "Alaabta dhijitaalka ah (marka la bixiyo) waxaa lagu gaadhsiiyaa online: bixinta xaqiijantay kaddib, download-ku wuu furmayaa dalabyadaada — kharash gaadhitaan ah iyo cinwaan uma baahnid.",
        "Dalab kasta wuxuu wataa magaca, cinwaanka, iyo lambarka aad geliso. Dalabyada martida, tixraaca dalabkaaga hay — waa sida aanu kugu helno iibsigaada haddii aad nala soo xiriirto.",
      ],
    },
    {
      h: "Bixinada",
      p: [
        "Dhammaan bixinada waxay ka socdaan boggii amni ee Sifalo Pay, oo taagera lacagaha telefoonka iyo kaadhiyada macaamiisha Soomaaliyeed ee dhabta aad isticmaasho. Karaadhiyadaada ama macluumaadkaaga lacagta ma aragno oo ma kaydinno.",
        "Haddii bixintu ku guuldareysato ama ay weli sugayso, dalabku lama tirtiro bixi la'aan; waxaad ku noqo kartaa xilliga bixinta, bixinada weli sugayanna waa la hubin karaa bogga soo noqoshada.",
      ],
    },
    {
      h: "Haddii wax khaldan yihiin",
      p: [
        "Haddii dalabkaagu gaadho waxyar, khaldan, ama mid buuxa ahayn, nala soo xiriir sida ugu dhaqsiyaha badan WhatsApp ama emailka hoose — tixraaca dalabkaaga iyo sawirro haddii aad haysato.",
        "Dhibaato kasta si gaar ah ayaanu u eegnaa; haddii alaabta ay dhab ahaan cillad tahay ama khaldan tahay, beddel ama lacag celin ayaynu kula heshiisi doonaa.",
      ],
    },
    {
      h: "Wixii kaloo hadhay",
      p: [
        "Shuruudahani, iyo heshiiska dalab kasta, waxay hoos yimaadaan sharciga Soomaaliya.",
        "Boggaan waxaanu cusboonaysiin karnaa marka suuqu kororsado — nooca halkan ku qoran wuxuu khuseeyaa dalabkaaga.",
      ],
    },
  ],
};

export default async function TermsPage() {
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const c = lang === "so" ? SO : EN;

  return (
    <StoreShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-legal-page="terms">
        <h1 className="font-panton text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">{c.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{c.intro}</p>
        <div className="mt-8 flex flex-col gap-8">
          {c.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-brand-dark">{s.h}</h2>
              <div className="mt-2 flex flex-col gap-2">
                {s.p.map((para, j) => (
                  <p key={j} className="text-sm leading-relaxed text-foreground/80">{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-10 rounded-xl border border-[#e6e2d4] bg-[#faf8f1] px-4 py-3 text-sm text-muted-foreground">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-dark underline-offset-2 hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </article>
    </StoreShell>
  );
}
