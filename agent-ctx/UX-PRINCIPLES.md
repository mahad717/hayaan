# UX Principles — The Design of Everyday Things (Donald Norman, 2013 revised ed.)

**Status: standing policy.** Every Hayaan UX task — new components, copy, error
states, flows — is designed and reviewed against this document. It was created
after reading the full book (extracted from the owner's uploaded .mobi; full
text cached at `scripts/doet-fulltext.txt`). Quotes below are verified against
that text, not paraphrased from memory. Update it only with the owner's input
or when the book is re-consulted.

---

## 1. The six fundamentals of discoverability

| Principle | Norman's definition (verified quote) | What it means for Hayaan |
|---|---|---|
| **Affordance** | "A relationship between the properties of an object and the capabilities of the agent that determine just how the object could possibly be used." | A card that opens a PDP must *look* tappable; a heart button must look pressable. Affordance is a relationship (device + person), not a property — a flat gray tile on a phone screen "affords" nothing. |
| **Signifier** | "Any mark or sound, any perceivable indicator that communicates appropriate behavior to a person." | Wherever an action exists, place a *visible* marker there: the wishlist heart is always visible (not hover-only), the header heart carries a count badge, discount badges sit at top-left. Actions without signifiers do not exist for users. |
| **Mapping** | "Natural mappings are those where the relationship between the controls and the object to be controlled … is obvious." | Spatial/cultural correspondence: district picker maps to the fee table; category grid mirrors the nav order; admin tabs mirror the data they open. Never make users *compute* which control does what. |
| **Feedback** | "Communicating the results of an action" — "some way of letting you know that the system is working on your request." | Every tap gets an immediate, informative response: optimistic heart flip → success toast; buttons show busy state; checkout reports each step. No silent waits, ever. |
| **Conceptual model** | "An explanation, usually highly simplified, of how something works." | Users need a simple story: saved items live in a wishlist *page* (badge = count), guides exist "before you order," payment is a hosted checkout. Copy and structure must reinforce one consistent model — no jargon, no unexplained states. |
| **Constraints** | Limits that "reduce the set of possible actions" (physical, cultural, semantic, logical). | Guide people to valid actions: quantity min/max, required form fields disabled until valid, guests gated by the same auth modal everywhere (hearts, cart, orders). |

## 2. The gulfs, the seven stages, and knowledge

- **Gulf of execution** (can I act?) and **gulf of evaluation** (did it work?)
  must be bridged by design, never by user ingenuity. Audit every flow: what
  must the user *know* that we did not *show*?
- **Seven stages of action** (1 goal, 3 execution, 3 evaluation). Use as a
  checklist per flow: Goal → Plan → Specify → Perform → Perceive → Interpret →
  Compare. A flow fails if any stage requires guessing.
- **Knowledge in the world vs. in the head** — put information on the screen.
  The PDP shows shipping fee thresholds, payment methods, and guide links so
  shoppers never need to remember them from a previous page. Somali shoppers
  on phones: assume no prior session, no remembered state.

## 3. Errors are design failures, not user failures

- **Slips** (right goal, wrong action — subconscious) vs **mistakes** (wrong
  goal — conscious reasoning from a bad model). Different fixes: slips need
  constraints + confirmations; mistakes need better models + clearer copy.
- **Design for error**: make errors discoverable and *recoverable*. Our
  pattern: optimistic UI → server write-back → on failure revert + toast
  (`wishlist-heart.tsx` is the reference implementation).
- **Never blame the user.** Error copy states what happened and what to do
  next ("Run the migration", "Sign in to save items"). No dead ends.
- **Forced functions** (interlocks / lock-ins / lockouts) sparingly — e.g.
  checkout locks invalid states out rather than erroring after the fact.

## 4. Process rules (Ch. 6 — Design Thinking)

- **Double-diamond, diverge then converge**: find the *right problem* before
  building. The root cause, not the symptom.
- **Human-centered design** — "ensures that the designs match the needs and
  capabilities of the people for whom they are intended." Our users: Somali
  shoppers, mobile-first, slow/patchy networks, EN/SO bilingual, cash-based
  culture adapting to online payment. Design for *their* capabilities.
- **The paradox of technology**: added capability adds complexity; the design
  must absorb it. Each new feature (wishlist, reviews, digital goods) must
  arrive with its signifiers, feedback, and error paths — never as bare API.

## 5. When design cannot remove difficulty: standardize

If a flow must stay awkward (e.g. manual Supabase migration), standardize it
and document it — consistent convention beats cleverness.

---

## Hayaan audit (2026-10-11, first pass)

**Already Norman-conformant (verified in code):**
- Wishlist hearts: always-visible signifier, optimistic feedback, revert +
  toast on failure, uniform guest gate (`wishlist-heart.tsx`).
- Toasts used across 15 components; aria labels on product cards; header
  badge = live count; empty states explain the model and next action.
- PDP "Before you order — buying guides" = knowledge in the world at the
  point of decision.

**Fixed same day (Task 90, shipped):**
1. ~~Shipping-fee visibility~~ → PDP delivery preview: district picker with
   the exact fee, free-threshold note, defaults to the saved district
   (`product-detail.tsx`, same table as checkout/order creator — no drift).
2. ~~Checkout error states~~ → inline, categorized recovery panel next to
   the pay button (network / cart-consumed / declined), auto-scrolled into
   view, dismissible; disabled pay button explains itself
   (checking-payment / pick-district hints) (`checkout.tsx`).
3. ~~Form validation~~ → constraint-first: lead-popup CTA disabled until
   there is something to send, with the hint explaining what is needed;
   checkout pay button stays disabled until the district makes the total
   known (`lead-popup.tsx`, `checkout.tsx`).
4. ~~SO translations~~ → every Task 90 key shipped EN + SO together
   (TS `Record<DictKey,string>` enforces completeness at build time).
   Task 94 completeness pass: 430/430 keys bilingual; the remaining hardcoded
   surfaces localized (cart/header a11y labels, hero alts, form placeholders,
   blog index/post chrome + Somali SSR dates, category FAQ titles, PDP guide
   cards, branded 404); full Somali FAQ content (site + category + generic)
   with JSON-LD matching the visible language; known API/hook error strings
   mapped to dict keys via `localizeApiError()` so toasts never leak English.
5. ~~Lead popup interruption~~ → never stacks over an open auth modal, cart
   drawer, or checkout/orders view; postpones 30s and retries up to 4x
   before giving up for the visit (`lead-popup.tsx`).

**Still open for owner review:**
- Lead popup timing itself (18s) is a business lever — Norman would prefer
  engagement-triggered; owner's call, left as-is.

**Case study from this task (the paradox of technology, live):** while
verifying the checkout hints we caught a REAL display bug — `/api/cart`
items carried the price only under `product`, the client shipping helper
read top-level `it.price` → NaN → **every cart ≥$75 showed a $6.95 delivery
fee at checkout while the server charged the correct amount** (the cart
drawer looked right only because it short-circuits the free-shipping case
before calling the helper; `ignoreBuildErrors: true` hid the type
mismatch). Fixed in 1af6aa3 (shape-tolerant helpers + payload carries
price/productType; verified with bun across old/new/digital/mixed shapes).
Lesson: when a capability (digital-aware shipping) is added, its silent
failure mode showed up as a *wrong number next to the pay button* — exactly
where conceptual-model accuracy matters most. Keep the displayed total and
the charged total provably identical (same helper, same shape).

**Rule for every new PR:** each user-visible action ships with (a) a
signifier, (b) immediate feedback, (c) a defined failure path with recoverable
copy, and (d) EN + SO strings. If any is missing, the task is not done.
