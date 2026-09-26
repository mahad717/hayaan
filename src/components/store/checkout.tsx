"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, CreditCard, Download, Loader2, Lock, CheckCircle2, ShoppingBag, Leaf, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore, cartTotal, fetchCart, fetchSifaloStatus, startSifaloPayment } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";
import { MOGADISHU_DISTRICTS, findDistrict, computeShipping, computeCartShipping, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";

function formatPrice(price: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

// Sentinel for the district select: cities outside the priced Mogadishu list.
const OTHER_CITY = "__other";

export function Checkout() {
  const { cart, setCart, setView, toast, user, setAuthOpen, bootReady } = useStore();
  const { t } = useLang();
  // Prefill from the saved profile (account view) so returning customers
  // don't retype their address.
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    city: user?.city ?? "",
    zip: user?.zip ?? "",
    country: user?.country || "Somalia",
  });
  // Sifalo Pay is the only payment method — the demo card/PayPal/COD options
  // were removed so customers can never place an order we can't collect on.
  const [paymentMethod, setPaymentMethod] = useState<"sifalo">("sifalo");
  const [sifaloEnabled, setSifaloEnabled] = useState<boolean | null>(null); // null = probing
  const [placing, setPlacing] = useState(false);
  // Set to the Sifalo redirect URL once the order + payment session exist.
  // While set, the whole viewport is replaced by a "Redirecting…" screen —
  // window.location.assign is async, so the browser can sit on this page for
  // a few seconds while Sifalo loads and ANY state change in that window
  // (like clearing the cart) would visibly repaint here first.
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [done, setDone] = useState<{ orderId: string; total: number } | null>(null);
  // District picker: a canonical district name, OTHER_CITY, or "" (nothing
  // picked yet). form.city holds the free-text city for the OTHER_CITY path;
  // the submitted city is the canonical district name (or the typed city).
  const [districtChoice, setDistrictChoice] = useState<string>(() => {
    const matched = findDistrict(user?.city);
    return matched ? matched.name : user?.city ? OTHER_CITY : "";
  });

  // Probe whether this deployment has merchant credentials. While unknown the
  // pay button stays disabled; when false we show an "unavailable" notice.
  useEffect(() => {
    let cancelled = false;
    fetchSifaloStatus().then((s) => {
      if (cancelled) return;
      setSifaloEnabled(s.enabled);
    }).catch(() => !cancelled && setSifaloEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefill once the session bootstrap delivers the user — on deep links like
  // /?view=checkout this component mounts before /api/auth/me resolves, so the
  // useState initializer above saw user === null. Fill only still-empty
  // fields so anything the customer already typed is never clobbered.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      name: f.name || user.name || "",
      phone: f.phone || user.phone || "",
      address: f.address || user.address || "",
      city: f.city || user.city || "",
      zip: f.zip || user.zip || "",
      country: f.country || user.country || "Somalia",
    }));
    // Map the saved city onto the district picker: a priced district selects
    // itself; anything else ("Mogadishu", "Kismayo", …) falls back to the
    // Other-city path so the customer can still pick their exact district.
    setDistrictChoice((choice) => {
      if (choice) return choice;
      const matched = findDistrict(user.city);
      return matched ? matched.name : user.city ? OTHER_CITY : "";
    });
  }, [user]);

  const savedAddress = !!(user?.address && user?.city);

  const subtotal = cartTotal(cart);
  // Digital delivery (Task 82): a cart with ONLY digital products needs no
  // address, no district, and no delivery fee — files unlock in Orders the
  // moment payment is confirmed.
  const digitalOnly = cart.items.length > 0 && cart.items.every((it) => it.product.productType === "digital");
  // District-based delivery: priced Mogadishu district → its fee; typed other
  // city → flat outside fee; free over the threshold. While nothing is picked
  // the summary shows a hint instead of a number (and Pay stays disabled).
  const districtMatch = districtChoice && districtChoice !== OTHER_CITY ? findDistrict(districtChoice) : null;
  const otherCityKnown = districtChoice === OTHER_CITY && form.city.trim().length > 0;
  // Mixed carts are charged on the PHYSICAL subtotal only (computeCartShipping),
  // matching the Sifalo order creator exactly.
  const shippingKnown = digitalOnly || subtotal >= FREE_SHIPPING_THRESHOLD || !!districtMatch || otherCityKnown;
  const shipping = digitalOnly ? 0 : computeCartShipping(cart.items, districtMatch?.name ?? (otherCityKnown ? form.city : ""));
  // No tax/VAT: the total is exactly what the customer pays — subtotal + delivery.
  const total = subtotal + (shippingKnown ? shipping : 0);

  const onDistrictChange = (value: string) => {
    setDistrictChoice(value);
    if (value === OTHER_CITY) {
      // Keep any typed non-district city; clear a matched district name so the
      // text field starts empty instead of showing a canonical district name.
      setForm((f) => (findDistrict(f.city) ? { ...f, city: "" } : f));
    } else {
      setForm((f) => ({ ...f, city: value }));
    }
  };

  // Full-screen hand-off view: once we have a payment session we replace the
  // entire page so nothing (not even the cart badge clearing) can flash
  // before the browser navigates to Sifalo's hosted checkout.
  if (redirectingTo) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#faf8f1] px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef5ec]">
          <Wallet className="h-10 w-10 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-brand-dark sm:text-2xl">{t("co.redirectTitle")}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("co.redirectBody")}
          </p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        {stuck && (
          <Button
            variant="outline"
            className="border-brand text-brand hover:bg-brand hover:text-white"
            onClick={() => window.location.assign(redirectingTo)}
          >
            {t("co.stuck")}
          </Button>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef5ec]">
          <CheckCircle2 className="h-12 w-12 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark sm:text-3xl">
            {t("co.thanks")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("co.orderRef")}{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-brand">{done.orderId.slice(0, 8).toUpperCase()}</code>
          </p>
        </div>
        <Card className="w-full max-w-md border-[#e6e2d4]">
          <CardHeader>
            <CardTitle className="text-base text-brand-dark">{t("co.summary")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("co.totalPaid")}</span>
              <span className="font-medium text-brand">{formatPrice(done.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("co.payMethod")}</span>
              <span className="text-foreground">EVC Plus · Edahab · Card</span>
            </div>
            <Separator className="my-2" />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Leaf className="h-3 w-3 text-brand" />
              {t("co.emailNote")}
            </p>
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" className="border-brand text-brand hover:bg-brand hover:text-white" onClick={() => setView("orders")}>
            {t("co.viewOrders")}
          </Button>
          <Button className="bg-brand hover:bg-brand-dark" onClick={() => setView("home")}>
            {t("co.continueShopping")}
          </Button>
        </div>
      </div>
    );
  }

  // Session bootstrap still in flight (deep links land here before
  // /api/auth/me resolves). Show a neutral loading state instead of the
  // sign-in wall — otherwise signed-in customers see a "Please sign in"
  // flash during the Buy-now redirect.
  if (!bootReady && !user) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("co.preparing")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-brand-dark">{t("co.signinTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("co.signinBody")}
        </p>
        <Button className="btn-accent mt-4" onClick={() => setAuthOpen(true)}>{t("header.signIn")}</Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-brand-dark">{t("co.emptyTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("co.emptyBody")}</p>
        <Button className="bg-brand hover:bg-brand-dark" onClick={() => setView("home")}>{t("co.browse")}</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!digitalOnly && (!districtChoice || (districtChoice === OTHER_CITY && !form.city.trim()))) {
      toast(t("co.pickDistrictToast"), "error");
      return;
    }
    setPlacing(true);
    try {
      // Real money: create a pending order, then hand off to Sifalo Pay's
      // hosted checkout. The order status flips to paid on the return page
      // after server-side verification. Digital-only carts record delivery
      // placeholders — nothing physical ships.
      const finalCity = digitalOnly
        ? form.city.trim() || "Digital"
        : districtChoice === OTHER_CITY
          ? form.city.trim()
          : districtChoice;
      const payment = await startSifaloPayment({
        ...form,
        city: finalCity,
        ...(digitalOnly
          ? {
              address: form.address.trim() || "Digital delivery — no shipping",
              zip: form.zip.trim() || "0000",
              country: form.country.trim() || "Somalia",
            }
          : {}),
      });
      // Swap to the full-screen redirect view BEFORE navigating, and do NOT
      // touch the client cart here — the server already emptied it when the
      // order was created, and clearing it now would repaint the empty-cart
      // screen during the seconds the browser takes to reach Sifalo. The
      // badge resyncs from the server on the return page / next fetch.
      setRedirectingTo(payment.redirectUrl);
      window.location.assign(payment.redirectUrl);
      // Safety net: if navigation is blocked (rare), give the customer a
      // manual retry link instead of an infinite spinner.
      window.setTimeout(() => setStuck(true), 8000);
      toast(t("co.redirectTitle"), "success");
    } catch (err) {
      const msg = (err as Error).message;
      toast(msg, "error");
      // A failed gateway handshake can still consume the server cart (the
      // pending order is kept for later verification). If the customer retries
      // with a stale client cart they'd hit a confusing "Cart is empty" 400 —
      // re-sync from the server so the badge/checkout reflect reality.
      if (/cart is empty|couldn't find your cart|cart not found/i.test(msg)) {
        try {
          setCart(await fetchCart());
        } catch {
          setCart({ id: "", items: [] });
        }
      }
      setPlacing(false);
    }
    // No reset on success: `placing` stays true so the button keeps showing
    // "Redirecting to Sifalo Pay…" until the browser navigates away.
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 text-brand hover:bg-secondary" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> {t("co.continueShopping")}
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">{t("co.checkoutTitle")}</h1>

      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left column: forms */}
        <div className="flex flex-col gap-6">
          {/* Digital-only carts: no delivery form — show what happens instead. */}
          {digitalOnly ? (
            <Card className="border-brand/30 bg-[#eef5ec]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
                  <Download className="h-4 w-4 text-brand" /> {t("co.digitalTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-brand-dark">{t("co.digitalBody")}</p>
                <p className="mt-3 text-xs text-muted-foreground">{t("co.digitalNameNote")}</p>
              </CardContent>
            </Card>
          ) : (
          <Card className="border-[#e6e2d4]">
            <CardHeader>
              <CardTitle className="text-base text-brand-dark">{t("co.address")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {savedAddress && (
                <p className="rounded-md bg-[#eef5ec] px-3 py-2 text-xs text-brand">
                  {t("co.prefilled")}
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">{t("co.fullName")}</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                  className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-foreground">{t("co.phone")} <span className="text-xs font-normal text-muted-foreground">{t("co.optional")}</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                  placeholder="+252 61 234 5678"
                  className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address" className="text-foreground">{t("co.street")}</Label>
                <Input
                  id="address"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  autoComplete="street-address"
                  placeholder="123 Garden St"
                  className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="district" className="text-foreground">{t("co.district")}</Label>
                <Select value={districtChoice || undefined} onValueChange={onDistrictChange}>
                  <SelectTrigger
                    id="district"
                    className="w-full bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                  >
                    <SelectValue placeholder={t("co.districtPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {MOGADISHU_DISTRICTS.map((d) => (
                      <SelectItem key={d.name} value={d.name}>
                        {d.name} — ${d.fee.toFixed(2)}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_CITY}>{t("co.districtOther")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("co.districtHint")}</p>
              </div>
              {districtChoice === OTHER_CITY && (
                <div className="grid gap-2">
                  <Label htmlFor="city" className="text-foreground">{t("co.city")}</Label>
                  <Input
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    autoComplete="address-level2"
                    placeholder="Mogadishu"
                    className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="zip" className="text-foreground">{t("co.zip")}</Label>
                  <Input
                    id="zip"
                    required
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    autoComplete="postal-code"
                    className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country" className="text-foreground">{t("co.country")}</Label>
                <Input
                  id="country"
                  required
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  autoComplete="country-name"
                  className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                />
              </div>
            </CardContent>
          </Card>
          )}

          {/* Payment */}
          <Card className="border-[#e6e2d4]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
                <CreditCard className="h-4 w-4 text-brand" /> {t("co.payMethod")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                {sifaloEnabled !== false && (
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      paymentMethod === "sifalo"
                        ? "border-brand bg-[#eef5ec]"
                        : "border-[#e6e2d4] bg-[#faf8f1] hover:bg-secondary"
                    }`}
                  >
                    <RadioGroupItem value="sifalo" className="text-brand" />
                    <div className="flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Wallet className="h-4 w-4 text-brand" /> EVC Plus · Edahab · Card
                        <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">{t("co.recommended")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("co.sifaloDesc")}
                      </p>
                    </div>
                  </label>
                )}
              </RadioGroup>

              {sifaloEnabled !== false ? (
                <div className="mt-2 grid gap-2 rounded-lg border border-brand/30 bg-[#eef5ec] p-4">
                  <p className="text-xs leading-relaxed text-brand-dark">
                    {t("co.how")}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> {t("co.processedBy")}
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-[#e6e2d4] bg-[#faf8f1] p-4 text-xs text-muted-foreground">
                  {t("co.unavailable")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-[#e6e2d4]">
            <CardHeader>
              <CardTitle className="text-base text-brand-dark">{t("co.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-3">
                {cart.items.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-[#faf8f1]">
                      {it.product.images[0] && (
                        <img
                          src={it.product.images[0]}
                          alt={it.product.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs text-white ring-2 ring-white">
                        {it.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">{it.product.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {formatPrice(it.product.price, it.product.currency)}
                        {it.product.productType === "digital" && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#eef5ec] px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                            <Download className="h-2.5 w-2.5" /> {t("co.digitalChip")}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-brand">
                      {formatPrice(it.product.price * it.quantity, it.product.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Separator />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                  <span className="text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("cart.shipping")}</span>
                  {digitalOnly ? (
                    <span className="font-medium text-[#3f7d4a]">{t("co.noShipping")}</span>
                  ) : !shippingKnown ? (
                    <span className="text-xs text-muted-foreground">{t("co.pickDistrict")}</span>
                  ) : (
                    <span className={shipping === 0 ? "font-medium text-[#3f7d4a]" : "text-foreground"}>
                      {shipping === 0 ? t("cart.free") : formatPrice(shipping)}
                    </span>
                  )}
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-foreground">{t("cart.total")}</span>
                  <span className="text-brand">{formatPrice(total)}</span>
                </div>
              </div>
              {/* Pay button — Market Orange (the 10% accent) */}
              <Button type="submit" size="lg" className="btn-accent" disabled={placing || sifaloEnabled !== true || !shippingKnown}>
                {placing ? t("co.redirectTitle") : t("co.payButton", { amount: formatPrice(total) })}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> {t("co.secureNote")}
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
