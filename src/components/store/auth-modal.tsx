"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/hooks/use-store";

const INPUT_CLASS = "bg-[#faf8f1] border-[#e6e2d4] focus-visible:ring-[#f28c28]";

export function AuthModal() {
  const { authOpen, setAuthOpen, setUser, setCart, toast } = useStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail("");
    setName("");
    setPassword("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login" ? { email, password } : { email, name, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Authentication failed", "error");
        return;
      }
      setUser(data.user);
      toast(`Welcome, ${data.user.name.split(" ")[0]}!`, "success");
      const cartRes = await fetch("/api/cart", { credentials: "include" });
      if (cartRes.ok) {
        const cartData = await cartRes.json();
        setCart(cartData.cart);
      }
      reset();
      setAuthOpen(false);
    } catch (err) {
      toast("Network error. Try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={authOpen} onOpenChange={setAuthOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-semibold text-brand-dark">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === "login"
              ? "Sign in to sync your cart and check out faster."
              : "Create a free account to start shopping. No credit card required."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email-login" className="text-foreground">Email</Label>
                <Input
                  id="email-login"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pwd-login" className="text-foreground">Password</Label>
                <Input
                  id="pwd-login"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={INPUT_CLASS}
                />
              </div>
              <Button type="submit" disabled={loading} className="btn-accent mt-2">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name-signup" className="text-foreground">Name</Label>
                <Input
                  id="name-signup"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email-signup" className="text-foreground">Email</Label>
                <Input
                  id="email-signup"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pwd-signup" className="text-foreground">Password</Label>
                <Input
                  id="pwd-signup"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className={INPUT_CLASS}
                />
                <p className="text-xs text-muted-foreground">At least 6 characters.</p>
              </div>
              <Button type="submit" disabled={loading} className="btn-accent mt-2">
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-2 rounded-md bg-secondary p-3 text-xs text-muted-foreground">
          <p className="font-medium text-brand">Demo admin</p>
          <p>Email: <code className="text-foreground">admin@shop.demo</code></p>
          <p>Password: <code className="text-foreground">admin123</code></p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
