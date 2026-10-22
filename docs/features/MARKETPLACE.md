# MKT-01: proposed marketplace milestone

Date: 2026-10-22. Status: Research complete; proposed scope awaiting owner answers.
Branch: `codex/medicine-marketplace`. Base: main `0accec1`, after SOS PR #3.
Evidence: [marketplace integration research](../research/MARKETPLACE.md).
No application implementation has started. The owner requested research, a deep
plan and 5–10 questions, followed by agreement before implementation.

## Goal to agree

Let a signed-in user find a specific medicine or health product, inspect exactly
what it is, compare trustworthy offers where available, and continue through an
honest shopping workflow. The first milestone must distinguish its demo behavior
from actual pharmacy transactions. India/INR is an assumption until confirmed.

Recommended review version: curated search and comparison + cart + saved demo
orders, with no payment or actual fulfillment. One licensed provider can replace
the demo adapter later after access is verified. If real integration is essential
or partner access already exists, revise this plan before any application work.

## Proposed user journey

1. Dashboard Marketplace tile and Navbar open protected `/marketplace`. Existing
   auth and visual style are reused. Show the data mode near the page heading.
2. Search catalog by product name and reviewed ingredient aliases; filter category
   and prescription status. Empty results offer a clear reset; no invented matches.
   Search relevance is literal/catalog-based rather than symptom-driven advice.
3. Inspect a product with strength/form/pack, source label and any restriction.
   Omit unverified therapeutic descriptions, ratings and product imagery.
4. Compare a small set of offers only for the same product/pack. Prices, stock,
   delivery estimates and timestamps are explicitly live, reference, or demo.
   A demo comparison never claims to search real pharmacy inventory.
5. Add an eligible offer to a bounded-quantity cart. For the first milestone,
   recommend one seller per demo order rather than split fulfillment. Changing
   seller is explicit. Prescription-required/unknown items do not silently checkout.
6. Checkout shows the complete server-computed total and mode. Recommended action:
   **Place demo order — no payment or delivery**. Use minimal synthetic details for
   the review, not a real home address or uploaded medical record.
7. Store the order under the authenticated user and show history/detail. Display
   `demo_created` and `demo_cancelled` events actually performed by the user; no
   fabricated payment success, pharmacy approval, shipped or delivered state.
8. Optional clearly separate nearby-pharmacy navigation reuses the existing map.
   It is place discovery, not verified product stock or a partner relationship.

Items 4–8 are proposed scope; owner answers can reduce or replace them.

## Architecture within the existing stack

Reuse Next.js/React/TypeScript, current Tailwind theme, Base UI primitives, Better
Auth, existing FastAPI authentication and MongoDB. No new commerce framework,
state-management library, database or backend migration is proposed.

Proposed frontend responsibilities:

- Protected marketplace route under `app/(dashboard)/marketplace/`.
- Search, product detail, comparison, cart and history components sized to the
  chosen scope; existing Button/Card/Input/Sheet patterns, responsive layout.
- `lib/api-client.ts` for authenticated API requests; typed catalog/offer/order
  contracts in a marketplace-specific module. No API keys or server DB imports
  in browser components.
- Enable only the marketplace dashboard tile; preserve reminders/wearables status,
  chat/SSE, urgency policy, SOS provider/countdown and profile behavior.

Proposed FastAPI responsibilities:

- A dedicated `marketplace` router, Pydantic input/output schemas and small service
  module. Identity always comes from verified JWT `sub`, never browser `userId`.
- A curated fixture/source file with stable IDs and provenance. Keep the first
  provider boundary small; do not build a generalized marketplace platform.
- Separate product data from offers, and keep demo/live/reference modes explicit.
- If saved orders are approved, use a separate `marketplaceOrders` collection and
  optional cart collection. Never extend auth collections or overwrite profiles.
- Server validates products/offer eligibility and quantities, recomputes totals
  from authoritative offers, and rejects invalid or stale choices. Client totals
  are display only. Use integer minor currency units rather than binary floats.
- Use a request idempotency key with a unique user/request index if orders are
  included. Retry returns the same order rather than creating duplicates.
  Keep indexes/data additions explicit; no ingestion or reseeding on app import.
- Save order snapshots of product/pack/price/mode and the minimal agreed contact
  fields. Preserve historical totals if the catalog changes. Isolate reads and
  cancellation to the owning account.

Candidate contracts (names/paths will be finalized after scope agreement):

