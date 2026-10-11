import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { Compass, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isLang, LANG_COOKIE, translate, type DictKey } from "@/lib/i18n/dictionary";

// Branded 404 — replaces Next's default chrome-less error page. Keeps
// bounced visitors on the site with direct paths back into the catalog,
// and carries proper metadata (the default page stacked a stray title).
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  // Task 94: SSR the 404 copy in the visitor's language, same cookie
  // mechanism as every other server page.
  const cookieLang = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookieLang) ? cookieLang : "en";
  const t = (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <PackageSearch className="h-12 w-12 text-brand" aria-hidden />
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-brand">
        404
      </p>
      <h1 className="mt-2 text-3xl font-black font-panton tracking-tight text-brand-dark sm:text-4xl">
        {t("nf.h1")}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("nf.body")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="bg-brand text-white hover:bg-brand/90">
          <Link href="/">
            <Compass className="mr-2 h-4 w-4" aria-hidden />
            {t("nf.backShop")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-[#e6e2d4]">
          <Link href="/deals">{t("nf.deals")}</Link>
        </Button>
        <Button asChild variant="outline" className="border-[#e6e2d4]">
          <Link href="/blog">{t("nf.guides")}</Link>
        </Button>
      </div>
    </div>
  );
}
