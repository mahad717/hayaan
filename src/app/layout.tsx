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
  description: "Hayaan Market is a modern online marketplace built on Next.js, Supabase, and Cloudflare. Shop curated goods across apparel, electronics, home, and beauty.",
  keywords: ["Hayaan Market", "online marketplace", "Next.js", "Supabase", "Cloudflare", "ecommerce", "Somalia"],
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${panton.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
