"use client";

import { useState } from "react";
import { ChevronLeft, CreditCard, Lock, CheckCircle2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore, cartTotal, placeOrder } from "@/hooks/use-store";

function formatPrice(price: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function Checkout() {
  const { cart, setCart, setView, toast, user, setAuthOpen } = useStore();
  const [form, setForm] = useState({
    name: user?.name ?? "",
    address: "",
    city: "",
    zip: "",
    country: "United States",
  });
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "cod">("card");
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState<{ orderId: string; total: number } | null>(null);

  const subtotal = cartTotal(cart);
  const shipping = subtotal >= 75 ? 0 : 6.95;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  if (done) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Thank you for your order!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Order reference <code className="rounded bg-muted px-1.5 py-0.5">{done.orderId}</code>
          </p>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-medium">{formatPrice(done.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment method</span>
              <span className="capitalize">{paymentMethod}</span>
            </div>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              A confirmation email is on its way. You can track your order in the Orders tab.
            </p>
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setView("orders")}>View my orders</Button>
          <Button onClick={() => setView("home")}>Continue shopping</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Please sign in to check out</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We need your account so we can attach the order to you.
        </p>
        <Button className="mt-4" onClick={() => setAuthOpen(true)}>Sign in</Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <p className="text-sm text-muted-foreground">Add some items before checking out.</p>
        <Button variant="secondary" onClick={() => setView("home")}>Browse products</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacing(true);
    try {
      const result = await placeOrder(form, paymentMethod);
      setCart({ id: "", items: [] });
      setDone(result);
      toast("Order placed successfully!", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Continue shopping
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>

      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left column: forms */}
        <div className="flex flex-col gap-6">
          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Street address</Label>
                <Input
                  id="address"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  autoComplete="street-address"
                  placeholder="123 Garden St"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    autoComplete="address-level2"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zip">ZIP / Postal code</Label>
                  <Input
                    id="zip"
                    required
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    autoComplete="postal-code"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  required
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  autoComplete="country-name"
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Payment method
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                  <RadioGroupItem value="card" />
                  <div>
                    <p className="text-sm font-medium">Credit / debit card</p>
                    <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex — processed securely.</p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                  <RadioGroupItem value="paypal" />
                  <div>
                    <p className="text-sm font-medium">PayPal</p>
                    <p className="text-xs text-muted-foreground">Redirect to PayPal to complete your payment.</p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                  <RadioGroupItem value="cod" />
                  <div>
                    <p className="text-sm font-medium">Cash on delivery</p>
                    <p className="text-xs text-muted-foreground">Pay when your order arrives.</p>
                  </div>
                </label>
              </RadioGroup>

              {paymentMethod === "card" && (
                <div className="mt-2 grid gap-3 rounded-lg border bg-muted/20 p-4">
                  <div className="grid gap-2">
                    <Label htmlFor="card-num">Card number</Label>
                    <Input id="card-num" placeholder="4242 4242 4242 4242" inputMode="numeric" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="card-exp">Expiry</Label>
                      <Input id="card-exp" placeholder="MM/YY" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="card-cvc">CVC</Label>
                      <Input id="card-cvc" placeholder="123" inputMode="numeric" />
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> This is a demo — no real card is charged.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-3">
                {cart.items.map((it) => (
                  <li key={it.id} className="flex gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      {it.product.images[0] && (
                        <img
                          src={it.product.images[0]}
                          alt={it.product.name}
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                        {it.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="line-clamp-2 text-xs font-medium leading-tight">{it.product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPrice(it.product.price, it.product.currency)}
                      </p>
                    </div>
                    <span className="text-xs font-medium">
                      {formatPrice(it.product.price * it.quantity, it.product.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Separator />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span>{formatPrice(tax)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
              <Button type="submit" size="lg" disabled={placing}>
                {placing ? "Placing order…" : `Pay ${formatPrice(total)}`}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Secure checkout · 256-bit TLS
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
