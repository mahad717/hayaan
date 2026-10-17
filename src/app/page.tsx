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

// Task 108: how many product cards go into the SSR HTML. The full catalog
// (141 cards) made the home document ~1.06MB, and on the owner's A18 that
// document IS the speed ceiling: the full-load path parses it for ~2s behind
// the restore cover, and the Speculation-Rules prerender of "/" needs ~3s of
// CPU to build (owner video 20261017: returns after <3s on the PDP paid the
// full price; longer visits activated the prerender instantly — so build
// time is the gate). The client already refetches the FULL catalog from the
// edge-cached /api/products on every mount (product-grid.tsx), so the SSR
// slice only decides what the FIRST PAINT holds: 36 cards (~18 rows on the
// 2-col grid) is far past the fold, and the remaining cards stream in within
// ~0.5s. SEO keeps the full graph: CatalogItemList below still names every
// product URL in the ItemList JSON-LD.
const SSR_CARD_COUNT = 36;

// Task 108b: the SSR slice must be the FIRST 36 of the catalog AS THE GRID
// DISPLAYS it. ProductGrid sorts displayProducts FEATURED-FIRST (stable) in
// its `visible` memo — both for the SSR slice and for the refetched full
// catalog. Slicing the RAW createdAt-desc list before that sort made the
// first-paint order differ from the post-fetch order (featured products sit
// at different positions in the two sequences), so the grid content SHIFTED
// under the shopper ~0.5s after paint — the owner's 20261017 video shows the
// restored position one row off with different neighbouring cards, on desktop
// AND mobile. Sorting with the exact same comparator BEFORE the slice makes
// the first-paint grid a true prefix of the full-catalog grid: no shift, and
// Task 107's scroll restore lands pixel-exact every time.

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
          pending, masks the progressive paint with the site's cream until
          the restore applies — one continuous surface that resolves AT
          their position instead of a hero flash and a jump.
          Task 110 (owner request): the spinning wheel that used to sit in
          this mask is GONE — a bare cream veil reads as the site itself,
          not a spinner stalling it. Safety valve: the mask self-lifts
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
        // Task 110: cream veil only — the spinning wheel is removed (owner request).
        var st=document.createElement("style");st.id="hayaan-cov-style";
        st.textContent="html.hayaan-cov{background:#faf8f1!important}html.hayaan-cov body::after{content:\\"\\";position:fixed;inset:0;z-index:2147483646;background:#faf8f1}";
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
        initialProducts={
          initialProducts
            ? [...initialProducts]
                .sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1))
                .slice(0, SSR_CARD_COUNT)
            : undefined
        }
        initialCategories={initialCategories}
      />
      {/* Task 108b: the owner's newest video (XRecorder_20261017_03) shows the
          FIRST product tap taking ~1.5s to open on the A18 (URL flips via
          pushState while the grid stays frozen — the RSC soft-nav gap).
          Speculation Rules prerendering fixes it: with `moderate` eagerness
          Chrome builds the PDP while the shopper is on the card (desktop:
          200ms hover; mobile 143+: 500ms after scrolling stops for anchors in
          view; older mobile: pointerdown), so the tap ACTIVATES a pre-built
          document instead of starting a navigation. This requires card taps
          to be REAL navigations (prerender activation never fires for
          router.push soft navs) — product-card.tsx now navigates via
          location.assign. Chrome 143 ALSO changed `eager` list rules (the
          PDP's old `urls:["/"], eagerness:"eager"` stopped firing — video
          shows every Back-to-shop paying the full load again), so the PDP's
          rule moves to an `immediate` document rule there. */}
      <script
        type="speculationrules"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            prerender: [{ where: { href_matches: "/product/*" }, eagerness: "moderate" }],
          }),
        }}
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
function save(force){
  if(!active())return;
  var y=window.scrollY|0;
  if(y===lastY&&!force)return;
  lastY=y;
  var d={y:y,t:Date.now()};
  try{
    // Task 108b: also remember WHICH card sits at the top of the viewport and
    // at what offset, so the restore can re-align to the same PRODUCTS if the
    // grid order ever shifts between save and restore (SSR slice vs refetched
    // catalog, stale caches). First anchor (document order) whose box reaches
    // below the sticky header zone = the topmost visible card.
    var as=document.querySelectorAll('a[href^="/product/"]');
    for(var i=0;i<as.length;i++){
      var r=as[i].getBoundingClientRect();
      if(r.height>10&&r.bottom>140){
        d.top=(as[i].getAttribute("href")||"").replace("/product/","");
        d.dy=Math.round(r.top);
        break;
      }
    }
    sessionStorage.setItem(KEY,JSON.stringify(d));
  }catch(e){}
}
window.addEventListener("scroll",function(){if(pend)return;pend=setTimeout(function(){pend=0;save();},250);},{passive:true});
window.addEventListener("pagehide",function(){if(pend){clearTimeout(pend);pend=0;}save(true);});
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
  var ticks=0,touched=false,reached=false;
  function stop(){touched=true;}
  ["wheel","touchstart","keydown","pointerdown"].forEach(function(ev){window.addEventListener(ev,stop,{passive:true,once:true});});
  function apply(){
    if(touched){if(window.__hayaanShopUncover){var v=window.__hayaanShopUncover;window.__hayaanShopUncover=null;try{v();}catch(e){}}return;}
    var max=(document.documentElement.scrollHeight|0)-window.innerHeight;
    if((window.scrollY|0)<y&&max>=y){
      // Task 108: reveal ONLY in the same frame as a scroll that actually
      // reaches the saved offset. With the SSR grid now holding a slice of
      // the catalog, a DEEP saved offset can exceed the first-paint document
      // height until the client fetch extends it — uncovering earlier would
      // flash the top of the grid before the snap-down. Holds at worst for
      // the 3s tick budget (fetch usually lands in <1s; the early cover's
      // own 3.5s self-lift remains the backstop).
      if(window.__hayaanShopUncover){var u=window.__hayaanShopUncover;window.__hayaanShopUncover=null;try{u();}catch(e){}}
      window.scrollTo(0,y);lastY=y;reached=true;
    }
    // Task 108b: content-anchored correction. The card TITLE link that sat
    // at the top of the viewport at save time is tracked every tick: if it
    // now sits elsewhere (grid re-ordered, late layout growth above the
    // grid), snap so the SAME PRODUCTS are back in view — pixel-exact y is
    // worthless if the cards moved. Runs only before any user interaction
    // and only for meaningful (>80px) shifts; the ticks budget bounds it.
    if(reached&&d.top){
      try{
        var ca=document.querySelector('a[href="/product/'+d.top+'"]');
        if(ca){
          var delta=Math.round(ca.getBoundingClientRect().top-(d.dy|0));
          if(delta<-80||delta>80){window.scrollTo(0,(window.scrollY|0)+delta);lastY=window.scrollY|0;}
        }
      }catch(e){}
    }
    if(++ticks<12)setTimeout(apply,250);
    else if(window.__hayaanShopUncover){var w=window.__hayaanShopUncover;window.__hayaanShopUncover=null;try{w();}catch(e){}}
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
