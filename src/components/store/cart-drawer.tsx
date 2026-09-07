"use client";

import { Trash2, ShoppingBag, Minus, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore, cartTotal, addToCart, removeFromCart } from "@/hooks/use-store";

function formatPrice(price: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `$${price.toFixed(2)}`;
  }
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, setCart, setView, toast, user, setAuthOpen } = useStore();

  const updateQty = async (itemId: string, productId: string, qty: number, action: "increment" | "decrement") => {
    try {
      const updated = await addToCart(productId, 1, action);
      setCart(updated);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const remove = async (itemId: string) => {
    try {
      const updated = await removeFromCart(itemId);
      setCart(updated);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const subtotal = cartTotal(cart);
  const shipping = subtotal >= 75 ? 0 : 6.95;
  const total = subtotal + shipping;

  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex w-full flex-col bg-white sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-brand-dark">
            <ShoppingBag className="h-5 w-5 text-brand" /> Your cart
          </SheetTitle>
          <SheetDescription>
            {cart.items.length === 0
              ? "Browse the catalog and add items to start your order."
              : `${cart.items.length} item${cart.items.length === 1 ? "" : "s"} ready for checkout.`}
          </SheetDescription>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <ShoppingBag className="h-8 w-8 text-brand" />
            </div>
            <p className="text-sm text-muted-foreground">Nothing here yet — find something you&apos;ll love.</p>
            <Button
              className="bg-brand hover:bg-brand-dark"
              onClick={() => {
                setCartOpen(false);
                setView("home");
              }}
            >
              Start shopping
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <ul className="flex flex-col gap-4 py-2">
              {cart.items.map((it) => (
                <li key={it.id} className="flex gap-3">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[#faf8f1]">
                    {it.product.images[0] ? (
                      <img
                        src={it.product.images[0]}
                        alt={it.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Skeleton className="h-full w-full" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
                        {it.product.name}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(it.id)}
                        aria-label={`Remove ${it.product.name} from cart`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(it.product.price, it.product.currency)}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-md border border-[#e6e2d4]">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-brand"
                          onClick={() => updateQty(it.id, it.productId, it.quantity, "decrement")}
                          aria-label="Decrease quantity"
                          disabled={it.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center text-xs font-medium">{it.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-brand"
                          onClick={() => updateQty(it.id, it.productId, it.quantity, "increment")}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold text-brand">
                        {formatPrice(it.product.price * it.quantity, it.product.currency)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cart.items.length > 0 && (
          <SheetFooter className="border-t border-[#e6e2d4] pt-4">
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
              <Separator className="my-1" />
              <div className="flex justify-between text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-brand">{formatPrice(total)}</span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted-foreground">
                  You&apos;re {formatPrice(75 - subtotal)} away from free shipping.
                </p>
              )}
            </div>
            {/* Checkout — Market Orange (the 10% accent) */}
            <Button
              size="lg"
              className="btn-accent mt-2"
              onClick={() => {
                setCartOpen(false);
                if (!user) {
                  setAuthOpen(true);
                } else {
                  setView("checkout");
                }
              }}
            >
              {user ? "Proceed to checkout" : "Sign in to check out"}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
