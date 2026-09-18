/**
 * Hayaan Market i18n — English (en) + Somali (so).
 *
 * Flat dot-keys; the Somali record is type-checked against the English one,
 * so a missing key fails the build. `translate()` does {var} interpolation.
 *
 * Scope (v1): every customer-facing storefront string. Admin dashboard stays
 * English. Product names are brand/model names and are not translated.
 * Category names and the 8 rotating product-description templates ship as
 * curated Somali overrides below (fallback = the stored English text, e.g.
 * after the owner edits a description in the admin).
 */

export type Lang = "en" | "so";
export const LANGS: readonly Lang[] = ["en", "so"];
export const LANG_COOKIE = "hayaan_lang";

export function isLang(v: string | undefined | null): v is Lang {
  return v === "en" || v === "so";
}

type Vars = Record<string, string | number>;

const en = {
  // Header / chrome
  "header.shop": "Shop",
  "header.orders": "Orders",
  "header.blog": "Blog",
  "header.admin": "Admin",
  "header.adminDashboard": "Admin Dashboard",
  "header.myProfile": "My profile",
  "header.myOrders": "My orders",
  "header.signOut": "Sign out",
  "header.signIn": "Sign in",
  "header.searchPlaceholder": "Search products, categories, and more…",
  "header.searchAria": "Search products",
  "header.accountMenuAria": "Account menu",
  "header.cartAria": "Cart — {n} items",
  "header.cartBadgeAria": "{n} items in cart",
  "header.openMenuAria": "Open menu",
  "header.mobileNavAria": "Mobile navigation",
  "header.mobileAccountAria": "Mobile account",
  "header.tagline": "Everyday finds, one market",
  "lang.toggleAria": "Change language",

  // Hero
  "hero.badge": "Free shipping over $75",
  "hero.title1": "Find what you need,",
  "hero.title2": "discover what you’ll love.",
  "hero.sub":
    "Useful, well-selected finds across fashion, beauty, electronics, and home — all in one place, ready to order in minutes.",
  "hero.ctaShop": "Start shopping",
  "hero.ctaCategories": "Browse categories",
  "hero.reassure1": "Delivered to your door",
  "hero.reassure2": "Secure payment via Sifalo Pay",
  "hero.reassure3": "Track every order",
  "hero.payYourWay": "Pay your way",
  "hero.payMethods": "cards, EVC Plus, eDahab & more",

  // Product grid
  "grid.heading": "Find your next favorite",
  "grid.countOne": "1 product to explore",
  "grid.countOther": "{n} products to explore",
  "grid.resultsFor": "results for “{q}”",
  "grid.sortAria": "Sort by",
  "grid.sortFeatured": "Featured first",
  "grid.sortPriceAsc": "Price: low to high",
  "grid.sortPriceDesc": "Price: high to low",
  "grid.sortRating": "Top rated",
  "grid.all": "All",
  "grid.none": "No products found",
  "grid.noneHint": "Try a different search, or browse another category.",
  "grid.resetFilters": "Reset filters",
  "grid.viewCart": "View your cart →",

  // Product card
  "card.featured": "Featured",
  "card.add": "Add to cart",
  "card.added": "Added",
  "card.new": "New",
  "card.ratedAria": "Rated {r} out of 5",
  "card.newAria": "New product",
  "card.viewAria": "View {name}",
  "card.addAria": "Add {name} to cart",
  "card.addedAria": "{name} added to cart",

  // Product detail
  "pdp.back": "Back to shop",
  "pdp.unrated": "Unrated",
  "pdp.reviews": "{n} reviews",
  "pdp.sku": "SKU {sku}",
  "pdp.save": "Save {p}%",
  "pdp.stock": "{n} in stock",
  "pdp.lowStock": "Only {n} left in stock",
  "pdp.out": "Out of stock",
  "pdp.qtyMinus": "Decrease quantity",
  "pdp.qtyPlus": "Increase quantity",
  "pdp.buyNow": "Buy now",
  "pdp.imgAria": "View image {n}",

  // Cart drawer
  "cart.title": "Your cart",
  "cart.emptyHint": "Browse the catalog and add items to start your order.",
  "cart.itemsOne": "1 item ready for checkout.",
  "cart.itemsOther": "{n} items ready for checkout.",
  "cart.emptyBody": "Nothing here yet — find something you’ll love.",
  "cart.startShopping": "Start shopping",
  "cart.removeAria": "Remove {name} from cart",
  "cart.subtotal": "Subtotal",
  "cart.shipping": "Shipping",
  "cart.free": "Free",
  "cart.total": "Total",
  "cart.freeAway": "You’re {amount} away from free shipping.",
  "cart.shippingCalc": "Calculated at checkout",
  "cart.proceed": "Proceed to checkout",
  "cart.signinCheckout": "Sign in to check out",

  // Checkout
  "co.checkoutTitle": "Checkout",
  "co.redirectTitle": "Redirecting to Sifalo Pay…",
  "co.redirectBody":
    "Taking you to the secure checkout to approve your payment. Please don’t close or refresh this page.",
  "co.stuck": "Nothing happening? Click to continue",
  "co.thanks": "Thank you for your order!",
  "co.orderRef": "Order reference",
  "co.summary": "Order summary",
  "co.totalPaid": "Total paid",
  "co.payMethod": "Payment method",
  "co.emailNote":
    "A confirmation email is on its way. You can track your order in the Orders tab.",
  "co.viewOrders": "View my orders",
  "co.continueShopping": "Continue shopping",
  "co.preparing": "Preparing checkout…",
  "co.signinTitle": "Please sign in to check out",
  "co.signinBody": "We need your account so we can attach the order to you.",
  "co.emptyTitle": "Your cart is empty",
  "co.emptyBody": "Add some items before checking out.",
  "co.browse": "Browse products",
  "co.address": "Shipping address",
  "co.prefilled":
    "Prefilled from your saved address — edit below if you need changes. Manage it from My profile.",
  "co.fullName": "Full name",
  "co.phone": "Phone",
  "co.optional": "(optional)",
  "co.street": "Street address",
  "co.city": "City",
  "co.zip": "ZIP / Postal code",
  "co.country": "Country",
  "co.district": "District",
  "co.districtPlaceholder": "Select your district",
  "co.districtOther": "Other city (outside Mogadishu)",
  "co.districtHint": "Delivery is priced by district — free over $75.",
  "co.pickDistrict": "Pick your district",
  "co.pickDistrictToast": "Please choose your delivery district so we can bring your order.",
  "co.recommended": "Recommended",
  "co.sifaloDesc":
    "Cards, EVC Plus, eDahab, Sahal & 20+ more — you’ll be redirected to a secure page to pay.",
  "co.how":
    "How it works: you’ll be redirected to Sifalo Pay’s secure checkout to choose your payment method and approve the payment. You’ll come right back here and your order will be confirmed automatically.",
  "co.processedBy": "Processed by Sifalo Pay — your payment details never touch our servers.",
  "co.unavailable": "Online payment is temporarily unavailable — please check back soon.",
  "co.payButton": "Pay {amount} with Sifalo Pay",
  "co.secureNote": "Secure checkout · Powered by Sifalo Pay",

  // Auth modal
  "au.welcomeBack": "Welcome back",
  "au.createTitle": "Create your account",
  "au.loginDesc": "Sign in to track orders, sync your cart, and check out faster.",
  "au.signupDesc":
    "Join Hayaan Market — save your details, track your orders, and check out faster next time.",
  "au.tabSignin": "Sign in",
  "au.tabCreate": "Create account",
  "au.email": "Email",
  "au.password": "Password",
  "au.name": "Name",
  "au.minChars": "At least 6 characters.",
  "au.signingIn": "Signing in…",
  "au.creating": "Creating account…",
  "au.or": "or",
  "au.continueGoogle": "Continue with Google",
  "au.setupTitle": "Setting up for the first time?",
  "au.setupBody":
    "Close this dialog, tap “Seed now” on the orange banner above, then sign in with the credentials shown there.",
  "au.toastWelcome": "Welcome, {name}!",
  "au.toastFailed": "Authentication failed",
  "au.toastNetwork": "Network error. Try again.",
  "au.toastGoogleOff": "Google sign-in is not configured on this deployment.",
  "au.toastGoogleFail": "Could not start Google sign-in.",

  // Account / profile
  "acc.loading": "Loading your profile…",
  "acc.signinTitle": "Sign in to view your profile",
  "acc.signinBody": "Your contact details and saved shipping address live in your account.",
  "acc.contact": "Contact details",
  "acc.emailNote": "Your sign-in email can’t be changed here.",
  "acc.addressNote": "Saved for faster checkout — we’ll prefill this at checkout.",
  "acc.courierNote": "The courier may use your phone number to arrange delivery.",
  "acc.reset": "Reset",
  "acc.saving": "Saving…",
  "acc.save": "Save profile",
  "acc.toastNameEmpty": "Name cannot be empty.",
  "acc.toastSaveFail": "Could not save your profile.",
  "acc.toastSaved": "Profile saved",
  "acc.toastNetwork": "Network error — try again.",

  // Orders
  "ord.loading": "Loading your orders…",
  "ord.signinTitle": "Sign in to see your orders",
  "ord.signinBody": "Your order history lives in your account.",
  "ord.title": "Your orders",
  "ord.countOne": "1 order",
  "ord.countOther": "{n} orders",
  "ord.loadingDots": "Loading…",
  "ord.none": "You haven’t placed any orders yet.",
  "ord.orderLabel": "Order {ref}",
  "ord.qty": "Qty {n}",
  "ord.shipTo": "Shipping to",
  "ord.payment": "Payment",
  "ord.payStatus": "Payment {status}",
  "ord.checkStatus": "Check payment status",
  "ord.checking": "Checking…",
  "ord.stPending": "Pending",
  "ord.stPaid": "Paid",
  "ord.stShipped": "Shipped",
  "ord.stDelivered": "Delivered",
  "ord.stCancelled": "Cancelled",
  "ord.verifyPaid": "Payment confirmed — thank you!",
  "ord.verifyPending": "Still pending approval by the payment network.",
  "ord.verifyFailed": "The payment failed or was declined.",
  "ord.verifyError": "Could not check with Sifalo Pay right now.",
  "ord.verifyNetwork": "Network error — please try again.",

  // Footer
  "ft.blurb":
    "Everyday finds made easy to discover — useful products across fashion, beauty, electronics, and home.",
  "ft.shop": "Shop",
  "ft.shopAll": "Shop all products",
  "ft.featured": "Featured picks",
  "ft.topRated": "Top rated",
  "ft.gifts": "Gift ideas",
  "ft.blog": "Blog — guides & picks",
  "ft.support": "Support",
  "ft.help": "Help center",
  "ft.shippingInfo": "Shipping info",
  "ft.track": "Track your order",
  "ft.contact": "Contact us",
  "ft.stay": "Stay in touch",
  "ft.stayBlurb": "New finds, practical picks, and updates from the market — follow along.",
  "ft.rights": "© {year} Hayaan Market. All rights reserved.",
  "ft.privacy": "Privacy",
  "ft.terms": "Terms",
  "ft.cookies": "Cookies",
  "ft.bulkOrders": "Bulk orders & quotes",

  // Lead engine — newsletter / offer popup / quote page / WhatsApp (Task 57)
  "lead.popupTitle": "New arrivals & deals — before anyone else",
  "lead.popupBody":
    "Join the Hayaan list and we'll ping you when something worth your money lands. No spam — one short note at a time.",
  "lead.popupEmailPh": "you@example.com",
  "lead.popupPhonePh": "WhatsApp or phone number",
  "lead.popupContactHint": "Leave an email, a WhatsApp number, or both.",
  "lead.popupCta": "Keep me posted",
  "lead.popupNoThanks": "No thanks",
  "lead.popupSuccessTitle": "You're on the list!",
  "lead.popupSuccessBody":
    "We'll reach out when something good lands — watch your inbox or WhatsApp.",
  "lead.popupError": "Couldn't save that — please try again.",
  "ft.newsletterPh": "your@email.com",
  "ft.subscribe": "Subscribe",
  "ft.subscribed": "You're in — welcome!",
  "wa.aria": "Chat with us on WhatsApp",
  "wa.message": "Hi Hayaan Market! I have a question about ",
  "quote.heading": "Bulk orders & quotes",
  "quote.sub":
    "Buying for an office, school, hotel, mosque, shop, or organization? Tell us what you need — quantities and models — and we'll reply with a custom quote, usually better than the listed prices.",
  "quote.benefit1": "Better prices than listed, on quantities",
  "quote.benefit2": "One delivery, one invoice — we handle the running around",
  "quote.benefit3": "Reply within one business day, WhatsApp first",
  "quote.name": "Full name",
  "quote.namePh": "e.g. Ahmed Ali",
  "quote.business": "Business / organization (optional)",
  "quote.businessPh": "e.g. Iftin Hotel",
  "quote.phone": "Phone / WhatsApp",
  "quote.phonePh": "+252 …",
  "quote.email": "Email (optional)",
  "quote.emailPh": "you@example.com",
  "quote.items": "What do you need?",
  "quote.itemsPh": "e.g. 10 × iPhone 17, 5 × HP EliteBook 840, 20 chargers…",
  "quote.itemsHint": "List the items and quantities — brands, models, counts.",
  "quote.cta": "Request a quote",
  "quote.sending": "Sending…",
  "quote.successTitle": "Request received!",
  "quote.successBody":
    "We'll reply within one business day — WhatsApp first if you left a number.",
  "quote.another": "Send another request",
  "quote.preferEmail": "Prefer email? Write to us directly:",
  "deals.heading": "Never miss an electronics deal",
  "deals.sub":
    "Join the Hayaan deal list — price drops, restocks and flash offers on phones, laptops, TVs and appliances reach this list first. We'll reach you on WhatsApp or email, your choice.",
  "deals.benefit1": "First look — this list hears about drops before the public",
  "deals.benefit2": "WhatsApp price alerts on what you actually care about",
  "deals.benefit3": "Restock alerts on items that sell out fast",
  "deals.name": "Full name (optional)",
  "deals.namePh": "e.g. Ahmed Ali",
  "deals.phone": "Phone / WhatsApp",
  "deals.phonePh": "+252 …",
  "deals.email": "Email (optional)",
  "deals.emailPh": "you@example.com",
  "deals.interest": "What are you hunting for?",
  "deals.interestPh": "Pick one…",
  "deals.i1": "Phones",
  "deals.i2": "Laptops & computing",
  "deals.i3": "TV & audio",
  "deals.i4": "Home appliances",
  "deals.i5": "Accessories",
  "deals.i6": "Everything — surprise me",
  "deals.cta": "Join the deal list",
  "deals.sending": "Joining…",
  "deals.successTitle": "You're on the list!",
  "deals.successBody": "Watch your WhatsApp — the next price drop lands there first.",
  "deals.privacy": "No spam, ever — only real deals, and you can leave anytime.",
  "ft.dealAlerts": "Deal alerts",

  // Seed callout (fresh deployments only)
  "seed.demo": "Demo mode.",
  "seed.body":
    "No products yet. Click below to seed the catalog with sample data and an admin user.",
  "seed.now": "Seed now",
  "seed.dismiss": "Dismiss",
  "seed.fail": "Seeding failed — check the deployment logs.",

  // Misc
  "misc.tapLoading": "Loading the shop…",

  // Sifalo Pay return page (server-rendered guards)
  "sf.received": "Payment received — thank you!",
  "sf.via": "via {type}",
  "sf.missingRefTitle": "Missing payment reference",
  "sf.missingRefBody":
    "We couldn’t tell which order this payment belongs to. If you completed a payment, check your Orders page — it will update once the payment is confirmed.",
  "sf.signinTitle": "Sign in to confirm your payment",
  "sf.signinBody":
    "We couldn’t confirm order {ref} because you are signed out. Sign in with the same account you paid with, then open Orders — the payment status will refresh there.",
  "sf.notFoundTitle": "Order not found",
  "sf.notFoundBody": "This order doesn’t exist or belongs to a different account.",
  "sf.cantCheckTitle": "Couldn’t check your payment",
  "sf.pendingTitle": "Payment pending approval",
  "sf.pendingBody":
    "{msg} Your order {ref} is saved — we’ll confirm it as soon as the network approves the transaction. You can safely check again.",
  "sf.failedTitle": "Payment was not completed",
  "sf.failedBody":
    "{msg} No money has left your account. Your order {ref} is saved — you can retry checkout from the store.",
  "sf.unknownTitle": "We couldn’t verify the payment yet",
  "sf.unknownBody":
    "{msg} If you just completed the payment it can take a moment to register — try checking again.",
  "sf.backRetry": "Back to store to retry",
  "sf.checkNow": "Check now",
  "sf.checkAgain": "Check payment again",
  "sf.checking": "Checking with Sifalo Pay…",
  "sf.pendingNote": "Still pending — the network hasn’t approved it yet.",
  "sf.notConfirmed": "Still not confirmed. Give it a moment and try again.",
} as const;

