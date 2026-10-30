import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StoreShell } from "@/components/store/store-shell";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";

// Task 136 / audit F4. This page lists exactly what the site stores in your
// browser — each entry below maps to real code:
//   • shop_session      — the signed-in session cookie (lib/auth-session.ts)
//   • hayaan_lang       — your EN/SO language choice (language-provider.tsx)
//   • hayaan_guest_cart — the guest cart (hooks/use-store.ts, Task 136)
//   • hayaan_guest_orders — guest order references for "Track your order"
//   • Google Analytics 4 (_ga…) — lazy-loaded in the root layout.

export const metadata: Metadata = {
  title: "Cookies",
  description:
    "The small list of cookies and local storage Hayaan Market uses — session, language, guest cart — and how to clear them.",
  alternates: { canonical: "/cookies" },
};

type Row = { name: string; what: string; keep: string };

const EN: { title: string; intro: string; tableHead: [string, string, string]; rows: Row[]; after: string[] } = {
  title: "Cookies",
  intro:
    "We keep this list short and honest. Hayaan Market uses a handful of cookies and local-storage entries to run the shop — there are no advertising trackers here. Everything is listed below with what it does.",
  tableHead: ["Name", "What it does", "How long it stays"],
  rows: [
    {
      name: "shop_session (cookie)",
      what: "Keeps you signed in after you log in, so your cart, orders, and saved details follow you between pages.",
      keep: "Until you sign out (or the cookie expires).",
    },
    {
      name: "hayaan_lang (cookie)",
      what: "Remembers whether you browse the store in English or Somali.",
      keep: "One year.",
    },
    {
      name: "hayaan_guest_cart (local storage)",
      what: "Holds your cart while you shop without an account, so it survives page loads. Cleared after you pay, and merged into your account cart when you sign in.",
      keep: "On your device until you pay, sign in, or clear it.",
    },
    {
      name: "hayaan_guest_orders (local storage)",
      what: "Saves the order references of purchases you made as a guest, so the “Track your order” page can show their status.",
      keep: "On your device (last 10 orders).",
    },
    {
      name: "_ga… (Google Analytics 4 cookies)",
      what: "Count anonymous page views and events so we know what's worth improving. No names, no addresses, no ad profiling.",
      keep: "Up to 13 months (Google's standard).",
    },
  ],
  after: [
    "You can clear any of this from your browser settings at any time — clearing shop_session just signs you out, and clearing hayaan_guest_cart empties the cart you built as a guest.",
    "Questions about anything on this page? Email us below or tap the WhatsApp link in the footer.",
  ],
};

const SO: typeof EN = {
  title: "Cookies",
  intro:
    "Liiskan waa mid gaaban oo daacadda ah. Hayaan Market waxay isticmaashaa cookies iyo kaydi browser oo yar oo suuqu u shaqeeya — xayeysiis-raadis ma jiro. Dhammaan waxaa halkan lagu qoray.",
  tableHead: ["Magaca", "Waxa ay qabato", "Intay jirtay"],
  rows: [
    {
      name: "shop_session (cookie)",
      what: "Waxay ku haysaa goorta aad soo gasho, si gaadhigaaga, dalabyadaada, iyo xogta kaydsan ay kula socdaan bogagga dhexdooda.",
      keep: "Illaa aad ka baxdo (ama cookie-gu waayo).",
    },
    {
      name: "hayaan_lang (cookie)",
      what: "Waxay xasuustaa luqadda aad suuqa ku akhriyso — English ama Somali.",
      keep: "Sanad.",
    },
    {
      name: "hayaan_guest_cart (local storage)",
      what: "Waxay kaydisaa gaadhiga aad dhisay marka aanan akoon lahayn, si uusan lumaan marka bogga cusboonaysiyo. Bixinta la dhammaaday kaddib waa la tirtiraa; marka aad soo galanna waxay ku daraan gaadhiga akoonkaaga.",
      keep: "Qalabkaaga — illaa aad bixiso, soo galdo, ama tirtirto.",
    },
    {
      name: "hayaan_guest_orders (local storage)",
      what: "Waxay kaydisaa tixraacyada dalabyada aad martid ahaan iibsato, si bogga “La soco dalabkaaga” uu muujiyo xaaladdooda.",
      keep: "Qalabkaaga (toban dalab ee ugu dambeeyay).",
    },
    {
      name: "_ga… (Google Analytics 4)",
      what: "Tirooyin aan magac lahayn oo bogagga ah, si aanu ogaado waxa mudan in la hagaajiyo. Magac ma jiro, cinwaan ma jiro, xayeysiis-raadis ma jiro.",
      keep: "Illaa 13 bilood (caadiga Google).",
    },
  ],
  after: [
    "Waxaad tirtiri kartaa wax kasta oo halkan ah goobaha browser-kaaga waqti kasta — tirtiridda shop_session waxay ku kala baxdaa goortaada, tirtiridda hayaan_guest_cart waxay faaruujisaa gaadhiga aad martid ahaan dhisay.",
    "Su'aalo ku saabsan boggaan? Nagu soo dir emailka hoose ama taabo xiriirka WhatsApp ee xagga hoose ee bogga.",
  ],
};

export default async function CookiesPage() {
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const c = lang === "so" ? SO : EN;

  return (
    <StoreShell>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6" data-legal-page="cookies">
        <h1 className="font-panton text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">{c.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{c.intro}</p>
        <div className="mt-8 overflow-x-auto rounded-xl border border-[#e6e2d4]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#faf8f1]">
                {c.tableHead.map((h, i) => (
                  <th key={i} className="border-b border-[#e6e2d4] px-4 py-3 font-semibold text-brand-dark">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="border-b border-[#e6e2d4]/60 px-4 py-3 font-medium text-foreground">{r.name}</td>
                  <td className="border-b border-[#e6e2d4]/60 px-4 py-3 leading-relaxed text-foreground/80">{r.what}</td>
                  <td className="border-b border-[#e6e2d4]/60 px-4 py-3 leading-relaxed text-muted-foreground">{r.keep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {c.after.map((para, j) => (
            <p key={j} className="text-sm leading-relaxed text-foreground/80">{para}</p>
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
