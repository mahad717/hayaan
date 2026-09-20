"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, KeyRound, Mail, MapPin, Phone, Save, ShieldCheck, UserRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/hooks/use-store";
import { useLang } from "@/components/store/language-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOGADISHU_DISTRICTS, findDistrict } from "@/lib/shipping";
import { SOMALIA_CITIES, isSomaliaCity } from "@/lib/somalia";
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

// Sentinels for the two pickers (Task 71): the CITY select covers Somalia's
// major cities plus a not-listed escape; the DISTRICT select (Mogadishu only)
// keeps an "other area" escape so unlisted Mogadishu neighborhoods still
// check out at the outside-Mogadishu flat fee. Storage is unchanged: the
// saved `city` holds a canonical district name (Mogadishu -> priced district
// fee), a canonical city name, or free text (outside-Mogadishu flat fee).
const MOGADISHU_CITY = "Mogadishu";
const OTHER_CITY = "__other";
const OTHER_AREA = "__other_area";

/** Map a saved city onto the city + district pickers: a priced district
 * selects Mogadishu + that district; a known big city selects itself; any
 * other non-empty city takes the not-listed path; empty = no selection. */
function savedAddressPickers(city: string | null | undefined): { cityChoice: string; districtChoice: string } {
  if (!city) return { cityChoice: "", districtChoice: "" };
  const matched = findDistrict(city);
  if (matched) return { cityChoice: MOGADISHU_CITY, districtChoice: matched.name };
  if (isSomaliaCity(city)) return { cityChoice: city, districtChoice: "" };
  return { cityChoice: OTHER_CITY, districtChoice: "" };
}

const Opt = () => {
  const { t } = useLang();
  return <span className="text-xs font-normal text-muted-foreground"> {t("co.optional")}</span>;
};

/**
 * Customer profile — contact details + saved shipping address, editable.
 * Saved via PUT /api/account; the store's `user` is updated in place so the
 * header and checkout prefill pick up the new values immediately.
 */
