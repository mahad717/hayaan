import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
    url: "https://hayaan.market",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
