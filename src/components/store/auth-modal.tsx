"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";
import { createOAuthBrowserClient } from "@/lib/supabase/client";

const INPUT_CLASS =
  "bg-[#faf8f1] border-brand/40 hover:border-brand/60 focus-visible:border-brand focus-visible:ring-brand/20";

export function AuthModal() {
  const { authOpen, setAuthOpen, setUser, setCart, toast, products } = useStore();
  const { t } = useLang();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
        toast(data.error ?? t("au.toastFailed"), "error");
        return;
      }
      setUser(data.user);
      toast(t("au.toastWelcome", { name: data.user.name.split(" ")[0] }), "success");
      const cartRes = await fetch("/api/cart", { credentials: "include" });
      if (cartRes.ok) {
        const cartData = await cartRes.json();
        setCart(cartData.cart);
      }
      reset();
      setAuthOpen(false);
    } catch (err) {
      toast(t("au.toastNetwork"), "error");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth — starts the Supabase PKCE flow. On success the browser
  // navigates away to Google, then Supabase bounces back to /auth/callback,
  // which sets the same shop_session cookie email/password login uses.
  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const supabase = createOAuthBrowserClient();
      if (!supabase) {
        toast(t("au.toastGoogleOff"), "error");
        setGoogleLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        toast(error.message, "error");
        setGoogleLoading(false);
      }
      // Success: keep the spinner — the page is about to navigate away.
    } catch {
      toast(t("au.toastGoogleFail"), "error");
      setGoogleLoading(false);
    }
  };

  return (
    <Dialog open={authOpen} onOpenChange={setAuthOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-semibold text-brand-dark">
            {mode === "login" ? t("au.welcomeBack") : t("au.createTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === "login" ? t("au.loginDesc") : t("au.signupDesc")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t("au.tabSignin")}</TabsTrigger>
            <TabsTrigger value="signup">{t("au.tabCreate")}</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email-login" className="text-foreground">{t("au.email")}</Label>
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
                <Label htmlFor="pwd-login" className="text-foreground">{t("au.password")}</Label>
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
                {loading ? t("au.signingIn") : t("au.tabSignin")}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name-signup" className="text-foreground">{t("au.name")}</Label>
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
                <Label htmlFor="email-signup" className="text-foreground">{t("au.email")}</Label>
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
                <Label htmlFor="pwd-signup" className="text-foreground">{t("au.password")}</Label>
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
                <p className="text-xs text-muted-foreground">{t("au.minChars")}</p>
              </div>
              <Button type="submit" disabled={loading} className="btn-accent mt-2">
                {loading ? t("au.creating") : t("au.tabCreate")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t("au.or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={googleLoading}
          onClick={signInWithGoogle}
          className="w-full border-brand/40 hover:bg-secondary hover:text-brand-dark"
        >
          {googleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
            </svg>
          )}
          {t("au.continueGoogle")}
        </Button>

        {products.length === 0 && (
          <div className="mt-2 rounded-md bg-[#fef1de] p-3 text-xs text-[#7a4a14]">
            <p className="font-medium">{t("au.setupTitle")}</p>
            <p>
              {t("au.setupBody")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
