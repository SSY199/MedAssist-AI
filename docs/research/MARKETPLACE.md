# MKT-01: medicine marketplace integration research

Research date: 2026-10-22. India is the working assumption, pending owner confirmation.
Branch: `codex/medicine-marketplace`, based on merged main `0accec1`.
Research only. No marketplace application code, provider signup, commercial
contact, purchase, API subscription or data import is authorized by this document.
The owner explicitly requested a research subagent; its findings were synthesized
with a separate repository audit and checks of primary sources.

## Owner decision supersedes the initial recommendation

On 2026-10-23 the owner chose medicine discovery, price information, account-saved
favourites and redirection to actual sellers. No cart, checkout, orders, payments,
address workflow, lab tests or automatic profile-based search is wanted. There is
no existing partner/API access. See the [revised plan](../features/MARKETPLACE.md).
The shopping-demo recommendation below is retained as research history, not
approved scope. Pricing source and catalog coverage still require confirmation.

## Initial research recommendation (not selected)

For the review milestone, build a complete, explicitly labelled demo shopping
journey with a small curated catalog, accurate product identity, comparable demo
offers, a cart and persistent demo order history. Then integrate one approved
licensed pharmacy through a narrow provider interface when access and terms are
confirmed. This is a proposal, not the selected implementation scope.

This recommendation follows from the absent commerce foundation, tomorrow's
review, and unconfirmed partner access. If the owner already has a licensed
partner, documented API or required public rollout, revise the recommendation.
A prototype is not authorization to dispense medicines or collect live payments.

## What the repository actually contains

- Next 16.2.12 / React / TypeScript / Tailwind theme and authenticated dashboard.
- Better Auth sessions and JWT bridge to FastAPI; MongoDB app collections.
- Navbar `/marketplace` link and proxy protection pattern; dashboard entry disabled.
- No marketplace page, catalog, offer feed, cart, order schema, payment integration,
  seller workflow, prescription review or fulfillment provider.
- README proposes medicine and lab-test search with price/delivery comparison and
  explicitly notes that a source is needed first. The landing page promises partner
  comparison, but no partner integration exists. These are proposals, not contracts.
- The existing Mapbox pharmacy category discovers places. It does not verify
  medicine stock, seller participation, retail licensing or delivery availability.

## Integration approaches

| Approach | First milestone fit | Dependencies / implications |
| --- | --- | --- |
| Curated demo catalog + shopping flow | Recommended without existing partner access | Original/permitted catalog data, clearly illustrative offers, simulated checkout/order status. No pharmacy/payment account needed. |
| External pharmacy handoff | Possible lightweight live path | Approved destination/link terms. User transacts on that site; MedAssist must not imply its cart/prescription/order state transfers. |
| One commercial pharmacy integration | Preferred first embedded live path if approved | Commercial agreement, API documentation, sandbox, catalog rights, licensed fulfillment, pricing/stock/serviceability and prescription processes. |
| ONDC buyer app or technology-service-provider route | Candidate for a later production phase | Network registration, protocol and callbacks, public hosting, seller coverage, commercial and buyer-support obligations. |
| Own pharmacy or multivendor marketplace | Separate operational program | Seller verification/licensing, pharmacist workflow, inventory/batch/expiry, delivery, settlement, returns and support; much more than a checkout feature. |

Do not choose a headless-commerce framework merely to obtain a cart. It would not
supply medicine catalog rights, licensed sellers or fulfillment. Existing stack
is sufficient for a scoped prototype; framework/backend replacement is not proposed.

## Primary-source evidence and limits

Links were checked during this research. Marketing availability is not the same
as an executable API contract. A failed or unproductive public search cannot prove
that a private integration does not exist.

