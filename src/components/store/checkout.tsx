"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, CreditCard, Loader2, Lock, CheckCircle2, ShoppingBag, Leaf, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore, cartTotal, fetchCart, fetchSifaloStatus, startSifaloPayment } from "@/hooks/use-store";

function formatPrice(price: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function Checkout() {
  const { cart, setCart, setView, toast, user, setAuthOpen } = useStore();
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

  const savedAddress = !!(user?.address && user?.city);

  const subtotal = cartTotal(cart);
  const shipping = subtotal >= 75 ? 0 : 6.95;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

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
          <h1 className="text-xl font-semibold text-brand-dark sm:text-2xl">Redirecting to Sifalo Pay…</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Taking you to the secure checkout to approve your payment. Please don&apos;t close or refresh this page.
          </p>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        {stuck && (
          <Button
            variant="outline"
            className="border-brand text-brand hover:bg-brand hover:text-white"
            onClick={() => window.location.assign(redirectingTo)}
          >
            Nothing happening? Click to continue
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
            Thank you for your order!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Order reference{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-brand">{done.orderId.slice(0, 8).toUpperCase()}</code>
          </p>
        </div>
        <Card className="w-full max-w-md border-[#e6e2d4]">
          <CardHeader>
            <CardTitle className="text-base text-brand-dark">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-medium text-brand">{formatPrice(done.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment method</span>
              <span className="text-foreground">Sifalo Pay</span>
            </div>
            <Separator className="my-2" />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Leaf className="h-3 w-3 text-brand" />
              A confirmation email is on its way. You can track your order in the Orders tab.
            </p>
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" className="border-brand text-brand hover:bg-brand hover:text-white" onClick={() => setView("orders")}>
            View my orders
          </Button>
          <Button className="bg-brand hover:bg-brand-dark" onClick={() => setView("home")}>
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Please sign in to check out</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We need your account so we can attach the order to you.
        </p>
        <Button className="btn-accent mt-4" onClick={() => setAuthOpen(true)}>Sign in</Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-brand-dark">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground">Add some items before checking out.</p>
        <Button className="bg-brand hover:bg-brand-dark" onClick={() => setView("home")}>Browse products</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    try {
      // Real money: create a pending order, then hand off to Sifalo Pay's
      // hosted checkout. The order status flips to paid on the return page
      // after server-side verification.
      const payment = await startSifaloPayment(form);
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
      toast("Redirecting to Sifalo Pay…", "success");
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
        <ChevronLeft className="mr-1 h-4 w-4" /> Continue shopping
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight text-brand-dark sm:text-3xl">Checkout</h1>

      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left column: forms */}
        <div className="flex flex-col gap-6">
          {/* Shipping */}
          <Card className="border-[#e6e2d4]">
            <CardHeader>
              <CardTitle className="text-base text-brand-dark">Shipping address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {savedAddress && (
                <p className="rounded-md bg-[#eef5ec] px-3 py-2 text-xs text-brand">
                  Prefilled from your saved address — edit below if you need changes. Manage it from <strong>My profile</strong>.
                </p>
              )}
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-foreground">Full name</Label>
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
                <Label htmlFor="phone" className="text-foreground">Phone <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
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
                <Label htmlFor="address" className="text-foreground">Street address</Label>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="city" className="text-foreground">City</Label>
                  <Input
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    autoComplete="address-level2"
                    className="bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zip" className="text-foreground">ZIP / Postal code</Label>
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
                <Label htmlFor="country" className="text-foreground">Country</Label>
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

          {/* Payment */}
          <Card className="border-[#e6e2d4]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
                <CreditCard className="h-4 w-4 text-brand" /> Payment method
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
                        <Wallet className="h-4 w-4 text-brand" /> Sifalo Pay
                        <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">Recommended</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cards, EVC Plus, eDahab, Sahal &amp; 20+ more — you&apos;ll be redirected to a secure page to pay.
                      </p>
                    </div>
                  </label>
                )}
              </RadioGroup>

              {sifaloEnabled !== false ? (
                <div className="mt-2 grid gap-2 rounded-lg border border-brand/30 bg-[#eef5ec] p-4">
                  <p className="text-xs leading-relaxed text-brand-dark">
                    <strong>How it works:</strong> you&apos;ll be redirected to Sifalo Pay&apos;s secure checkout to choose your
                    payment method and approve the payment. You&apos;ll come right back here and your order will be
                    confirmed automatically.
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> Processed by Sifalo Pay — your payment details never touch our servers.
                  </p>
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-[#e6e2d4] bg-[#faf8f1] p-4 text-xs text-muted-foreground">
                  Online payment is temporarily unavailable — please check back soon.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="border-[#e6e2d4]">
            <CardHeader>
              <CardTitle className="text-base text-brand-dark">Order summary</CardTitle>
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPrice(it.product.price, it.product.currency)}
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
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className={shipping === 0 ? "font-medium text-[#3f7d4a]" : "text-foreground"}>
                    {shipping === 0 ? "Free" : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span className="text-foreground">{formatPrice(tax)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-brand">{formatPrice(total)}</span>
                </div>
              </div>
              {/* Pay button — Market Orange (the 10% accent) */}
              <Button type="submit" size="lg" className="btn-accent" disabled={placing || sifaloEnabled !== true}>
                {placing ? "Redirecting to Sifalo Pay…" : `Pay ${formatPrice(total)} with Sifalo Pay`}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Secure checkout · Powered by Sifalo Pay
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
