// Somalia's major cities for the profile/checkout address pickers (Task 71).
//
// `name` is the canonical English spelling — that exact string is what gets
// stored in the profile's `city` field (and on orders as shipping_city), so
// checkout's saved-city mapping, computeShipping and fulfillment keep working
// unchanged. `so` is the Somali display label (shown when the storefront is
// switched to SO); storage always stays canonical.

export interface SomaliaCity {
  name: string;
  so: string;
}

export const SOMALIA_CITIES: SomaliaCity[] = [
  { name: "Mogadishu", so: "Muqdisho" },
  { name: "Hargeisa", so: "Hargeysa" },
  { name: "Bosaso", so: "Boosaaso" },
  { name: "Galkayo", so: "Gaalkacyo" },
  { name: "Kismayo", so: "Kismaayo" },
  { name: "Baidoa", so: "Baydhabo" },
  { name: "Burao", so: "Burco" },
  { name: "Garowe", so: "Garoowe" },
  { name: "Berbera", so: "Berbera" },
  { name: "Borama", so: "Boorama" },
  { name: "Beledweyne", so: "Beledweyne" },
  { name: "Jowhar", so: "Jowhar" },
  { name: "Afgooye", so: "Afgooye" },
  { name: "Merca", so: "Marka" },
  { name: "Erigavo", so: "Ceerigaabo" },
  { name: "Las Anod", so: "Laascaanood" },
];

/** True when the value is one of the canonical city names (exact match). */
export function isSomaliaCity(value: string | null | undefined): boolean {
  if (!value) return false;
  return SOMALIA_CITIES.some((c) => c.name === value);
}