| Source | Verified finding | Unknown / design consequence |
| --- | --- | --- |
| [Tata 1mg health-partner page](https://www.1mg.com/partnerships/products/healthPartner) | Advertises white-label ePharmacy/eDiagnostics API and SSO integrations and order management. | No self-serve developer specification, keys, sandbox eligibility, fee schedule or student approval was verified. Treat as a commercial access path. |
| [Tata 1mg terms](https://www.1mg.com/tnc/) | Website content is protected and reuse is restricted. | Do not copy product descriptions/images or treat website access as catalog permission. This review did not establish referral/deep-link rights or an affiliate arrangement. |
| [PharmEasy/API Holdings partner portal](https://partners.apiholdings.in/login) | An official partner portal exists; the reader requires JavaScript. | A portal or the company name “API Holdings” does not establish a public buyer-ordering API. Documentation and permitted access remain unverified. |
| [Apollo 24/7 corporate partnerships](https://www.apollo247.com/corporate-partnerships) | Advertises corporate services and API/CSV integration for enrollment/payroll/reporting. | This is not a verified retail medicine-ordering developer API. Do not confuse it with the unrelated Apollo.io sales-data API. |
| [ONDC buyer participants](https://www.ondc.org/pages/buyer-network-participants.html) | Buyer interfaces may be apps or chatbots, optionally via a technology provider. Buyer responsibilities include discovery, checkout, confirmation and support. | A protocol connection does not establish pharma inventory or serviceability in our target area. |
| [ONDC Pramaan](https://pramaan.ondc.org/) | Integration testbench lists Pharma `ONDC:RET19` and Health & Wellness `ONDC:RET18`. | Testbench domain availability is not proof of live pharmacy coverage or project admission. |
| [ONDC participant onboarding](https://github.com/ONDC-Official/developer-docs/blob/main/registry/Onboarding%20of%20Participants.md) | Documents domain/SSL, approval, signing/encryption keys and registry/callback setup. Staging is marked decommissioned; pre-production and production guidance remains. | Do not follow old staging quickstarts or promise immediate production onboarding. Localhost alone cannot serve required public callbacks. |
| [ONDC technology providers](https://www.ondc.org/pages/technology-service-provider.html) | Using a technology service provider is an official route. | Need a specific provider's pharma scope, access conditions and quote; directory membership is not an endorsement for this project. |
| [Official Jan Aushadhi product/MRP page](https://janaushadhi.gov.in/product-portfolio/product-mrp-list), [sorting view](https://janaushadhi.gov.in/product-portfolio/product-view-list) | Official public product/MRP pages exist; direct reader access returned a JavaScript shell. | No live API/feed, reuse license or local-stock data was verified. Historical price PDFs are not current offers. Similar-looking independent websites are not official sources. |
| [Razorpay terms](https://razorpay.com/terms/), [official KYC repository](https://github.com/razorpay/markdown-docs/blob/master/payments/business-types-kyc-documents.md) | Terms flag medicine-supplying websites among ambiguous-business examples; KYC material also lists pharmacy/drug licenses for prescription merchants. | Do not infer automatic eligibility or a blanket ban. Seek explicit category approval for the actual business before live collection. |
| [Razorpay test/live modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/) | Test mode cannot accept real payments; live activation is distinct. | Sandbox checkout can demonstrate integration, but neither licenses fulfillment nor guarantees live account approval. |
| [PIB government answer, 8 August 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2154213&lang=2&reg=48) | Describes state licensing authorities regulating drug sale/distribution and refers to the 2018 e-pharmacy provisions as draft rules. | Dated evidence; not a complete October 2026 legal opinion. Avoid presenting the draft registration scheme as enacted law. |
| [CDSCO Drugs Rules](https://www.cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Drugs-Rules/), [gazette index](https://cdsco.gov.in/opencms/opencms/en/Notifications/Gazette-Notifications/) | Official rules compilation and amendment/draft-notification listings exist, including 2026 entries. | A 2024 compilation alone is insufficient for a real 2026 launch. Product schedules and applicable seller/location requirements need current professional verification. |
| [PharmEasy returns policy](https://pharmeasy.in/return-policy?src=medlife_home) | Real pharmacy returns are governed by product-specific conditions. | Do not invent universal medicine returns or copy another platform's terms into MedAssist. |

No public fee schedule for a usable partner ordering integration was verified.
Do not quote invented integration charges, free access or guaranteed delivery dates.
A demo with no new provider requires no new pharmacy/payment subscription;
existing database, hosting and any already-used services retain their normal costs.

## Catalog and offer design

Separate the product from a seller's offer. A matching medicine name is not enough
for meaningful price comparison: preserve strength, form, route where applicable,
manufacturer/brand and pack size. Do not treat a differently formulated product as
a substitute. Medication equivalence and prescribing remain outside marketplace
search/ranking; no AI-generated dosage or symptom-to-cart recommendations.

Proposed product facts: stable internal ID/SKU; name; ingredient facts if reviewed;
brand/manufacturer; strength; form; pack quantity/unit; category; prescription status
(`required`, `not_required`, `unknown`); source, verification date and image rights.
Do not default unknown prescription status to unrestricted purchase.

Proposed offer facts: product ID; provider and provider SKU; INR minor-unit price;
nullable MRP/shipping charge; availability state; pincode/serviceability where
verified; nullable delivery estimate; fetched/expiry timestamps; provenance and
`demo`, `reference` or `live` data mode. Keep a reference MRP separate from a
seller's current selling price. Unknown stock/ETA remains unknown.

Compare offers only for equivalent products/packs. Rank known costs honestly;
if shipping is unknown, do not claim the cheapest delivered order. A reference
price is not an all-India live quote. Fictional demo sellers must be labelled
fictional and must not impersonate a real pharmacy or show invented endorsements.

## Prescription, privacy and real-operation boundaries

- A prescription flag is catalog metadata, not professional approval. A file or
  checkbox cannot validate a prescription. Restricted/unknown products need a
  blocked or professional-review path, as agreed with the owner.
- Prefer no prescription upload for the first prototype. If needed later, private
  authorized storage, retention, inspection, file limits and pharmacist roles are
  separate work. [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
  is a technical starting point, not a pharmacy license.
- Shopping does not require transmitting chat history, allergies, diagnosis or
  the full profile. Recorded-medication search/reorder must be an explicit user
  action if selected; product visibility is not evidence of suitability.
- A live partner contract should settle catalog rights, exact SKU matching,
  serviceability, expiring quotes, prescription decisions, acceptance/decline,
  cancellations/refunds, webhook authentication, duplicate requests, support,
  privacy and settlement. A valid-looking pincode alone does not prove delivery.
- Keep review demo orders visibly simulated on catalog, checkout and history.
  Show real local events only; no timers pretending a pharmacy dispatched goods.

## Decision

Research favors a curated demo now and one approved partner later. It does not
select a provider, approve payments, settle jurisdiction-specific requirements,
or authorize coding. Owner answers in [the proposed plan](../features/MARKETPLACE.md)
will determine the first milestone.
