// District-based delivery fees for Mogadishu (source: owner's "shipping fees"
// sheet, Sep 2026). Shared by the cart drawer (estimate), the checkout page
// (display) and the Sifalo order creator (authoritative charge) so the amount
// the customer sees is always exactly the amount the server computes.

export interface ShippingDistrict {
  /** Canonical English label — stored on the order as shipping_city. */
  name: string;
  /** USD delivery fee inside this district. */
  fee: number;
  /** English + Somali spellings customers may type or have saved. */
  aliases: string[];
}

/** Flat delivery fee outside the priced Mogadishu districts. */
export const OUTSIDE_MOGADISHU_FEE = 6.95;

/** Sentinel for district selects: cities outside the priced Mogadishu list.
 *  Shared by the checkout form and the PDP delivery preview so both pickers
 *  behave identically (natural mapping: one convention, everywhere). */
export const OTHER_CITY = "__other";

export const MOGADISHU_DISTRICTS: ShippingDistrict[] = [
  { name: "Abdiaziz", fee: 2.5, aliases: ["abdiaziz", "cabdiaziz"] },
  { name: "Bondhere", fee: 2.5, aliases: ["bondhere", "boondheere"] },
  { name: "Daynile", fee: 3, aliases: ["daynile", "dayniile"] },
  { name: "Dharkenley", fee: 2.5, aliases: ["dharkenley", "darkeenley"] },
  { name: "Hamar-Jajab", fee: 2, aliases: ["hamar jajab", "hamar-jabjab", "xamar jabjab", "xamar jab jab"] },
  { name: "Hamar-Weyne", fee: 2.5, aliases: ["hamar weyne", "xamarweyne", "xamar weyne"] },
  { name: "Heliwa", fee: 3, aliases: ["heliwa", "heliwaa", "huriwaa"] },
  { name: "Hodan", fee: 1.5, aliases: ["hodan"] },
  { name: "Howl-Wadag", fee: 2, aliases: ["howl wadag", "howlwadaag", "hool wadaag"] },
  { name: "Kahda", fee: 3, aliases: ["kahda", "kaxda"] },
  { name: "Karan", fee: 2.5, aliases: ["karan", "kaaraan"] },
  { name: "Shangani", fee: 2.5, aliases: ["shangani", "shingani"] },
  { name: "Shibis", fee: 2.5, aliases: ["shibis"] },
  { name: "Waberi", fee: 1.5, aliases: ["waberi", "waabari"] },
  { name: "Wadajir", fee: 1.5, aliases: ["wadajir"] },
  { name: "Wardhigley", fee: 2, aliases: ["wardhigley", "wardhiigley", "warta nabada"] },
  { name: "Yaqshid", fee: 2, aliases: ["yaqshid", "yaqshiid"] },
  { name: "Gubadley", fee: 3, aliases: ["gubadley"] },
  { name: "Darussalam", fee: 3, aliases: ["darussalam", "darusalam"] },
  { name: "Garasbaaley", fee: 3, aliases: ["garasbaaley", "garasbaleey"] },
];

/** Lowercase, strip diacritics, unify hyphens/spaces so "Xamar-Jabjab", "xamar jab jab" all match. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DISTRICT_LOOKUP: Map<string, ShippingDistrict> = (() => {
  const map = new Map<string, ShippingDistrict>();
  for (const district of MOGADISHU_DISTRICTS) {
    for (const key of [district.name, ...district.aliases]) {
      const norm = normalize(key);
      if (!map.has(norm)) map.set(norm, district);
    }
  }
  return map;
})();

/** Resolve a free-text city/district to a priced Mogadishu district (null = not priced). */
export function findDistrict(city: string | null | undefined): ShippingDistrict | null {
  if (!city) return null;
  return DISTRICT_LOOKUP.get(normalize(city)) ?? null;
}

/** Delivery fee for a district name, or null when the place isn't in the priced list. */
export function districtFee(city: string | null | undefined): number | null {
  return findDistrict(city)?.fee ?? null;
}

/**
 * The one true shipping calculation:
 *   priced Mogadishu district → the district's fee
 *   anything else             → flat outside-Mogadishu fee
 * Charged on EVERY order (the free-over-$75 rule was removed in Oct 2026).
 */
export function computeShipping(subtotal: number, city: string | null | undefined): number {
  return districtFee(city) ?? OUTSIDE_MOGADISHU_FEE;
}

// --- Digital-aware shipping (Task 82) -------------------------------------

export interface CartShippingItem {
  productType?: string | null; // "physical" (default) | "digital"
  price: number;
  quantity: number;
  /** Optional nested product row. Client cart payloads (/api/cart) carry the
   *  price/type here (CartItem shape); the Sifalo order creator passes them
   *  top-level. The helpers below accept BOTH so a payload drift can never
   *  turn the physical subtotal into NaN again (Task 90 fix). */
  product?: { price?: number | null; productType?: string | null } | null;
}

const typeOf = (it: CartShippingItem): string =>
  it.productType ?? it.product?.productType ?? "physical";

const priceOf = (it: CartShippingItem): number => {
  const raw = it.price ?? it.product?.price;
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
};

/** True when the cart holds at least one physical item (default when the
 *  product_type column is missing — pre-migration rows are physical). */
export function hasPhysicalItems(items: CartShippingItem[]): boolean {
  return items.some((it) => typeOf(it) !== "digital");
}

/** Subtotal of PHYSICAL items only — digital goods never pay delivery
 *  (mixed carts are charged on the physical subtotal; digital-only carts
 *  pay nothing). */
export function physicalSubtotal(items: CartShippingItem[]): number {
  return items
    .filter((it) => typeOf(it) !== "digital")
    .reduce((sum, it) => sum + priceOf(it) * it.quantity, 0);
}

/**
 * Cart-level shipping: digital-only carts pay nothing (no address needed);
 * mixed/physical carts are charged on the physical subtotal. Used by the
 * cart drawer estimate, the checkout summary AND the Sifalo order creator
 * (authoritative charge) so the displayed and charged amounts can never
 * drift apart.
 */
export function computeCartShipping(items: CartShippingItem[], city: string | null | undefined): number {
  if (!hasPhysicalItems(items)) return 0;
  return computeShipping(physicalSubtotal(items), city);
}
