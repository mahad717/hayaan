"use client";

import { useState } from "react";
import { ChevronLeft, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import type { SafeUser } from "@/lib/types";

// Field styling for the profile forms — mirrors the admin product form:
// visible brand-green border at rest, darker on hover, solid brand + halo on focus.
const FIELD_CLS =
  "border-brand/50 bg-[#faf8f1] hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25";

interface ProfileForm {
  name: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

function toForm(u: SafeUser): ProfileForm {
  return {
    name: u.name ?? "",
    phone: u.phone ?? "",
    address: u.address ?? "",
    city: u.city ?? "",
    zip: u.zip ?? "",
    country: u.country ?? "",
  };
}

const EMPTY: ProfileForm = { name: "", phone: "", address: "", city: "", zip: "", country: "" };

const Opt = () => (
  <span className="text-xs font-normal text-muted-foreground"> (optional)</span>
);

/**
 * Customer profile — contact details + saved shipping address, editable.
 * Saved via PUT /api/account; the store's `user` is updated in place so the
 * header and checkout prefill pick up the new values immediately.
 */
export function AccountView() {
  const { user, setUser, setView, setAuthOpen, toast } = useStore();
  const [form, setForm] = useState<ProfileForm>(user ? toForm(user) : EMPTY);
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <UserRound className="mx-auto h-12 w-12 text-brand" />
        <h1 className="mt-4 text-2xl font-semibold text-brand-dark">Sign in to view your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your contact details and saved shipping address live in your account.
        </p>
        <Button className="btn-accent mt-4" onClick={() => setAuthOpen(true)}>Sign in</Button>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast("Name cannot be empty.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not save your profile.", "error");
        return;
      }
      setUser(data.user);
      toast("Profile saved", "success");
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 text-brand hover:bg-secondary" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Button>

      {/* Identity card */}
      <Card className="border-[#e6e2d4]">
        <CardContent className="flex flex-wrap items-center gap-4 py-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-brand-dark">{user.name}</h1>
              {user.role === "admin" && (
                <Badge className="bg-brand/10 text-brand">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                </Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
            {(user.phone || user.address) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {[user.address, user.city, user.zip, user.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={save} className="mt-6 grid gap-6">
        {/* Contact details */}
        <Card className="border-[#e6e2d4]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
              <UserRound className="h-4 w-4 text-brand" /> Contact details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="acc-name" className="whitespace-nowrap">Full name</Label>
              <Input
                id="acc-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                placeholder="e.g. Hodan Ahmed"
                className={FIELD_CLS}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-phone" className="whitespace-nowrap">Phone <Opt /></Label>
              <Input
                id="acc-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                autoComplete="tel"
                placeholder="+252 61 234 5678"
                className={FIELD_CLS}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="acc-email">Email</Label>
              <Input
                id="acc-email"
                type="email"
                value={user.email}
                disabled
                autoComplete="email"
                className="cursor-not-allowed bg-muted/50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">Your sign-in email can&apos;t be changed here.</p>
            </div>
          </CardContent>
        </Card>

        {/* Saved shipping address */}
        <Card className="border-[#e6e2d4]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
              <MapPin className="h-4 w-4 text-brand" /> Shipping address
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Saved for faster checkout — we&apos;ll prefill this at checkout.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-address">Street address</Label>
              <Input
                id="acc-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                autoComplete="street-address"
                placeholder="Villa 12, Maka Al Mukarama Road"
                className={FIELD_CLS}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="acc-city" className="whitespace-nowrap">City</Label>
                <Input
                  id="acc-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  autoComplete="address-level2"
                  placeholder="Mogadishu"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="acc-zip" className="whitespace-nowrap">ZIP / Postal code <Opt /></Label>
                <Input
                  id="acc-zip"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  autoComplete="postal-code"
                  placeholder="SH01"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="acc-country" className="whitespace-nowrap">Country</Label>
                <Input
                  id="acc-country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  autoComplete="country-name"
                  placeholder="Somalia"
                  className={FIELD_CLS}
                />
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> The courier may use your phone number to arrange delivery.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => setForm(toForm(user))} disabled={saving}>
            Reset
          </Button>
          <Button type="submit" className="btn-accent" disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
