import Link from "next/link";
import type { Metadata } from "next";
import { Compass, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

// Branded 404 — replaces Next's default chrome-less error page. Keeps
// bounced visitors on the site with direct paths back into the catalog,
// and carries proper metadata (the default page stacked a stray title).
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <PackageSearch className="h-12 w-12 text-brand" aria-hidden />
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-brand">
        404
      </p>
      <h1 className="mt-2 text-3xl font-black font-panton tracking-tight text-brand-dark sm:text-4xl">
        This page wandered off the map
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The link may be old or mistyped — but the market is full of useful
        finds. Head back to the shop, browse a deal, or read the latest guide.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-brand text-white hover:bg-brand/90">
          <Link href="/">
            <Compass className="mr-2 h-4 w-4" aria-hidden />
            Back to the shop
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-[#e6e2d4]">
          <Link href="/deals">Current deals</Link>
        </Button>
        <Button asChild variant="outline" className="border-[#e6e2d4]">
          <Link href="/blog">Shopping guides</Link>
        </Button>
      </div>
    </div>
  );
}
