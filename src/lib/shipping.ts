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

/** Free delivery kicks in at this subtotal (matches the "Free shipping over $75" badge). */
export const FREE_SHIPPING_THRESHOLD = 75;

/** Flat delivery fee outside the priced Mogadishu districts. */
export const OUTSIDE_MOGADISHU_FEE = 6.95;

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
 *   subtotal ≥ $75          → free (matches the storefront badge)
 *   priced Mogadishu district → the district's fee
 *   anything else           → flat outside-Mogadishu fee
 */
export function computeShipping(subtotal: number, city: string | null | undefined): number {
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return districtFee(city) ?? OUTSIDE_MOGADISHU_FEE;
}