export type DictKey = keyof typeof en;

const so: Record<DictKey, string> = {
  // Header / chrome
  "header.shop": "Iibso",
  "header.orders": "Dalabyada",
  "header.blog": "Blog",
  "header.admin": "Maamul",
  "header.adminDashboard": "Guddiga maamulka",
  "header.myProfile": "Profaylkayga",
  "header.myOrders": "Dalabyadayda",
  "header.signOut": "Ka bax",
  "header.signIn": "Soo gal",
  "header.searchPlaceholder": "Raadi alaab, qaybaho, iyo wax kale…",
  "header.searchAria": "Raadi alaab",
  "header.accountMenuAria": "Menuka akoonka",
  "header.cartAria": "Gaadhi — {n} alaab",
  "header.cartBadgeAria": "{n} alaab oo gaadhiga ku jira",
  "header.openMenuAria": "Fur menuka",
  "header.mobileNavAria": "Hagaha mobilka",
  "header.mobileAccountAria": "Akoonka mobilka",
  "header.tagline": "Wax maalinle oo dhan, hal suuq",
  "lang.toggleAria": "Beddel luqadda",

  // Hero
  "hero.badge": "Gaadhitaan bilaash ah $75 ka badan",
  "hero.title1": "Hel waxa aad u baahan tahay,",
  "hero.title2": "oo hel waxa aad jeceshahay.",
  "hero.sub":
    "Alaab wanaagsan oo si fiican loo doortay — dhar, quruxda, elektirooniks iyo guryaha. Dhammaanna hal meel bay ku jiraan, waqti gaaban ayaad ku dalban kartaa.",
  "hero.ctaShop": "Bilow iibsiga",
  "hero.ctaCategories": "Daawo qaybaha",
  "hero.reassure1": "Waa la keenaa albaabkaaga",
  "hero.reassure2": "Bixin ammaan oo Sifalo Pay ah",
  "hero.reassure3": "La soco dalab kasta",
  "hero.payYourWay": "Bixi sidii aad rabto",
  "hero.payMethods": "kaarka, EVC Plus, eDahab iyo kuwo kale",

  // Product grid
  "grid.heading": "Hel waxa xiga ee aad jeceshahay",
  "grid.countOne": "1 alaab oo la baari karo",
  "grid.countOther": "{n} alaab oo la baari karo",
  "grid.resultsFor": "natiijooyinka “{q}”",
  "grid.sortAria": "Kala saar",
  "grid.sortFeatured": "La muujiyay marka hore",
  "grid.sortPriceAsc": "Qiimaha: hoos ilaa kor",
  "grid.sortPriceDesc": "Qiimaha: kor ilaa hoos",
  "grid.sortRating": "Qiimeyn ugu sareysa",
  "grid.all": "Dhammaan",
  "grid.none": "Alaab lama helin",
  "grid.noneHint": "Isku day raad kale, ama fiiri qayb kale.",
  "grid.resetFilters": "Dib u deji shaandhaynta",
  "grid.viewCart": "Fiiri gaadhigaaga →",

  // Product card
  "card.featured": "La muujiyay",
  "card.add": "Ku dar gaadhiga",
  "card.added": "La daray",
  "card.new": "Cusub",
  "card.ratedAria": "Qiimeyn: {r} / 5",
  "card.newAria": "Alaab cusub",
  "card.viewAria": "Fiiri {name}",
  "card.addAria": "Ku dar {name} gaadhiga",
  "card.addedAria": "{name} waa la daray gaadhiga",

  // Product detail
  "pdp.back": "Ku noqo suuqa",
  "pdp.unrated": "Weli lama qiimeyn",
  "pdp.reviews": "{n} faallo",
  "pdp.sku": "SKU {sku}",
  "pdp.save": "Ku badbaadi {p}%",
  "pdp.stock": "{n} ayaa jira",
  "pdp.lowStock": "Keliya {n} ayaa hadhay",
  "pdp.out": "Waa dhammaaday",
  "pdp.qtyMinus": "Yaree tirada",
  "pdp.qtyPlus": "Kordhi tirada",
  "pdp.buyNow": "Iibso hadda",
  "pdp.imgAria": "Fiiri sawirka {n}",

  // Cart drawer
  "cart.title": "Gaadhigaaga",
  "cart.emptyHint": "Baadh alaabta, kaddibna ku dar waxa aad dalbanayso.",
  "cart.itemsOne": "1 alaab ayaa diyaar u ah dalabka.",
  "cart.itemsOther": "{n} alaab ayaa diyaar u ah dalabka.",
  "cart.emptyBody": "Weli wax ma jiro — hel waxa aad jeceshahay.",
  "cart.startShopping": "Bilow iibsiga",
  "cart.removeAria": "Ka saar {name} gaadhiga",
  "cart.subtotal": "Wadarta hoose",
  "cart.shipping": "Gaadhitaan",
  "cart.free": "Bilaash",
  "cart.total": "Wadarta guud",
  "cart.freeAway": "{amount} ayaa ka hadhay gaadhitaan bilaash ah.",
  "cart.shippingCalc": "Waa la xisaabin doonaa marka la bixinayo",
  "cart.proceed": "Sii wad bixinta",
  "cart.signinCheckout": "Soo gal si aad u bixiso",

  // Checkout
  "co.checkoutTitle": "Bixinta",
  "co.redirectTitle": "La wareejinayo Sifalo Pay…",
  "co.redirectBody":
    "Waxaan kula wareejinaynaa bixinta ammaan ah si aad u ansixiso lacagta. Fadlan ha xirin ama ha cusbooneysiin boggaan.",
  "co.stuck": "Waxba ma socda? Guji si aad u sii wadato",
  "co.thanks": "Waad ku mahadsan tahay dalabkaaga!",
  "co.orderRef": "Tixraac dalab",
  "co.summary": "Dulmar dalabka",
  "co.totalPaid": "Wadarta la bixiyay",
  "co.payMethod": "Habka bixinta",
  "co.emailNote":
    "Email xaqiijin ah ayaa la soo dirayaa. Dalabkaaga waxaad kula socdaan kartaa bogga Dalabyada.",
  "co.viewOrders": "Dalabyadayda",
  "co.continueShopping": "Sii wad iibsiga",
  "co.preparing": "Diyaarinaya bixinta…",
  "co.signinTitle": "Fadlan soo gal si aad u bixiso",
  "co.signinBody": "Waxaan u baannahay akoonkaaga si aan dalabka kugu dhisno.",
  "co.emptyTitle": "Gaadhigaaga waa madhan",
  "co.emptyBody": "Ka hor bixinta, ku dar alaab gaadhigaaga.",
  "co.browse": "Baadh alaabta",
  "co.address": "Cinwaanka gaadhitaanka",
  "co.prefilled":
    "Laga soo buuxiyay cinwaankaaga kaydsan — hoose ka beddel haddii aad u baahatid. Ka maamul Profaylkayga.",
  "co.fullName": "Magaca oo dhan",
  "co.phone": "Teleefoon",
  "co.optional": "(ixtiyaari)",
  "co.street": "Cinwaanka waddada",
  "co.city": "Magaalada",
  "co.zip": "Koodhka boostada",
  "co.country": "Wadanka",
  "co.district": "Degmada",
  "co.districtPlaceholder": "Dooro degmadaada",
  "co.districtOther": "Magaalo kale (Muqdisho ka baxsan)",
  "co.districtHint": "Gaadhitaanka waxaa go'aamiya degmada — $75 ka badan waa bilaash.",
  "co.pickDistrict": "Dooro degmadaada",
  "co.pickDistrictToast": "Fadlan dooro degmada si aan u soo gaadhinno dalabkaaga.",
  "co.recommended": "Loogu tala galay",
  "co.sifaloDesc":
    "Kaarka, EVC Plus, eDahab, Sahal iyo kuwo kaloo ka badan 20 — boggan ammaan ah ayaad la wareegaysaa si aad u bixiso.",
  "co.how":
    "Sida ay u shaqeysaa: waxaad la wareegaysaa bixinta ammaan ah ee Sifalo Pay si aad ka doorato habka bixinta oo aad lacagta u ansixiso. Isla halkan ayaad ku noqon doontaa, dalabkaagana waa la xaqiijinayaa si toos ah.",
  "co.processedBy": "Waxaa maamula Sifalo Pay — faahfaahinta bixintaada ma gaadhaan serveradeena.",
  "co.unavailable": "Bixinta onlaynka ah hadda si ku meel gaadh ah uma helna — fadlan dib ugu soo noqo.",
  "co.payButton": "Bixi {amount} Sifalo Pay",
  "co.secureNote": "Bixin ammaan · Sifalo Pay",

  // Auth modal
  "au.welcomeBack": "Soo dhawoow",
  "au.createTitle": "Samee akoonkaaga",
  "au.loginDesc":
    "Soo gal si aad dalabyada u la socoto, gaadhigaaga meel ku kaydsan yeeshee, oo si degdeg ah u bixiso.",
  "au.signupDesc":
    "Ku biir Hayaan Market — kaydi xogtaada, la soco dalabyadaada, oo marxaladaha soo socda si degdeg ah u bixi.",
  "au.tabSignin": "Soo gal",
  "au.tabCreate": "Samee akoon",
  "au.email": "Email",
  "au.password": "Furaha",
  "au.name": "Magac",
  "au.minChars": "Ugu yaraan 6 xaraf.",
  "au.signingIn": "Soo galaya…",
  "au.creating": "Akoon la sameynayo…",
  "au.or": "ama",
  "au.continueGoogle": "Sii wad Google",
  "au.setupTitle": "Dhisaysaa markii ugu horreysay?",
  "au.setupBody":
    "Xir furiyahan, guji “Buuxi hadda” ee bandhigga orange ee sare, kaddibna soo gal xogta lagu muujiyay.",
  "au.toastWelcome": "Soo dhawoow, {name}!",
  "au.toastFailed": "Gelitaanku wuu fashilmay",
  "au.toastNetwork": "Dhib shabakad. Isku day.",
  "au.toastGoogleOff": "Google sign-in halkan lama shudiin.",
  "au.toastGoogleFail": "Google sign-in lama bilaabi karo.",

  // Account / profile
  "acc.loading": "Profaylkaaga ayaa la keenayo…",
  "acc.signinTitle": "Soo gal si aad u aragto profaylkaaga",
  "acc.signinBody": "Xogta xiriirka iyo cinwaanka kaydsan waxay ku jiraan akoonkaaga.",
  "acc.contact": "Xogta xiriirka",
  "acc.emailNote": "Emailka gelitaanka lama beddelo halkan.",
  "acc.addressNote": "Kaydsan si bixinta u fududaato — bixinta waa la soo buuxinayaa.",
  "acc.courierNote": "Khadka keenista wuxuu teleefoonkaaga ka isticmaali karaa inuu kula hadlo gaadhitaanta.",
  "acc.reset": "Dib u deji",
  "acc.saving": "Kaydinaya…",
  "acc.save": "Kaydi profaylka",
  "acc.toastNameEmpty": "Magac madhan ma noqon karo.",
  "acc.toastSaveFail": "Profaylka lama kaydin.",
  "acc.toastSaved": "Profaylka waa la kaydiyay",
  "acc.toastNetwork": "Dhib shabakad — isku day mar kale.",

  // Orders
  "ord.loading": "Dalabyadaaga ayaa la keenayo…",
  "ord.signinTitle": "Soo gal si aad u aragto dalabyadaada",
  "ord.signinBody": "Taariikhda dalabyada waxay ku jirtaa akoonkaaga.",
  "ord.title": "Dalabyadaaga",
  "ord.countOne": "1 dalab",
  "ord.countOther": "{n} dalab",
  "ord.loadingDots": "La keenayo…",
  "ord.none": "Weli ma samaysan dalab.",
  "ord.orderLabel": "Dalab {ref}",
  "ord.qty": "Tiro {n}",
  "ord.shipTo": "La soo dirayaa",
  "ord.payment": "Bixinta",
  "ord.payStatus": "Bixinta: {status}",
  "ord.checkStatus": "Xaqiiji xaaladda bixinta",
  "ord.checking": "Xaqiijinaya…",
  "ord.stPending": "Sugaya",
  "ord.stPaid": "La bixiyay",
  "ord.stShipped": "La dirtay",
  "ord.stDelivered": "La gaadhsiiyay",
  "ord.stCancelled": "La joojiyay",
  "ord.verifyPaid": "Bixinta waa la xaqiijiyay — waad ku mahadsan tahay!",
  "ord.verifyPending": "Weli waa sugaya ansixinta shabakada bixinta.",
  "ord.verifyFailed": "Bixintu way fashilantay ama waa la diiday.",
  "ord.verifyError": "Hadda Sifalo Pay lama xaqiijin karo.",
  "ord.verifyNetwork": "Dhib shabakad — fadlan isku day mar kale.",

  // Footer
  "ft.blurb":
    "Wax maalinle oo si fudud loo helo — alaab muhiim ah: dhar, quruxda, elektirooniks iyo guryaha.",
  "ft.shop": "Iibso",
  "ft.shopAll": "Dhammaan alaabta",
  "ft.featured": "Xulashada la muujiyay",
  "ft.topRated": "Ugu qiimeyn fiican",
  "ft.gifts": "Fikrado hadiyad ah",
  "ft.blog": "Blog — hagr iyo xulasho",
  "ft.support": "Caawimo",
  "ft.help": "Xarunta caawinta",
  "ft.shippingInfo": "Xogta gaadhitaanka",
  "ft.track": "La soco dalabkaaga",
  "ft.contact": "Nala soo xiriir",
  "ft.stay": "Nala socon",
  "ft.stayBlurb": "Wax cusub, xulasho wax ku ool, iyo waraarinta suuqa — nala socon.",
  "ft.rights": "© {year} Hayaan Market. Xuquuqda oo dhan waa lagu haysto.",
  "ft.privacy": "Sirta",
  "ft.terms": "Shuruudaha",
  "ft.cookies": "Cookies",
  "ft.bulkOrders": "Dalabyo waaweyn & qiimayn",

  // Lead engine — newsletter / offer popup / quote page / WhatsApp (Task 57)
  "lead.popupTitle": "Alaab cusub & faa'iidooyin — ka hor qof kasta",
  "lead.popupBody":
    "Ku biir liiska Hayaan, waannu kuu sheegi doonaa marka alaab danayn kara la yimaado. Ma jiro spam — fariin gaaban oo keliya.",
  "lead.popupEmailPh": "you@example.com",
  "lead.popupPhonePh": "WhatsApp ama taleefan",
  "lead.popupContactHint": "Email, number WhatsApp, ama labadaba.",
  "lead.popupCta": "I warran",
  "lead.popupNoThanks": "Maya, mahadsanid",
  "lead.popupSuccessTitle": "Waad liiska ku dhaaftay!",
  "lead.popupSuccessBody":
    "Waxaan kula soo xiriiri doonaa marka wax fiican yimaado — la soco email-kaaga ama WhatsApp-ka.",
  "lead.popupError": "Lama kaydin — fadlan isku day mar kale.",
  "ft.newsletterPh": "email@kaaga.com",
  "ft.subscribe": "Ku biir",
  "ft.subscribed": "Waad ku dhaaftay — soo dhawoow!",
  "wa.aria": "Nala soo sheekeyn WhatsApp",
  "wa.message": "Salaan Hayaan Market! Waa su'aal ku saabsan ",
  "quote.heading": "Dalabyo waaweyn & qiimayn",
  "quote.sub":
    "Miyaad iibsanaysaa xafiis, dugsi, hotel, masjid, dukaan ama urur? Noo sheeg waxa aad u baahan tahay — tirada iyo nooca — annagaana kuu soo dirno qiimayn gaar ah, badanaa ka fiican qiimaha la muujiyay.",
  "quote.benefit1": "Qiimo ka fiican kan la muujiyay, marka tirada badan tahay",
  "quote.benefit2": "Hal gaadhitaan, hal faturas — annaga ayaa shaqada u dhamaystirna",
  "quote.benefit3": "Jawaab maalinta shaqada ee soo socda, WhatsApp hore",
  "quote.name": "Magaca oo dhan",
  "quote.namePh": "tus: Axmed Cali",
  "quote.business": "Machad / urur (ikhtiyaari)",
  "quote.businessPh": "tus: Hotelka Iftiin",
  "quote.phone": "Taleefan / WhatsApp",
  "quote.phonePh": "+252 …",
  "quote.email": "Email (ikhtiyaari)",
  "quote.emailPh": "you@example.com",
  "quote.items": "Waxa aad u baahan tahay",
  "quote.itemsPh": "tus: 10 × iPhone 17, 5 × HP EliteBook 840, 20 shubmo…",
  "quote.itemsHint": "Sheeg alaabta iyo tirada — summadaha, noocyada, tirada.",
  "quote.cta": "Codso qiimayn",
  "quote.sending": "Dirista…",
  "quote.successTitle": "Codsiga waa la helay!",
  "quote.successBody":
    "Waxaan kula soo jawaabi doonaa maalinta shaqada ee soo socda — WhatsApp haddii number ka tagtay.",
  "quote.another": "Dir codsi kale",
  "quote.preferEmail": "Email miyaad doorbidaysaa? Nagala soo qor:",
  "deals.heading": "Ha lumaan qiimo jabinada elektiroonigga",
  "deals.sub":
    "Ku biir liiska qiimo jabinada Hayaan — qiimo dhimis, alaab cusub iyo dalabyo degdeg ah oo ku saabsan taleefoonada, laptoppyada, TV-yada iyo alaabta guriga waxay gaaraan liiskan hore. WhatsApp ama email ayaa laguu soo diraa — adigaa dooranaya.",
  "deals.benefit1": "Waxaad ogaanaysaa marka hore — liiskan ayaa la wado ka hor dadweynaha",
  "deals.benefit2": "Ogeysiisyo WhatsApp oo ku saabsan waxa aad runtii rabto",
  "deals.benefit3": "Ogeysiis marka alaabta si degdeg ah u dhammaato",
  "deals.name": "Magaca oo dhan (ikhtiyaari)",
  "deals.namePh": "tus: Axmed Cali",
  "deals.phone": "Taleefan / WhatsApp",
  "deals.phonePh": "+252 …",
  "deals.email": "Email (ikhtiyaari)",
  "deals.emailPh": "you@example.com",
  "deals.interest": "Waxa aad raadineysaa?",
  "deals.interestPh": "Dooro mid…",
  "deals.i1": "Taleefoono",
  "deals.i2": "Laptoppyada & kombuyuutarada",
  "deals.i3": "TV-yada & codheynta",
  "deals.i4": "Alaabta guriga",
  "deals.i5": "Alaabta dheeraadka ah",
  "deals.i6": "Wax kasta",
  "deals.cta": "Ku biir liiska",
  "deals.sending": "La socda…",
  "deals.successTitle": "Waad ku biirtay!",
  "deals.successBody": "La soco WhatsApp-kaaga — qiimo jabinada xiga ayaa kuugu horreysa.",
  "deals.privacy": "Maya spam — oo keliya qiimo jabin dhab ah, waqti kasta waad ka bixi kartaa.",
  "ft.dealAlerts": "Qiimo jabin",

  // Seed callout (fresh deployments only)
  "seed.demo": "Habka demo.",
  "seed.body":
    "Weli alaab ma jirto. Guji hoose si aad ku buuxiso alaab tusaale iyo isticmaale maamul ah.",
  "seed.now": "Buuxi hadda",
  "seed.dismiss": "Xir",
  "seed.fail": "Buuxintu way fashilantay — fiiri logs-ka.",

  // Misc
  "misc.tapLoading": "Suuqa ayaa la keenayo…",

  // Sifalo Pay return page (server-rendered guards)
  "sf.received": "Lacagta waa la helay — waad ku mahadsan tahay!",
  "sf.via": "via {type}",
  "sf.missingRefTitle": "Tixraaca bixinta waa maqan yahay",
  "sf.missingRefBody":
    "Ma garan karno dalabka ay bixintani ka tirsan tahay. Haddii aad bixisay, fiiri bogga Dalabyada — wuu cusboonaysanayaa marka bixinta la xaqiijiyo.",
  "sf.signinTitle": "Soo gal si aad u xaqiijiso bixintaada",
  "sf.signinBody":
    "Dalabka {ref} ma xaqiijin karno sababtoo ah waa la baxay. Soo gal akoonka aad ku bixisay, kaddibna fur Dalabyada — xaaladda bixinta way cusboonaysan doontaa.",
  "sf.notFoundTitle": "Dalab lama helin",
  "sf.notFoundBody": "Dalabkan ma jiro ama waa ka tirsan akoon kale.",
  "sf.cantCheckTitle": "Bixinta lama xaqiijin karo",
  "sf.pendingTitle": "Bixinta waa sugaysa ansixinta",
  "sf.pendingBody":
    "{msg} Dalabkaaga {ref} waa kaydsan yahay — waxaan xaqiijinaynaa marka shabakadu ay ansixiso. Si ammaan ayaad mar kale u xaqiijin kartaa.",
  "sf.failedTitle": "Bixinta lama dhammaystirin",
  "sf.failedBody":
    "{msg} Lacag lama jarin akoonkaaga. Dalabkaaga {ref} waa kaydsan — suuqa ayaad ka isku dayi kartaa.",
  "sf.unknownTitle": "Bixinta weli lama xaqiijin",
  "sf.unknownBody":
    "{msg} Haddii aad hadda bixisay, waqti yar ayay qaadan kartaa — mar kale isku day.",
  "sf.backRetry": "Ku noqo suuqa, isku day mar kale",
  "sf.checkNow": "Xaqiiji hadda",
  "sf.checkAgain": "Xaqiiji bixinta mar kale",
  "sf.checking": "Sifalo Pay ayaa la xaqiijinayo…",
  "sf.pendingNote": "Weli sugaya — shabakadu weli ma ansixisin.",
  "sf.notConfirmed": "Weli lama xaqiijin. Sug wax yar, isku day mar kale.",
};