export function AccountView() {
  const { user, setUser, setView, setAuthOpen, toast, bootReady } = useStore();
  const { t, lang } = useLang();
  const [form, setForm] = useState<ProfileForm>(user ? toForm(user) : EMPTY);
  const [saving, setSaving] = useState(false);
  // Password card state (set/change password — works for Google sign-ins
  // that have no password yet, and for password users changing theirs).
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  // City + district picker state (Task 71). The saved value is ALWAYS
  // form.city — picking a district writes its canonical name, a big city
  // writes its canonical name, so checkout's saved-city mapping and the
  // shipping calculation keep working with zero schema changes.
  const [cityChoice, setCityChoice] = useState<string>(() => savedAddressPickers(user?.city).cityChoice);
  const [districtChoice, setDistrictChoice] = useState<string>(() => savedAddressPickers(user?.city).districtChoice);

  // Late bootstrap (deep link to /?view=account): user arrives after mount,
  // so sync the form + pickers once the profile is actually available.
  useEffect(() => {
    if (!user) return;
    setForm(toForm(user));
    const pickers = savedAddressPickers(user.city);
    setCityChoice(pickers.cityChoice);
    setDistrictChoice(pickers.districtChoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.city]);

  // Somali display label for a canonical city name (storage stays English).
  const cityDisplay = (value: string) =>
    lang === "so" ? SOMALIA_CITIES.find((c) => c.name === value)?.so ?? value : value;

  const onCityChange = (value: string) => {
    // Radix fires onValueChange("") once at mount when the controlled value is
    // set before any item has registered — ignore those or saved values wipe.
    if (!value) return;
    setCityChoice(value);
    setDistrictChoice("");
    if (value === OTHER_CITY) {
      // Keep a typed custom place; clear anything we matched to a picker so
      // the text field starts empty instead of echoing a canonical name.
      setForm((f) => (findDistrict(f.city) || isSomaliaCity(f.city) ? { ...f, city: "" } : f));
    } else if (value === MOGADISHU_CITY) {
      // District becomes the required value — it writes form.city on pick.
      setForm((f) => (findDistrict(f.city) ? f : { ...f, city: "" }));
    } else {
      setForm((f) => (f.city === value ? f : { ...f, city: value }));
    }
  };

  const onDistrictChange = (value: string) => {
    if (!value) return;
    setDistrictChoice(value);
    if (value === OTHER_AREA) {
      setForm((f) => (findDistrict(f.city) ? { ...f, city: "" } : f));
    } else {
      setForm((f) => (f.city === value ? f : { ...f, city: value }));
    }
  };

  const resetForm = () => {
    if (!user) return;
    setForm(toForm(user));
    const pickers = savedAddressPickers(user.city);
    setCityChoice(pickers.cityChoice);
    setDistrictChoice(pickers.districtChoice);
  };

  if (!bootReady && !user) {
    // Deep link (e.g. /?view=account) — bootstrap still in flight. Neutral
    // loading state instead of a sign-in flash.
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("acc.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <UserRound className="mx-auto h-12 w-12 text-brand" />
        <h1 className="mt-4 text-2xl font-semibold text-brand-dark">{t("acc.signinTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("acc.signinBody")}
        </p>
        <Button className="btn-accent mt-4" onClick={() => setAuthOpen(true)}>{t("header.signIn")}</Button>
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
      toast(t("acc.toastNameEmpty"), "error");
      return;
    }
    // Task 71: city is required; district is required for Mogadishu
    // deliveries (shipping is priced per district there). The "not listed"
    // escapes fall back to the free-text fields.
    if (!cityChoice) {
      toast(t("acc.toastCityRequired"), "error");
      return;
    }
    if (cityChoice === OTHER_CITY && !form.city.trim()) {
      toast(t("acc.toastCityRequired"), "error");
      return;
    }
    if (cityChoice === MOGADISHU_CITY && !districtChoice) {
      toast(t("acc.toastDistrictRequired"), "error");
      return;
    }
    if (cityChoice === MOGADISHU_CITY && districtChoice === OTHER_AREA && !form.city.trim()) {
      toast(t("acc.toastAreaRequired"), "error");
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
        toast(data.error ?? t("acc.toastSaveFail"), "error");
        return;
      }
      setUser(data.user);
      toast(t("acc.toastSaved"), "success");
    } catch {
      toast(t("acc.toastNetwork"), "error");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      toast(t("au.minChars"), "error");
      return;
    }
    if (pwd !== pwd2) {
      toast(t("acc.passwordMismatch"), "error");
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? t("acc.toastSaveFail"), "error");
        return;
      }
      setPwd("");
      setPwd2("");
      toast(t("acc.passwordSaved"), "success");
    } catch {
      toast(t("acc.toastNetwork"), "error");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-6 text-brand hover:bg-secondary" onClick={() => setView("home")}>
        <ChevronLeft className="mr-1 h-4 w-4" /> {t("pdp.back")}
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
                  <ShieldCheck className="mr-1 h-3 w-3" /> {t("header.admin")}
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
              <UserRound className="h-4 w-4 text-brand" /> {t("acc.contact")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="acc-name" className="whitespace-nowrap">{t("co.fullName")}</Label>
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
              <Label htmlFor="acc-phone" className="whitespace-nowrap">{t("co.phone")} <Opt /></Label>
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
              <Label htmlFor="acc-email">{t("au.email")}</Label>
              <Input
                id="acc-email"
                type="email"
                value={user.email}
                disabled
                autoComplete="email"
                className="cursor-not-allowed bg-muted/50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">{t("acc.emailNote")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Saved shipping address */}
        <Card className="border-[#e6e2d4]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
              <MapPin className="h-4 w-4 text-brand" /> {t("co.address")}
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {t("acc.addressNote")}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-address">{t("co.street")}</Label>
              <Input
                id="acc-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                autoComplete="street-address"
                placeholder="Villa 12, Maka Al Mukarama Road"
                className={FIELD_CLS}
              />
            </div>
            {/* City picker (Task 71) — Somalia's major cities, required.
                Selecting Mogadishu reveals the required district picker; the
                canonical city/district name lands in the saved city so
                checkout prefills and prices it exactly as before. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="acc-city-select" className="whitespace-nowrap">{t("co.city")}</Label>
                <Select value={cityChoice || undefined} onValueChange={onCityChange}>
                  <SelectTrigger id="acc-city-select" className={`w-full ${FIELD_CLS}`}>
                    {/* Explicit children — radix can't resolve the selected item's
                        text until the (closed) content has mounted, so a bare
                        SelectValue would render empty for saved profiles. */}
                    <SelectValue key={cityChoice || "none"} placeholder={t("co.cityPlaceholder")}>
                      {cityChoice === OTHER_CITY
                        ? t("co.cityOther")
                        : cityChoice
                          ? cityDisplay(cityChoice)
                          : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {SOMALIA_CITIES.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {lang === "so" ? c.so : c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_CITY}>{t("co.cityOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* District picker (Mogadishu only) — same 20 districts as
                  checkout, without per-district prices (pricing only matters
                  at checkout). Required: Mogadishu deliveries are priced per
                  district. "Other area" keeps unlisted neighborhoods working
                  at the outside-Mogadishu flat fee. */}
              {cityChoice === MOGADISHU_CITY && (
                <div className="grid gap-2">
                  <Label htmlFor="acc-district" className="whitespace-nowrap">{t("co.district")}</Label>
                  <Select value={districtChoice || undefined} onValueChange={onDistrictChange}>
                    <SelectTrigger id="acc-district" className={`w-full ${FIELD_CLS}`}>
                      <SelectValue key={districtChoice || "none"} placeholder={t("co.districtPlaceholder")}>
                        {districtChoice === OTHER_AREA
                          ? t("co.areaOther")
                          : districtChoice || undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {MOGADISHU_DISTRICTS.map((d) => (
                        <SelectItem key={d.name} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER_AREA}>{t("co.areaOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {cityChoice === OTHER_CITY && (
              <div className="grid gap-2">
                <Label htmlFor="acc-city" className="whitespace-nowrap">{t("co.city")}</Label>
                <Input
                  id="acc-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  autoComplete="address-level2"
                  placeholder={t("co.cityTypePlaceholder")}
                  className={FIELD_CLS}
                />
              </div>
            )}
            {cityChoice === MOGADISHU_CITY && districtChoice === OTHER_AREA && (
              <div className="grid gap-2">
                <Label htmlFor="acc-area" className="whitespace-nowrap">{t("co.area")}</Label>
                <Input
                  id="acc-area"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  autoComplete="address-level3"
                  placeholder={t("co.areaPlaceholder")}
                  className={FIELD_CLS}
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="acc-zip" className="whitespace-nowrap">{t("co.zip")} <Opt /></Label>
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
                <Label htmlFor="acc-country" className="whitespace-nowrap">{t("co.country")}</Label>
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
              <Phone className="h-3 w-3" /> {t("acc.courierNote")}
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
            {t("acc.reset")}
          </Button>
          <Button type="submit" className="btn-accent" disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? t("acc.saving") : t("acc.save")}
          </Button>
        </div>
      </form>

      {/* Password — own <form> (nested forms are invalid HTML). Signing in
          with Google creates a passwordless account; this sets one so
          email + password sign-in works too. Password users change theirs. */}
      <form onSubmit={savePassword} className="mt-6">
        <Card className="border-[#e6e2d4]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
              <KeyRound className="h-4 w-4 text-brand" /> {t("acc.passwordTitle")}
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground">{t("acc.passwordNote")}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="acc-pwd" className="whitespace-nowrap">{t("acc.passwordNew")}</Label>
              <Input
                id="acc-pwd"
                type="password"
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                className={FIELD_CLS}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-pwd2" className="whitespace-nowrap">{t("acc.passwordConfirm")}</Label>
              <Input
                id="acc-pwd2"
                type="password"
                required
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                className={FIELD_CLS}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("au.minChars")}</p>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" className="btn-accent" disabled={pwdSaving}>
                <KeyRound className="mr-1.5 h-4 w-4" />
                {pwdSaving ? t("acc.saving") : t("acc.passwordTitle")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
