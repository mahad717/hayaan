import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Panton — the official Hayaan brand face (self-hosted, no external fetch).
// Regular carries body text, Bold headings/UI emphasis, Black display moments.
const panton = localFont({
  src: [
    { path: "./fonts/Panton-Regular.otf", weight: "400", style: "normal" },
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
  title: "Hayaan Market — Everything You Need, All in One Market.",
  description: "Shop useful, well-selected finds across apparel, beauty, electronics, and home at Hayaan Market — secure checkout via Sifalo Pay, delivered to your door.",
  keywords: ["Hayaan Market", "online marketplace", "online shopping", "ecommerce", "Somalia", "apparel", "beauty", "electronics", "home & living"],
  authors: [{ name: "Hayaan Market" }],
  icons: {
    icon: { url: "/hayaan-logo-green.svg", type: "image/svg+xml" },
  },
  openGraph: {
    title: "Hayaan Market",
    description: "Everything You Need, All in One Market.",
    url: "https://hayaan.co",
    siteName: "Hayaan Market",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hayaan Market",
    description: "Everything You Need, All in One Market.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font variables MUST live on <html>: Tailwind's base layer resolves
    // --default-font-family (→ --font-panton) at the html/:root level.
    // On <body> they were invisible to that rule and the whole site fell
    // back to the system font.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${panton.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
