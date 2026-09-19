// Rich-text helpers for product descriptions (Task 69).
//
// The admin editor stores FORMATTED HTML in the existing `description`
// column (bold / italic / underline / bullet & numbered lists / small
// heading). Everything that renders or consumes descriptions uses these
// helpers so legacy plain-text products keep working and nothing unsafe
// ever reaches the page.
//
// Security model: an ALLOWLIST, not a blocklist. Only the formatting tags
// below survive sanitization — with NO attributes at all — so event
// handlers, javascript: URLs, iframes, scripts etc. are structurally
// impossible. Anything else (well-formed tag, stray "<", entity tricks)
// is either dropped or escaped to literal text. The same function runs in
// Node (API save) and the browser (render time, defense in depth).

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s",
  "ul", "ol", "li",
  "p", "br",
  "h3", "h4",
]);

// Dangerous containers removed wholesale (content included) before the
// allowlist pass, so their guts never leak through as text.
const STRIP_WITH_CONTENT_RE =
  /<(script|style|iframe|object|embed|noscript|template|svg|math|title|textarea)\b[\s\S]*?<\/\1\s*>/gi;
const STRIP_SELFCLOSING_RE =
  /<(script|style|iframe|object|embed|noscript|template|svg|math|title|textarea|link|meta|base|form|input|button|select|option)\b[^>]*>/gi;

export function sanitizeRichText(input: string): string {
  if (!input) return "";
  let html = String(input)
    // Control chars (also our temporary markers below).
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(STRIP_WITH_CONTENT_RE, "")
    .replace(STRIP_SELFCLOSING_RE, "");

  // Keep allowlisted tags (as canonical, attribute-free forms) via
  // placeholders; drop every other tag; escape everything that remains.
  const kept: string[] = [];
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return "";
    kept.push(match.startsWith("</") ? `</${t}>` : t === "br" ? "<br>" : `<${t}>`);
    return `\u0001${kept.length - 1}\u0001`;
  });
  html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\u0001(\d+)\u0001/g, (_, i: string) => kept[Number(i)]);

  // Structural normalize (Task 70): Chrome's execCommand dumps lists INSIDE
  // the surrounding paragraph — <p>lead<br><ul>…</ul></p> — which is invalid
  // HTML that renders/parses inconsistently (the "bullet list not working"
  // bug). Hoist list/heading boundaries out of <p>; stray empty <p> left
  // behind is removed by the tidy pass below. Idempotent, token-exact (the
  // allowlist pass above canonicalizes every tag to attribute-free form).
  html = hoistBlocksFromP(html);

  // Tidy: empty paragraphs/list items and dangling <br> at the edges.
  html = html
    .replace(/<(?:p|h3|h4)>(?:\s|&nbsp;|<br>)*<\/(?:p|h3|h4)>/gi, "")
    .replace(/<li>(?:\s|&nbsp;|<br>)*<\/li>/gi, "")
    .replace(/(?:<br>)+\s*$/gi, "");
  return html.trim();
}

/**
 * Hoist ul/ol/h3/h4 boundaries out of <p> with a token-state pass (Task 70).
 * The tags arrive attribute-free and lowercase from the allowlist pass, so an
 * exact-form split is safe. Nested lists INSIDE <li> are left untouched; only
 * direct <p> children are hoisted, and the phantom </p> the original markup
 * carried is swallowed.
 */
function hoistBlocksFromP(html: string): string {
  if (!html.includes("<p>") || !/<(?:ul|ol|h3|h4)>/.test(html)) return html;
  const parts = html.split(/(<\/p>|<p>|<\/ul>|<ul>|<\/ol>|<ol>|<\/h3>|<h3>|<\/h4>|<h4>|<\/li>|<li>)/g);
  const out: string[] = [];
  const stack: string[] = [];
  let reopenP = false;
  for (const part of parts) {
    if (!part) continue;
    const open = /^<(p|ul|ol|h3|h4|li)>$/.exec(part);
    const close = /^<\/(p|ul|ol|h3|h4|li)>$/.exec(part);
    if (open) {
      const t = open[1];
      if (t !== "p" && t !== "li" && stack[stack.length - 1] === "p") {
        out.push("</p>");
        stack.pop();
        reopenP = true;
      }
      stack.push(t);
      out.push(part);
    } else if (close) {
      const t = close[1];
      if (t === "p" && stack[stack.length - 1] !== "p") continue; // phantom close
      if (stack[stack.length - 1] === t) stack.pop();
      out.push(part);
      if (t !== "p" && t !== "li" && reopenP) {
        out.push("<p>");
        stack.push("p");
        reopenP = false;
      }
    } else {
      out.push(part);
    }
  }
  if (stack[stack.length - 1] === "p") out.push("</p>");
  return out.join("");
}

// True when a stored description carries (allowlisted) formatting tags.
// Plain text that merely contains "<3" or "a < b" stays plain text.
const RICH_TAG_RE = /<\/?(?:b|strong|i|em|u|s|ul|ol|li|p|br|h3|h4)\b[^>]*>/i;
export function looksLikeHtml(text: string | null | undefined): boolean {
  return !!text && RICH_TAG_RE.test(text);
}

/** Plain text from formatted HTML (for search, feeds, meta, JSON-LD). */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Legacy plain-text descriptions open in the editor as real paragraphs:
 * blank lines separate <p> blocks, single newlines become <br>.
 */
export function plainTextToEditorHtml(text: string): string {
  const t = String(text ?? "").replace(/\r\n?/g, "\n");
  if (!t.trim()) return "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
