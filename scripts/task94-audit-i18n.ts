/**
 * Task 94 — Somali translation completeness audit.
 *
 * Run: bun /home/z/my-project/scripts/task94-audit-i18n.ts
 *
 * Checks:
 *  1. EN keys missing from SO record (runtime proof; types are bypassed by ignoreBuildErrors)
 *  2. SO values that are empty / whitespace
 *  3. SO values identical to EN (untranslated suspects; some legit: brands, "FAQ", "Sifalo"…)
 *  4. {var} interpolation mismatches between EN and SO
 *  5. SO values that still look like English sentences (stopword heuristic)
 *  6. t("...") keys used in src/** that do not exist in the dictionary
 *  7. Dictionary keys never referenced in src/** (dead weight, informational)
 */
import { dictionaries } from "../src/lib/i18n/dictionary";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { en, so } = dictionaries;
const enKeys = Object.keys(en).sort();
const problems: string[] = [];

// 1 — missing keys
const missing = enKeys.filter((k) => !(k in so));
if (missing.length) problems.push(`MISSING IN SO (${missing.length}): ${missing.join(", ")}`);

// 2 — empty
const empty = enKeys.filter((k) => !String(so[k] ?? "").trim());
if (empty.length) problems.push(`EMPTY SO (${empty.length}): ${empty.join(", ")}`);

// 3 — identical to EN (suspects; curated whitelist below)
const LEGIT_IDENTICAL = new Set<string>([
  // brand / product names, payment rails, protocol-ish tokens
  "whatsapp.title", // placeholder — real check below prints values for manual curation
]);
const identical = enKeys.filter(
  (k) => String(so[k] ?? "").trim() === String(en[k]).trim() && !LEGIT_IDENTICAL.has(k),
);

// 4 — {var} mismatch
const varsOf = (s: string) => new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const varMismatch = enKeys.filter((k) => {
  if (!(k in so)) return false;
  const a = varsOf(en[k]);
  const b = varsOf(so[k]);
  if (a.size !== b.size) return true;
  for (const v of a) if (!b.has(v)) return true;
  return false;
});
if (varMismatch.length)
  problems.push(
    `VAR MISMATCH (${varMismatch.length}): ${varMismatch.map((k) => `${k} [EN=${en[k]} | SO=${so[k]}]`).join(" ;; ")}`,
  );

// 5 — English-looking SO values (stopword heuristic, ignores keys already in `identical`)
const STOP = new Set(
  ("the and you your for with from that this will can are was have has our we it is of to in on a an " +
    "please choose select enter payment order orders cart checkout product products price delivery " +
    "shipping free account email phone password search sign continue save cancel close back next")
    .split(" "),
);
const looksEnglish = (s: string) => {
  const words = String(s).toLowerCase().match(/[a-z']{3,}/g) ?? [];
  if (words.length < 3) return false;
  const hits = words.filter((w) => STOP.has(w)).length;
  return hits / words.length >= 0.25;
};
const englishish = enKeys.filter(
  (k) => k in so && !identical.includes(k) && looksEnglish(so[k]),
);
if (englishish.length)
  problems.push(
    `SO LOOKS ENGLISH (${englishish.length}): ${englishish.map((k) => `${k} => ${so[k]}`).join(" ;; ")}`,
  );

// 6+7 — usage sweep across src/**
const SRC = "/home/z/my-project/src";
const files: string[] = [];
const walk = (dir: string) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx?|ts)$/.test(e) && !p.endsWith("dictionary.ts")) files.push(p);
  }
};
walk(SRC);
const usedKeys = new Map<string, string[]>(); // key -> files
const KEY_RE = /\bt\(\s*["'`]([a-z0-9A-Z_.\-]+)["'`]/g;
const TRANSLATE_RE = /translate\(\s*(?:lang|["'])[^,]*,\s*["'`]([a-zA-Z0-9_.\-]+)["'`]/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const re of [KEY_RE, TRANSLATE_RE]) {
    for (const m of src.matchAll(re)) {
      const key = m[1];
      if (!usedKeys.has(key)) usedKeys.set(key, []);
      usedKeys.get(key)!.push(f.replace(SRC + "/", ""));
    }
  }
}
const unknownUsed = [...usedKeys.keys()]
  .filter((k) => !(k in en))
  .filter((k) => k.includes("."));
if (unknownUsed.length)
  problems.push(
    `USED BUT NOT IN DICT (${unknownUsed.length}): ${unknownUsed
      .map((k) => `${k} @ ${[...new Set(usedKeys.get(k)!)].join(",")}`)
      .join(" ;; ")}`,
    );
const unused = enKeys.filter((k) => !usedKeys.has(k));

// report
console.log(`EN keys: ${enKeys.length}  SO keys: ${Object.keys(so).length}  used keys: ${usedKeys.size}`);
console.log("\n=== PROBLEMS ===");
console.log(problems.length ? problems.join("\n\n") : "(none)");
console.log(`\n=== IDENTICAL EN/SO (${identical.length}) — manual curation needed ===`);
for (const k of identical) console.log(`${k}\n    EN: ${en[k]}`);
console.log(`\n=== UNUSED DICT KEYS (${unused.length}) ===`);
console.log(unused.join(", ") || "(none)");
