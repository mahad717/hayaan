# Hayaan Market — Design Principles (standing owner directive)

Owner directive, 2026-11-08: "always follow these principles" (premium-minimalism
slide). Every UI/design decision in this repo is judged against them.

## The five principles

1. **Fewer colors** — a new color is a cost, not a feature.
2. **Lower saturation** — muted supporting tones; reserve full-strength color for the brand moments.
3. **More whitespace** — spacing is the cheapest luxury; separate with gaps, not lines and boxes.
4. **Stronger contrast** — make the important thing obviously important.
5. **Restrained palettes** — when in doubt, remove an element instead of adding one.

Minimalism increases perceived value.

## Concrete rules for this codebase

- **The palette is CLOSED.** Forest Green `#0b3b22`, Market Green `#3f7d4a`,
  Market Orange `#f28c28` (the single accent), Soft Apricot `#f9c27d`,
  cream `#faf8f1`, white. No new hues without explicit owner sign-off.
- **Market Orange is the ONLY accent** — CTAs and key highlights only
  (the 10%-orange rule already in globals.css). Do not let it creep into
  body text, list hovers beyond the existing `#f9c27d`, or decorative fills.
- **Whitespace before decoration.** Prefer `gap`/`py`/`px` over new borders,
  dividers, shadows, badges or icon clutter. If a section looks thin, add air,
  not ornament.
- **Contrast stays strong where it matters** (body copy, nav, prices). The one
  accepted exception is the owner-approved white-on-`#f28c28` CTA debt
  (2.45:1, Tasks 150/153) — an explicit owner call, not a license for more
  low-contrast pairs.
- **Lower saturation for supporting UI**: muted neutrals and opacity steps
  (`opacity-70` pattern) for secondary text; full-strength color only for
  brand greens and the orange CTA.
- **Before shipping any visual change, ask:** could this be done with one
  fewer color, one fewer element, more air?

## Precedence when rules conflict

1. Explicit owner instruction for a specific element (always wins).
2. These principles.
3. Existing brand tokens and layout conventions.
