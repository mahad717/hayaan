// Task 63 — verify the district shipping table against the owner's fee sheet.
// Run: bun scripts/verify-shipping-logic.ts
import {
  MOGADISHU_DISTRICTS,
  findDistrict,
  districtFee,
  computeShipping,
  FREE_SHIPPING_THRESHOLD,
  OUTSIDE_MOGADISHU_FEE,
} from "../src/lib/shipping";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

// 1. The owner's sheet: district -> fee (canonical English names as stored on orders)
const SHEET: Record<string, number> = {
  Abdiaziz: 2.5,
  Bondhere: 2.5,
  Daynile: 3,
  Dharkenley: 2.5,
  "Hamar-Jajab": 2,
  "Hamar-Weyne": 2.5,
  Heliwa: 3,
  Hodan: 1.5,
  "Howl-Wadag": 2,
  Kahda: 3,
  Karan: 2.5,
  Shangani: 2.5,
  Shibis: 2.5,
  Waberi: 1.5,
  Wadajir: 1.5,
  Wardhigley: 2,
  Yaqshid: 2,
  Gubadley: 3,
  Darussalam: 3,
  Garasbaaley: 3,
};

check("district count matches the sheet", MOGADISHU_DISTRICTS.length, Object.keys(SHEET).length);
for (const [name, fee] of Object.entries(SHEET)) {
  check(`sheet fee ${name} = $${fee}`, findDistrict(name)?.fee, fee);
}

// 2. Somali + spelling aliases resolve to the same district
const ALIASES: Array<[string, string, number]> = [
  ["Boondheere", "Bondhere", 2.5],
  ["Xamar Jabjab", "Hamar-Jajab", 2],
  ["xamar jab jab", "Hamar-Jajab", 2],
  ["Xamarweyne", "Hamar-Weyne", 2.5],
  ["Huriwaa", "Heliwa", 3],
  ["Howlwadaag", "Howl-Wadag", 2],
  ["Kaxda", "Kahda", 3],
  ["Kaaraan", "Karan", 2.5],
  ["Shingani", "Shangani", 2.5],
  ["Waabari", "Waberi", 1.5],
  ["Warta Nabada", "Wardhigley", 2],
  ["Yaqshiid", "Yaqshid", 2],
  ["Garasbaleey", "Garasbaaley", 3],
  ["Darusalam", "Darussalam", 3],
];
for (const [alias, canonical, fee] of ALIASES) {
  const d = findDistrict(alias);
  check(`alias "${alias}" -> ${canonical}`, d?.name, canonical);
  check(`alias "${alias}" fee`, d?.fee, fee);
}

// 3. Case / hyphen / whitespace insensitivity
check("lowercase hodan", districtFee("hodan"), 1.5);
check("UPPERCASE HODAN", districtFee("HODAN"), 1.5);
check("hyphen Hamar-Jajab", districtFee("Hamar-Jajab"), 2);
check("space Hamar Jajab", districtFee("hamar jajab"), 2);
check("padded  Wadajir ", districtFee("  Wadajir  "), 1.5);

// 4. Shipping computation: threshold, district fee, outside fallback
check("free at $75 (Kahda)", computeShipping(75, "Kahda"), 0);
check("free above $75 (null city)", computeShipping(100, null), 0);
check("district fee below threshold (Hodan $74)", computeShipping(74, "Hodan"), 1.5);
check("district fee below threshold (Kahda $74)", computeShipping(74, "Kahda"), 3);
check("outside fee below threshold (Kismayo)", computeShipping(74, "Kismayo"), OUTSIDE_MOGADISHU_FEE);
check("outside fee below threshold (empty)", computeShipping(74, ""), OUTSIDE_MOGADISHU_FEE);
check("outside fee below threshold (null)", computeShipping(74, null), OUTSIDE_MOGADISHU_FEE);
check("cheapest district is Hodan $1.50", Math.min(...MOGADISHU_DISTRICTS.map((d) => d.fee)), 1.5);
check("priciest districts are $3.00", Math.max(...MOGADISHU_DISTRICTS.map((d) => d.fee)), 3);
check("free threshold constant", FREE_SHIPPING_THRESHOLD, 75);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
