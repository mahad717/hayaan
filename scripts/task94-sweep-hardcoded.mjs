/**
 * Task 94 — hardcoded-English sweep over storefront surfaces.
 * Flags user-visible string literals that bypass the t() dictionary.
 * Triage output only — every hit needs human/context review.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["/home/z/my-project/src/components/store", "/home/z/my-project/src/app"];
const SKIP = [/admin/i, /\.css$/, "ui/"]; // admin stays EN by design; shadcn primitives are structural
const WORDS = /[A-Za-z]{2,}/;

const hits = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP.some((s) => (s instanceof RegExp ? s.test(e) : e.includes(s)))) walk(p); continue; }
    if (!/\.(tsx|ts)$/.test(e)) continue;
    if (SKIP.some((s) => (s instanceof RegExp ? s.test(p) : p.includes(s)))) continue;
    if (p.endsWith("language-provider.tsx") || p.endsWith("dictionary.ts")) continue;
    const src = readFileSync(p, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      const n = i + 1;
      const t = line.trim();
      if (!WORDS.test(t)) return;
      // skip obvious non-UI
      if (/^(import|export (type|interface|const schema|async function|function)|\/\/|\*|\/\*)/.test(t)) return;
      if (/className|cn\(|^\s*(type|interface)|from ["']|useState|useEffect|useMemo|useCallback|const \w+ = \(|=>\s*\{|\.map\(|\.filter\(|\.sort\(|await |fetch\(|console\.|styles|variant:|size:|key=|href=|id=|data-|\.test\(|new RegExp|encodeURIComponent|JSON\.|slug|Date|Intl\./.test(t)) return;
      const rel = p.replace("/home/z/my-project/", "");
      // 1) attribute literals: placeholder= aria-label= title= alt= label= heading= description= ...="Text"
      for (const m of line.matchAll(/(placeholder|aria-label|aria-pressed|title|alt|label|heading|description|subtext|ctaText|buttonText|badge|hint|note|emptyText|tooltip)\s*[:=]\s*["'`]([^"'`]{3,})["'`]/g)) {
        if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}|[a-z]{3,}[!?]/.test(m[2]) && !/^[a-z-]+$/.test(m[2]) && !/class|font|flex|text-|bg-|http/.test(m[2]))
          hits.push(`${rel}:${n}  ATTR ${m[1]}="${m[2]}"`);
      }
      // 2) JSX text nodes >Text text<
      for (const m of line.matchAll(/>\s*([A-Z][A-Za-z0-9$&.,%'"!?:;()\- ]{4,})\s*[{<]/g)) {
        const v = m[1].trim();
        if (/[A-Za-z]\s[A-Za-z]/.test(v) && !/^(use|const|let|await|import|export|return|new|if|else|switch|case|break|typeof|key=|className)/.test(v) && !/[{}]/.test(v))
          hits.push(`${rel}:${n}  JSX  >${v}<`);
      }
      // 3) plain string literals that look like sentences (heuristic: 2+ words, starts capital)
      for (const m of line.matchAll(/["'`]([A-Z][a-z]+(?: [A-Za-z0-9$%.,'!?&()\-]{1,}){2,})["'`]/g)) {
        const v = m[1];
        if (/className|font|http|px-|text-|hayaan_|SELECT|INSERT|UPDATE|DELETE|Content-Type|Bearer|cookie/i.test(v)) continue;
        hits.push(`${rel}:${n}  STR  "${v}"`);
      }
    });
  }
};
for (const r of ROOTS) walk(r);
console.log(hits.length ? hits.join("\n") : "(no hits)");