| Operation | Candidate endpoint | Important behavior |
| --- | --- | --- |
| Catalog search | `GET /marketplace/products` | Bounded query, category filters and pagination; never arbitrary regex evaluation |
| Product and offers | `GET /marketplace/products/{id}` | Exact product identity, source/mode and nullable unknown values |
| Demo checkout | `POST /marketplace/demo-orders` | Validated items, computed totals, request idempotency and immutable snapshots |
| Own history/detail | `GET /marketplace/orders[/{id}]` | Ownership enforced on every request |
| Own cancellation | `POST /marketplace/orders/{id}/cancel` | Legal local state transition; cannot cancel another user's order |

A browser-only cart is sufficient for a first demo if cross-device persistence is
not required. If persisted, key it to the account and clear it on sign-out; do not
leave another account's medical shopping history visible on a shared browser.
No final storage decision is approved yet.

## Implementation sequence after agreement

1. Finalize mode, product range, prescription behavior, payment and personal-data
   scope from the owner answers. Freeze acceptance criteria and fixture sources.
2. Define the small catalog/offer/order contracts and synthetic sample records.
   Verify data/asset permissions and classification metadata before use.
3. Implement backend validation/ownership/idempotency and narrow provider service,
   with focused synthetic tests. No live commerce calls by default.
4. Implement catalog/detail/comparison and cart in the existing visual style.
5. Implement the agreed checkout/history/cancellation or external handoff. Display
   only statuses backed by actual events and the selected data mode.
6. Exercise agreed failure cases and existing sign-in/profile/chat/map/SOS routes;
   run lint, TypeScript, production build and affected Python/Node tests.
7. Review diff/secrets/data boundaries, update records, and present the demo. Push,
   provider account setup and merge need authorization for this feature; SOS's
   previous merge authorization does not cover it automatically.

All code for this one outcome stays on `codex/medicine-marketplace`. Follow-up live
provider integration would use its own branch from updated main after this phase
merges; no stacked branches or unrelated reminders work are proposed.

## Acceptance matrix to agree

| Case | Expected result |
| --- | --- |
| Search exact name, alias, no matches, malformed/long query | Useful bounded results or clear validation/empty feedback |
| Similar name but different strength/form/pack | Kept distinct; not silently substituted or ranked as identical |
| Unknown prescription status or restricted item | Clearly shown and blocked from unrestricted checkout |
| Demo/reference data | Label survives search, details, comparison, checkout and history |
| Missing stock, shipping cost or delivery ETA | Shown unknown, never fabricated; no false cheapest/fastest claim |
| Negative/excessive quantity, stale/deleted offer, modified browser price | Server rejects/requotes; no trusted client total |
| Double-click/retried checkout | One owned order with stable reference |
| Another account lists/reads/cancels an order | No access to the first account's data |
| Catalog changes after order creation | Historical snapshot/total remains correct |
| Cancellation/repeated cancellation | Valid state handling; no invented fulfillment reversal |
| Backend/provider unavailable | Visible error and retained cart where appropriate; no false order success |
| Narrow viewport/keyboard | Usable search/cart and accessible focus/controls |
| Existing flows | Auth, profile, conversation creation/streaming, maps and SOS remain intact |

No checkout, prescription or payment scenario is considered tested against a real
provider merely because mocks pass. A frontend Vercel deployment is not evidence
that a hosted FastAPI/partner/payment integration is ready.

## Explicitly proposed exclusions

Real money, automatic pharmacy orders, prescription uploads, pharmacist/seller
admin portals, automated medicine substitution, diagnosis-based recommendations,
auto-population from private profiles, real dispatch tracking, lab booking,
wearables, reminder scheduling and bulk catalog scraping. These can enter scope
only through an explicit decision; do not infer them from landing-page copy.

## Ten owner decisions pending

1. First version: complete simulated shopping journey, external pharmacy handoff,
   or actual embedded partner ordering?
2. Product range: medicines plus health supplies, also lab tests, or supplies only?
3. Existing access: licensed local pharmacy/pharmacist, approved partner API/catalog,
   or none? No credentials or private contact details are needed in chat.
4. Main panel demonstration: comparison, cart/order history, or both?
5. Prescription items: browse with checkout blocked, exclude initially, or include
   a clearly simulated professional-review demonstration?
6. Payments: no-money demo, payment-gateway test mode, or checkout on a real partner?
7. Country/currency and target city/pincode for any geographic example?
8. Should search remain manual or include an explicit search action for a recorded
   medication? No automatic diagnosis-based suggestions are proposed.
9. Checkout data: minimal synthetic details, or must a real address workflow exist?
10. Must this milestone use only existing/free services, or are approved paid
    integrations an option after provider terms are known?

These decisions are unanswered. No approval to implement is inferred from the
research request. Refine this plan after the replies and confirm the final scope.