export const dictionaries: Record<Lang, Record<DictKey, string>> = { en, so };

/** Translate `key` into `lang` with {var} interpolation. Never throws. */
export function translate(lang: Lang, key: DictKey, vars?: Vars): string {
  let s = dictionaries[lang]?.[key] ?? en[key] ?? String(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

// ---------------------------------------------------------------------------
// Category display names (slug-keyed; fallback = the DB name)

export const CATEGORY_SO: Record<string, string> = {
  "power-charging-audio": "Koronto & Shubista",
  "phones-wearables": "Teleefoonada & Saacadaha",
  "computers-tv-gaming": "Kombuyuutarada & TV-yada",
  "home-office": "Guryaha & Xafiisyada",
  electronics: "Elektirooniks",
  "home-living": "Guriga & Nolosha",
  apparel: "Dhar",
  beauty: "Quruxda",
};

export function categoryName(name: string, slug: string | undefined, lang: Lang): string {
  if (lang === "so" && slug && CATEGORY_SO[slug]) return CATEGORY_SO[slug];
  return name;
}

// ---------------------------------------------------------------------------
// Product descriptions — the 8 rotating templates written at import time,
// mirrored in Somali. Exact-string match with {n} = product name; anything
// else (owner-edited text) falls back to the stored English.

const EN_DESC_TEMPLATES: string[] = [
  "Keep your phones and gear powered through every outage. {n} is tested, genuine stock available now at Hayaan Market — order today for fast delivery across Somalia, paying by card or Sifalo.",
  "{n} — reliable everyday charging and audio gear from Hayaan Market. Ready to ship anywhere in Somalia with secure card or Sifalo payment.",
  "{n} — genuine device, ready for Somali networks. Buy now from Hayaan Market for fast nationwide delivery and secure card or Sifalo payment.",
  "Upgrade your everyday carry with the {n}. Available now at Hayaan Market — fast delivery across Somalia, pay by card or Sifalo.",
  "{n} — serious performance for work, study and play, from Hayaan Market. Order today for fast delivery across Somalia with card or Sifalo payment.",
  "Big-screen and big-power picks like the {n} move fast. Get yours now at Hayaan Market — nationwide delivery, card or Sifalo payment.",
  "{n} — dependable home and office essentials, stocked at Hayaan Market. Order today for fast delivery across Somalia, paying by card or Sifalo.",
  "Make daily life easier with the {n}. Available now at Hayaan Market — nationwide delivery with card or Sifalo payment.",
];

const SO_DESC_TEMPLATES: ((n: string) => string)[] = [
  (n) =>
    `Korontada la'aanta ha ku dhaawacmin teleefankaaga. ${n} waa alaab asal ah oo la tijaabiyay, hadda Hayaan Market ku diyaar ah — maanta dalbo, gaadhitaan degdeg ah oo Soomaaliya dhinac kasta ah, bixin kaarka ama Sifalo.`,
  (n) =>
    `${n} — agab shubo iyo cod oo maalinle ah oo ammaan ah, Hayaan Market. Diyaar ayay u tahay in Soomaaliya meel kasta laga soo diro, bixin kaarka ama Sifalo.`,
  (n) =>
    `${n} — alaabo asal ah, diyaar u ah shabakadaha Soomaaliya. Hadda iibso Hayaan Market: gaadhitaan degdeg ah oo dalka oo dhan, bixin kaarka ama Sifalo oo ammaan ah.`,
  (n) =>
    `Ku casree isticmaalkaaga maalinlaha ah ${n}. Hadda Hayaan Market ayaa laga helaa — gaadhitaan degdeg ah oo Soomaaliya dhan, bixi kaarka ama Sifalo.`,
  (n) =>
    `${n} — waxqabad xoog leh oo shaqo, barasho iyo madadaalo ah, Hayaan Market. Maanta dalbo: gaadhitaan degdeg ah oo Soomaaliya dhan, bixin kaarka ama Sifalo.`,
  (n) =>
    `Alaab shaashad weyn iyo xoog weyn leh sida ${n} si degdeg ayay u guraan. Hadda ka qaad Hayaan Market — gaadhitaan dalka oo dhan, bixin kaarka ama Sifalo.`,
  (n) =>
    `${n} — alaab muhiim ah oo guriga iyo xafiiska lagu kalsoon yahay, Hayaan Market. Maanta dalbo: gaadhitaan degdeg ah oo Soomaaliya dhan, bixin kaarka ama Sifalo.`,
  (n) =>
    `Nolosha maalinlaha kuu fududee ${n}. Hadda Hayaan Market ayaa laga helaa — gaadhitaan dalka oo dhan, bixin kaarka ama Sifalo.`,
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DESC_MATCHERS: { re: RegExp; so: (n: string) => string }[] = EN_DESC_TEMPLATES.map(
  (tpl, i) => ({
    re: new RegExp(`^${escapeRe(tpl).replace("\\{n\\}", "(.+?)")}$`),
    so: SO_DESC_TEMPLATES[i],
  }),
);

/** Somali display text for a product description (fallback: stored text). */
export function productDescription(desc: string, lang: Lang): string {
  if (lang !== "so") return desc;
  for (const { re, so } of DESC_MATCHERS) {
    const m = desc.match(re);
    if (m?.[1]) return so(m[1]);
  }
  return desc;
}
