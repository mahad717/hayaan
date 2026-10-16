import { StorefrontApp } from "@/components/store/storefront-app";
import { listActiveProducts, listCategories } from "@/lib/products-server";
import { faqPageJsonLd, siteFaqs } from "@/lib/faq";
import { cookies } from "next/headers";
import { isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";
import type { Category, Product } from "@/lib/types";

// Awaiting searchParams makes this route render dynamically per request, so
// the ?view= deep link (Buy now / Proceed-to-checkout redirects, payment
// return "View my orders") reaches the SSR HTML. The client storefront then
// renders the requested view on the very first paint — no homepage flash.
export const dynamic = "force-dynamic";

// Views that may arrive via the /?view= deep link — must match VALID_VIEWS in
// storefront-app.tsx. Only the home view displays the catalog.
const VALID_VIEWS = ["home", "product", "checkout", "orders", "account", "wishlist"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const viewParam = typeof params.view === "string" ? params.view : undefined;
  const view = viewParam && VALID_VIEWS.includes(viewParam) ? viewParam : "home";

  // Render the catalog INTO the shop page's first HTML. On real phones the
  // "Back to shop" tap often fires before hydration finishes (booting the app
  // bundle on mobile data takes seconds), and a pre-hydration tap silently
  // falls back to a FULL DOCUMENT LOAD of "/" — with client-fetched products
  // that reload painted skeletons until the JS booted AND /api/products
  // answered, which read as "stuck … a few seconds later it shows up". With
  // the cards in the SSR HTML, both this reload path and the prefetched
  // client-side swap paint products the moment the page arrives. The timeout
  // guard falls back to the previous client-fetch behavior if the catalog
  // fetch misbehaves, so this can never be slower than before.
  let initialProducts: Product[] | undefined;
  let initialCategories: Category[] | undefined;
  if (view === "home") {
    try {
      const catalog = await Promise.race([
        Promise.all([listActiveProducts(), listCategories()]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      if (catalog) {
        [initialProducts, initialCategories] = catalog;
      }
    } catch {
      // SSR catalog fetch failed — undefined props keep the grid on its
      // existing client-side /api fetch path.
    }
  }

  return (
    <>
      {/* Task 107c: the owner's A18 video (XRecorder_20261016_02) shows the
          remaining jank of the 107 restore: this home document is ~1MB of
          HTML, and the restore script sits at the END of body — so on a slow
          phone the browser paints the hero at scroll 0 the moment the first
          chunks arrive, and only snaps to the saved grid offset when the
          parser finally reaches the restore script (0.3-1.8s later). That
          "hero flash, then teleport" reads as lag. Fix: this EARLY script
          (first thing in body, so it runs long before the grid is parsed)
          pre-computes the exact restore gate (same conditions as the
          end-of-body script: clean "/", not prerendering, same-origin
          /product/ referrer, fresh saved offset) and, when a restore is
          pending, masks the progressive paint with the site's cream +
          spinner until the restore applies. The shopper now sees one
          continuous loading state that resolves AT their position instead
          of a hero flash and a jump. Safety valve: the mask self-lifts
          after 3.5s and on bfcache resume, so it can never trap a page. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
if(window.__hayaanShopCover)return;window.__hayaanShopCover=1;
var KEY="hayaanShopY",MAX_AGE=1800000;
function hide(){
  try{
    window.__hayaanShopUncover=null;
    document.documentElement.classList.remove("hayaan-cov");
    var s=document.getElementById("hayaan-cov-style");if(s&&s.parentNode)s.parentNode.removeChild(s);
  }catch(e){}
}
window.__hayaanShopUncover=hide;
window.addEventListener("pageshow",function(ev){if(ev.persisted)hide();});
var ok=false;
try{
  if(location.pathname==="/"&&!location.search&&!document.prerendering){
    var r=null;try{r=new URL(document.referrer,location.href);}catch(e){}
    if(r&&r.origin===location.origin&&r.pathname.indexOf("/product/")===0){
      var d=null;try{d=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch(e){}
      if(d&&d.y>0&&Date.now()-d.t<=MAX_AGE){
        var st=document.createElement("style");st.id="hayaan-cov-style";
        st.textContent="html.hayaan-cov{background:#faf8f1!important}html.hayaan-cov body::after{content:\\"\\";position:fixed;inset:0;z-index:2147483646;background:#faf8f1}html.hayaan-cov body::before{content:\\"\\";position:fixed;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #e6e2d4;border-top-color:#16a34a;z-index:2147483647;animation:hayaanCovSpin .7s linear infinite}@keyframes hayaanCovSpin{to{transform:rotate(360deg)}}";
        (document.head||document.documentElement).appendChild(st);
        document.documentElement.classList.add("hayaan-cov");
        setTimeout(hide,3500);
        ok=true;
      }
    }
  }
}catch(e){}
if(!ok)hide();
})();`,
        }}
      />
      <CatalogItemList products={initialProducts ?? []} />
      {/* AEO (Task 77): FAQPage structured data for the site-wide questions.
          The matching VISIBLE answers render in the homepage FAQ section
          (below the catalog, inside StorefrontApp's home view), so markup
          and page content agree as answer engines expect. Task 94: the FAQ
          renders in the cookie language, so the JSON-LD mirrors the same
          language (markup must match visible content). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            ...faqPageJsonLd(
              siteFaqs(
                isLang((await cookies()).get(LANG_COOKIE)?.value)
                  ? ((await cookies()).get(LANG_COOKIE)!.value as "en" | "so")
                  : "en",
              ),
              "https://hayaan.co",
            ),
          }),
        }}
      />
      <StorefrontApp
        viewParam={viewParam}
        initialProducts={initialProducts}
        initialCategories={initialCategories}
      />
      {/* Task 107: "Back to shop" must return the shopper to WHERE THEY WERE
          in the grid. The owner's video (XRecorder_20261016_01) shows it: the
          phone's back button restores their grid position, but the PDP
          "Back to shop" link — a real cross-document navigation to "/" since
          Task 106, for prerender activation — always lands on the hero,
          because a new document starts at scroll 0 and Next can never
          restore a push navigation it didn't perform.

          This INLINE (pre-hydration) script bridges that gap:
          • SAVE — throttled scroll listener + pagehide flush keep the last
            shop offset in sessionStorage. Inline (not a React effect) is the
            whole point: on slow phones like the owner's A18, most browsing
            happens BEFORE hydration, and a React-based saver would miss it.
          • RESTORE — when this document was arrived at FROM a product page
            (referrer path starts /product/ — the Back-to-shop tap, the
            header shop button, wishlist/cart "go shopping" all navigate to
            "/" exactly), scroll back to the saved offset. Gated to the clean
            shop URL ("?" deep links render other views) and a 30-minute
            freshness window; fresh visits, external referrers and category
            hops keep the old land-at-top behavior.
          • PRERENDER — under Speculation Rules this script also runs inside
            the HIDDEN prerendered copy of "/", where document.prerendering
            is true: the restore defers to prerenderingchange so the scroll
            happens when the page is actually shown (instant activation AND
            the right position). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
if(window.__hayaanShopScroll)return;window.__hayaanShopScroll=1;
var KEY="hayaanShopY",MAX_AGE=1800000,pend=0,lastY=-1;
function active(){return location.pathname==="/"&&!location.search&&!document.prerendering;}
function save(){
  if(!active())return;
  var y=window.scrollY|0;
  if(y===lastY)return;
  lastY=y;
  try{sessionStorage.setItem(KEY,JSON.stringify({y:y,t:Date.now()}));}catch(e){}
}
window.addEventListener("scroll",function(){if(pend)return;pend=setTimeout(function(){pend=0;save();},250);},{passive:true});
window.addEventListener("pagehide",function(){if(pend){clearTimeout(pend);pend=0;}save();});
function restore(){
  if(!active())return;
  var r=null;try{r=new URL(document.referrer,location.href);}catch(e){}
  if(!r||r.origin!==location.origin||r.pathname.indexOf("/product/")!==0)return;
  var d=null;try{d=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch(e){}
  if(!d||!(d.y>0)||Date.now()-d.t>MAX_AGE)return;
  var y=d.y|0;
  // Re-anchor for ~3s after the first paint: late layout shifts on slow
  // phones (font swap, hydration re-layout, image boxes) can clamp the
  // restored offset DOWNWARD. Re-apply downward only — never upward, so
  // native scroll anchoring (which keeps the same cards in view when content
  // above grows) is not fought — and stop the instant the shopper interacts.
  var ticks=0,touched=false;
  function stop(){touched=true;}
  ["wheel","touchstart","keydown","pointerdown"].forEach(function(ev){window.addEventListener(ev,stop,{passive:true,once:true});});
  function apply(){
    // Task 107c: lift the early cover in the SAME frame as the first scroll
    // attempt, so the reveal shows the restored position — never scroll 0.
    if(window.__hayaanShopUncover){var u=window.__hayaanShopUncover;window.__hayaanShopUncover=null;try{u();}catch(e){}}
    if(touched)return;
    var max=(document.documentElement.scrollHeight|0)-window.innerHeight;
    if((window.scrollY|0)<y&&max>=y){window.scrollTo(0,y);lastY=y;}
    if(++ticks<12)setTimeout(apply,250);
  }
  requestAnimationFrame(function(){requestAnimationFrame(apply);});
}
if(document.prerendering){document.addEventListener("prerenderingchange",restore,{once:true});}else{restore();}
})();`,
        }}
      />
    </>
  );
}

/** Catalog ItemList so crawlers see the full product graph from the landing
 *  page (products are already in the SSR HTML — this names the URLs). */
function CatalogItemList({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: `https://hayaan.co/product/${p.slug}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
