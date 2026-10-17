import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { LangProvider } from "@/components/store/language-provider";
import { WhatsAppNumberProvider } from "@/components/store/whatsapp-number";
import { SUPPORT_EMAIL } from "@/lib/support-email";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/i18n/dictionary";

// Panton — the official Hayaan brand face (self-hosted, no external fetch).
// Bold/Black are pinned to the brand display spots (logo, hero heading,
// button labels) via the .font-panton utility; regular/body text stays on
// the original system stack — the Regular face is deliberately NOT loaded.
const panton = localFont({
  src: [
    // Task 109: WOFF2 builds of the same faces (103KB -> 88KB over the wire,
    // faster CFF parse). Converted from the original .otf via fonttools.
    { path: "./fonts/Panton-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Panton-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-panton",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hayaan.co"),
  title: {
    default: "Hayaan Market — Online Electronics Store in Somalia",
    template: "%s — Hayaan Market",
  },
  description:
    "The online electronics store near you in Somalia — shop phones, laptops, TVs, home electronics and gadgets at fixed USD prices, pay with EVC Plus, Edahab or card, and get door delivery in every Mogadishu district and nationwide.",
  keywords: [
    "electronics store Somalia",
    "online electronics store",
    "electronics store near me",
    "electronics shop Somalia",
    "buy electronics online",
    "electronics online shopping",
    "electronic shop Mogadishu",
    "home electronics Somalia",
    "electronic gadgets online",
    "consumer electronics store",
    "Hayaan Market",
    "online shopping Somalia",
  ],
  authors: [{ name: "Hayaan Market" }],
  icons: {
    icon: { url: "/hayaan-logo-green.svg", type: "image/svg+xml" },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Hayaan Market — Online Electronics Store in Somalia",
    description:
      "Shop phones, laptops, TVs, home electronics and gadgets at fixed USD prices — secure EVC Plus, Edahab & card checkout, door delivery in every Mogadishu district and nationwide.",
    url: "https://hayaan.co",
    siteName: "Hayaan Market",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Hayaan Market — the online electronics store that delivers across Somalia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hayaan Market — Online Electronics Store in Somalia",
    description:
      "Shop electronics online in Somalia: phones, laptops, TVs and home gadgets at fixed USD prices, delivered to your door.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { "max-image-preview": "large", "max-snippet": -1 },
  },
};

/** Site-wide structured data: who runs this store + how to search it. */
function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://hayaan.co/#organization",
        name: "Hayaan Market",
        url: "https://hayaan.co",
        logo: "https://hayaan.co/hayaan-logo-green.svg",
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: SUPPORT_EMAIL,
            availableLanguage: ["English", "Somali"],
          },
        ],
      },
      {
        "@type": "OnlineStore",
        "@id": "https://hayaan.co/#store",
        name: "Hayaan Market",
        url: "https://hayaan.co",
        logo: "https://hayaan.co/hayaan-logo-green.svg",
        description:
          "Online electronics store delivering phones, laptops, TVs, printers, routers, air conditioners and home gadgets across Mogadishu and Somalia at fixed USD prices.",
        areaServed: [
          { "@type": "City", name: "Mogadishu" },
          { "@type": "Country", name: "Somalia" },
        ],
        currenciesAccepted: "USD",
        paymentAccepted: "EVC Plus, Edahab, Credit Card",
        knowsAbout: [
          "smartphones",
          "laptops",
          "smart TVs",
          "printers",
          "Wi-Fi routers",
          "air conditioners",
          "home electronics",
          "electronic gadgets",
        ],
        parentOrganization: { "@id": "https://hayaan.co/#organization" },
      },
      {
        "@type": "WebSite",
        "@id": "https://hayaan.co/#website",
        name: "Hayaan Market",
        url: "https://hayaan.co",
        publisher: { "@id": "https://hayaan.co/#organization" },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: "https://hayaan.co/?q={search_term_string}" },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Resolve the WhatsApp business number at REQUEST time so the owner can set
 * it as a Worker runtime variable (instant, no rebuild), not just as a build
 * variable. Order: OpenNext worker process.env → worker context env.
 * Digit-normalized; empty string keeps the floating button hidden.
 */
async function resolveWhatsAppNumber(): Promise<string> {
  const digits = (v: unknown): string =>
    typeof v === "string" ? v.replace(/[^0-9]/g, "") : "";
  let n = digits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
  if (!n) {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const env = getCloudflareContext().env as unknown as Record<string, unknown>;
      n = digits(env.NEXT_PUBLIC_WHATSAPP_NUMBER);
    } catch {
      // Not running on the OpenNext worker (local dev / build) — ignore.
    }
  }
  return n;
}

