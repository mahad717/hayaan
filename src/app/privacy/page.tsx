import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StoreShell } from "@/components/store/store-shell";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";

// Task 136 / audit F4: real trust pages replace the footer's dead links.
// The copy below only describes what the store actually does (session and
// language cookies, order/account storage in Supabase, Sifalo Pay handling
// payments, Google Analytics 4) — nothing aspirational.

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Hayaan Market collects when you shop, how your details are used to deliver orders, and how to reach us about your data.",
  alternates: { canonical: "/privacy" },
};

type Section = { h: string; p: string[] };

const EN: { title: string; intro: string; sections: Section[] } = {
  title: "Privacy policy",
  intro:
    "Hayaan Market is an online store for electronics and home goods, serving customers across Somalia. This page explains, in plain language, what we collect and why. Questions? Email or WhatsApp us any time.",
  sections: [
    {
      h: "What we collect",
      p: [
        "Account details you give us: your name, email address, and (optionally) a phone number and saved delivery address, when you create an account.",
        "Order details: the items you buy, the delivery name, address, and phone number you enter at checkout. This applies whether you check out with an account or as a guest — guest orders keep the same delivery details but are not linked to an account profile.",
        "Basic usage data: we use Google Analytics 4 to understand which pages and products are useful. It sees pages and events, not your name or address.",
      ],
    },
    {
      h: "How your details are used",
      p: [
        "To fulfil and deliver your order — the delivery contact and address you provide are what our team and couriers work from.",
        "To reach you about your order: confirmation, delivery coordination, and any problems with stock or payment. For guest orders, the phone number you provide is the contact channel.",
        "Payments are processed by Sifalo Pay (mobile money and cards). Your card or wallet credentials are handled on Sifalo Pay's own secure checkout — Hayaan's servers store the payment status and a transaction reference, never your card details.",
        "Support: when you contact us by email or WhatsApp, we use the details you share to help you.",
      ],
    },
    {
      h: "What we don't do",
      p: [
        "We don't sell or rent your personal details, and we don't run advertising networks that follow you around the web.",
        "We don't send marketing email unless you subscribed through the newsletter box — and every list we keep exists to tell you about real products and offers.",
      ],
    },
    {
      h: "Where data lives and who can see it",
      p: [
        "Store data (accounts, orders, products) is hosted on Supabase, a managed cloud database service. Access is limited to the Hayaan team, and account passwords are stored only as secure hashes.",
        "Order records are kept because a shop needs its books — deliveries, payments, and refunds all have to line up.",
      ],
    },
    {
      h: "Your choices and how to reach us",
      p: [
        "You can review and update your saved details any time in the account area after signing in.",
        "Want your details removed or corrected? Email us and we will sort it out. We may keep the order records that accounting rules require.",
        "Contact: email below, or the WhatsApp link in the footer.",
      ],
    },
  ],
};

const SO: typeof EN = {
  title: "Siyaasada sirdarta",
  intro:
    "Hayaan Market waa suuq online ah oo alaab elektronik iyo guryo ah, oo u adeega dadka Soomaaliya. Boggu wuxuu sharxayaa luuqad fudud waxa aanu qaadano iyo sababta. Su'aal? Nagu soo dir email ama WhatsApp waqti kasta.",
  sections: [
    {
      h: "Waxa aanu qaadano",
      p: [
        "Xogta akoonka aad na siiso: magacaaga, emailkaaga, iyo (ikhtiyaari) telefoon iyo cinwaan gaadhitaan kaydsan, marka aad akoon samayso.",
        "Xogta dalabka: alaabta aad iibsato, magaca gaadhitaanka, cinwaanka, iyo lambarka telefoon aad xilliga bixinta geliso. Tani waxay khuseysaa iyadoon akoon lahayn ama akoon la leh — dalabyada martida waxay kaydiyaan xogta gaadhitaanka laakiin ma xidhna akoon.",
        "Xogta isticmaalka aasaasiga ah: waxaanu isticmaana Google Analytics 4 si aanu ogaado bogaggee iyo alaabtee ay hufan yihiin. Waxay aragtaa bogagga iyo dhacdooyinka, magacaaga iyo cinwaankaagana ma aragto.",
      ],
    },
    {
      h: "Sida xogta loo isticmaalo",
      p: [
        "Si aanu u dhammaystirno iyo u gaadhsiino dalabkaaga — xiriiriyaha gaadhitaanka iyo cinwaanka aad bixiso ayay kooxdeenu iyo gaadhisigu ka shaqeeyaan.",
        "Si aanu kula soo xiriirno dalabkaaga: xaqiijin, is-dheellitirnaanta gaadhitaanka, iyo dhibaatooyinka alaabta ama bixinta. Dalabyada martida, lambarka telefoon aad bixiso ayaa xiriiriyaha ah.",
        "Bixinada waxay shaqeeyaan Sifalo Pay (lacag telefoon iyo kaadhi). Xogta kaadhigaaga waxay Sifalo Pay boggakeeda amni ku maamushaa — serverada Hayaan waxay kaydiyaan xaaladda bixinta iyo tixraac macaamil, ma kaydinno xogta kaadhigaada.",
        "Caawimo: marka aad nala soo xiriirto email ama WhatsApp, waxaanu isticmaalnaa xogta aad la wadaagto si aanu kaa caawino.",
      ],
    },
    {
      h: "Waxa aanu sameynayn",
      p: [
        "Ma iibinno ama ma kiraystayno xogta shaqsiyad ah, mana isticmaalno shabakado xayeysiis oo ay ku soo raadaan.",
        "Ma dirno email xayeysiis haddii aad ka qoodin box-ka wararka — liisaskayna waxay kuugu sheegaan alaab iyo qiimooyin dhab ah.",
      ],
    },
    {
      h: "Xogta xagee ku nool yahay",
      p: [
        "Xogta dukaanka (akoonada, dalabyada, alaabta) waxay ku nool yihiin Supabase, adeeg database cloud ah. Gelitaanku waa kooxda Hayaan oo keliya, furayaasha akoonada waxay kaydsan yihiin si qarsoodi ah (hash) oo la beddeli karin.",
        "Diiwaanka dalabyada waa la kaydiyaa sababtoo ah suuqu waa inuu helayaa buuggiisa — gaadhitaanka, bixinada, iyo lacag celinta waa inay isla huraan.",
      ],
    },
    {
      h: "Xulashadaada iyo xiriirka",
      p: [
        "Waxaad arki kartaa oo cusboonaysiin kartaa xogtaada xilliga kasta dhaxalka akoonka marka aad soo gasho.",
        "Ma rabtaa in xogtaada la tirtiro ama la saxo? Nagu soo dir email oo aanu diyaarin doonaa. Waa inaanu kaydin karnaa diiwaanka dalabka shuruudaha xisaabaadku u baahan yihiin.",
        "Xiriir: email hoose, ama xiriirka WhatsApp ee xagga gudaha ee bogga.",
      ],
    },
  ],
};

export default async function PrivacyPage() {
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const c = lang === "so" ? SO : EN;

  return (
    <StoreShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-legal-page="privacy">
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
