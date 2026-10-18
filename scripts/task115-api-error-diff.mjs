#!/usr/bin/env node
/**
 * Task 115 — Somali pass: diff every API-route error string (and hook
 * fallback) against localizeApiError's MAP. Anything surfaced in client
 * toasts must map to a dict key, or a Somali shopper sees English.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const mapSrc = readFileSync(join(ROOT, "src/lib/i18n/api-errors.ts"), "utf8");
const mapped = new Set([...mapSrc.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"err\.|"/gm)].map((m) => m[1]).filter(Boolean));
// Simpler: pull the left-hand keys of MAP explicitly.
const mappedKeys = new Set(
  [...mapSrc.matchAll(/^\s{2}"([^"]+)":\s*"/gm)].map((m) => m[1]),
);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith("route.ts")) out.push(p);
  }
  return out;
}

const routes = walk(join(ROOT, "src/app/api"));
const apiStrings = new Map(); // string -> [locations]
const collect = (s, loc) => {
  if (!s || s.length < 8) return;
  if (!/[a-zA-Z]{3}/.test(s)) return;
  if (!apiStrings.has(s)) apiStrings.set(s, []);
  apiStrings.get(s).push(loc);
};

for (const file of routes) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/error:\s*(?:err\?\.\s*message\s*\?\?\s*)?["'`]([^"'`]+)["'`]/g)) {
    collect(m[1], file.replace(ROOT + "/", ""));
  }
  for (const m of src.matchAll(/message:\s*["'`]([^"'`]+)["'`]/g)) {
    collect(m[1], file.replace(ROOT + "/", ""));
  }
}

// Hook fallbacks that land in toasts.
const hookFiles = ["src/hooks/use-store.ts", "src/hooks/use-store.tsx"].map((f) => join(ROOT, f));
for (const f of hookFiles) {
  try {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/["'`]((?:Failed|Please|Sign in|Could not)[^"'`]{4,})["'`]/g)) {
      collect(m[1], "src/hooks/use-store");
    }
  } catch {}
}

const unmapped = [];
for (const [s, locs] of [...apiStrings].sort()) {
  if (mappedKeys.has(s) || mappedKeys.has(s.replace(/\.$/, ""))) continue;
  // skip dev-diagnostic-only routes (never shown to shoppers)
  if (locs.every((l) => l.includes("/api/diag") || l.includes("/api/seed"))) continue;
  unmapped.push({ s, locs });
}

console.log(`MAP entries: ${mappedKeys.size}`);
console.log(`API/hook strings found: ${apiStrings.size}`);
console.log(`\n=== NOT MAPPED (${unmapped.length}) ===`);
for (const { s, locs } of unmapped) console.log(`- "${s}"  <-  ${[...new Set(locs)].join(", ")}`);
