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

**Flagged for future work (do not fix without owner approval):**
1. **Lead popup** interrupts on load — Norman's principle: unsolicited
   interruptions are anti-feedback; reconsider timing/exit criteria.
2. **SO translations** must be complete for every new key — a missing Somali
   string is a missing signifier for most shoppers.
3. **Shipping-fee visibility** at PDP: district fees should be previewable
   without leaving the product (currently shown late in checkout).
4. **Checkout error states**: verify each failure (network, payment, stock)
   has recovery copy, not a generic error.
5. **Form validation**: prefer disabling invalid actions (constraint) over
   post-submit error toasts (punishment).

**Rule for every new PR:** each user-visible action ships with (a) a
signifier, (b) immediate feedback, (c) a defined failure path with recoverable
copy, and (d) EN + SO strings. If any is missing, the task is not done.
