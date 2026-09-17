import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LangProvider } from "@/components/store/language-provider";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/i18n/dictionary";

// Panton — the official Hayaan brand face (self-hosted, no external fetch).
// Bold/Black are pinned to the brand display spots (logo, hero heading,
// button labels) via the .font-panton utility; regular/body text stays on
// the original system stack — the Regular face is deliberately NOT loaded.
const panton = localFont({
  src: [
    { path: "./fonts/Panton-Bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/Panton-Black.otf", weight: "900", style: "normal" },
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
    default: "Hayaan Market — Everything You Need, All in One Market.",
    template: "%s — Hayaan Market",
  },
  description: "Shop useful, well-selected finds across apparel, beauty, electronics, and home at Hayaan Market — secure checkout via Sifalo Pay, delivered to your door.",
  keywords: ["Hayaan Market", "online marketplace", "online shopping", "ecommerce", "Somalia", "apparel", "beauty", "electronics", "home & living"],
  authors: [{ name: "Hayaan Market" }],
  icons: {
    icon: { url: "/hayaan-logo-green.svg", type: "image/svg+xml" },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Hayaan Market — Everything You Need, All in One Market.",
    description: "Shop useful, well-selected finds across apparel, beauty, electronics, and home — secure checkout via Sifalo Pay, delivered to your door.",
    url: "https://hayaan.co",
    siteName: "Hayaan Market",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Hayaan Market — Everything you need to shop." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hayaan Market",
    description: "Everything You Need, All in One Market.",
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
        {/* Pre-hydration tap feedback (Task 47). On slow phones (e.g. Galaxy
            M13) a "Back to shop" tap that lands BEFORE React hydrates starts a
            full-document navigation, and the old page sits frozen with zero
            feedback for seconds — the "it feels stuck, no response" report.
            This runs from the first HTML byte, long before hydration: if a tap
            on a link to "/" isn't owned by React (defaultPrevented) and the
            navigation doesn't commit within 100ms (SPA swaps finish faster),
            show an immediate full-screen "Loading the shop…" response. It
            hides itself when the shop page becomes current, on bfcache
            restores, and via a 10s failsafe so it can never stick. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(window.__hayaanTapFeedback)return;window.__hayaanTapFeedback=1;var ID="hayaan-nav-feedback";function hide(){var el=document.getElementById(ID);if(el)el.remove();var css=document.getElementById(ID+"-css");if(css)css.remove();}function show(){if(document.getElementById(ID))return;var st=document.createElement("style");st.id=ID+"-css";st.textContent="@keyframes hayaanSpin{to{transform:rotate(360deg)}}";document.head.appendChild(st);var ov=document.createElement("div");ov.id=ID;ov.setAttribute("role","status");ov.style.cssText="position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(250,248,241,.96);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";var sp=document.createElement("div");sp.style.cssText="width:34px;height:34px;border-radius:50%;border:3px solid #e6e2d4;border-top-color:#16a34a;animation:hayaanSpin .7s linear infinite";var lb=document.createElement("div");lb.textContent=${JSON.stringify(lang === "so" ? "Suuqa ayaa la keenayo…" : "Loading the shop…")};lb.style.cssText="font-size:14px;color:#111827";ov.appendChild(sp);ov.appendChild(lb);document.body.appendChild(ov);var iv=setInterval(function(){if(location.pathname==="/"){clearInterval(iv);hide();}},120);setTimeout(function(){clearInterval(iv);hide();},10000);window.addEventListener("pageshow",function(ev){if(ev.persisted){clearInterval(iv);hide();}});}document.addEventListener("click",function(e){try{if(e.defaultPrevented)return;var t=e.target;var a=t&&t.closest?t.closest('a[href="/"]'):null;if(!a||a.target==="_blank")return;if(location.pathname==="/")return;setTimeout(function(){if(location.pathname!=="/")show();},100);}catch(err){}});})();`,
          }}
        />
        <OrganizationJsonLd />
        <LangProvider initialLang={lang}>
          {children}
          <Toaster />
        </LangProvider>
        {/* Google Analytics 4 — loads after hydration, never blocks rendering. */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HHYT03XHG4"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
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