// Reading the language cookie makes the layout async/dynamic, but every
// storefront route is already force-dynamic — cost is zero in practice.
// The payoff: the SSR HTML (and <html lang>) comes out in the visitor's
// chosen language on the FIRST byte, no client-side flash.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const lang: Lang = isLang(cookieStore.get(LANG_COOKIE)?.value)
    ? (cookieStore.get(LANG_COOKIE)!.value as Lang)
    : "en";
  const waNumber = await resolveWhatsAppNumber();

  return (
    // Font variables MUST live on <html>: Tailwind's base layer resolves
    // --default-font-family (→ --font-sans) at the html/:root level.
    // On <body> they were invisible to that rule and the whole site fell
    // back to the system font.
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${panton.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        {/* Task 109: card/PDP images live on Supabase Storage (transform
            endpoint) — warm the connection before the first lazy card image
            needs it. React 19 hoists this <link> into <head>. */}
        <link
          rel="preconnect"
          href="https://mqyhgyakhfhuctnvezby.supabase.co"
          crossOrigin="anonymous"
        />
        {/* Pre-hydration tap feedback (Task 47). On slow phones (e.g. Galaxy
            M13) a "Back to shop" tap that lands BEFORE React hydrates starts a
            full-document navigation, and the old page sits frozen with zero
            feedback for seconds — the "it feels stuck, no response" report.
            This runs from the first HTML byte, long before hydration: if a tap
            on a link to "/" isn't owned by React (defaultPrevented) and the
            navigation doesn't commit within 100ms (SPA swaps finish faster),
            show an immediate full-screen "Loading the shop…" response.
            Task 110 (owner request): that response is now TEXT-ONLY — the
            spinning wheel was removed. It hides itself when the shop page
            becomes current, on bfcache restores, and via a 10s failsafe so
            it can never stick. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
if(window.__hayaanTapFeedback)return;window.__hayaanTapFeedback=1;
var ID="hayaan-nav-feedback";
function hide(){
  var el=document.getElementById(ID);if(el)el.remove();
  var css=document.getElementById(ID+"-css");if(css)css.remove();
}
function show(label){
  // Task 110 (owner request): the spinning wheel is GONE site-wide. The
  // fullscreen veil only earns its cost when it carries the label; a bare
  // cream sheet (the old show(false)) would read as a blank page on cold
  // loads, so show() no-ops without one and real navigations fall back to
  // the browser's own progress UI.
  if(!label)return;
  if(document.getElementById(ID))return;
  var ov=document.createElement("div");ov.id=ID;ov.setAttribute("role","status");
  ov.style.cssText="position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(250,248,241,.96);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  var lb=document.createElement("div");
  lb.textContent=${JSON.stringify(lang === "so" ? "Suuqa ayaa la keenayo…" : "Loading the shop…")};
  lb.style.cssText="font-size:14px;color:#111827";
  ov.appendChild(lb);
  document.body.appendChild(ov);
  var p0=location.pathname;
  var iv=setInterval(function(){if(location.pathname!==p0){clearInterval(iv);hide();}},120);
  setTimeout(function(){clearInterval(iv);hide();},10000);
  window.addEventListener("pageshow",function(ev){if(ev.persisted){clearInterval(iv);hide();}});
}
document.addEventListener("click",function(e){
  try{
    if(e.defaultPrevented)return;
    var t=e.target;
    var a=t&&t.closest?t.closest('a[href="/"]'):null;
    if(!a||a.target==="_blank")return;
    if(location.pathname==="/")return;
    setTimeout(function(){if(location.pathname!=="/")show(true);},100);
  }catch(err){}
});
/* Task 110: the cold-open PDP veil (hayaan:pdp-nav → show(false)) is gone
   together with its spinner (owner request — no more spinning wheels): a
   bare cream sheet would read as a blank page on iOS's fully cold loads,
   and the browser's own progress UI covers real navigations. product-card
   .tsx still dispatches the event; nothing listens for it. */
})();`,
          }}
        />
        <OrganizationJsonLd />
        <LangProvider initialLang={lang}>
          <WhatsAppNumberProvider number={waNumber}>
            {children}
            {/* Radix toasts (legacy ui/toast consumers) + sonner toasts — the
                store's toast() calls sonner's API, and without this mount
                every success/error toast site-wide rendered NOTHING. */}
            <Toaster />
            <SonnerToaster position="top-center" richColors closeButton />
          </WhatsAppNumberProvider>
        </LangProvider>
        {/* Google Analytics 4 — lazyOnload keeps the 191KB gtag payload and
            its ~230ms of long tasks out of the render window (Task 109:
            afterInteractive still fetched it inside the Lighthouse/PSI trace
            and delayed TTI). GA collects fine from the post-load window. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HHYT03XHG4"
          strategy="lazyOnload"
        />
        <Script id="ga4-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HHYT03XHG4');
          `}
        </Script>
      </body>
    </html>
  );
}
