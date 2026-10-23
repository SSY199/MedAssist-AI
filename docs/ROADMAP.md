# MedAssist AI: delivery tracker and next-phase discussion

Updated: 2026-10-23. Current baseline: main `1ebb4a7`, after reminders PR #5.
This is the current delivery tracker. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
preserves the initial source assessment and architecture details.

## Confirmed working baseline

| Capability | Evidence and remaining limits |
| --- | --- |
| Google sign-in, onboarding/profile, dashboard | Present in source; owner confirmed sign-in works. This is an app profile, not a hospital EHR integration. |
| Conversation creation, listing, history/resume | Fixed and browser-verified; synthetic API tests also verified persistence and ownership isolation. |
| Gemini chat and streaming | Owner confirmed chat works. Integration checks used mocked Gemini responses; no clinical correctness claim. |
| Urgency alert | Existing model-based score >=4 pauses chat. Synthetic API tests verified urgent termination; no deterministic emergency gate yet. |
| Basic RAG | Chroma retrieval with six self-written demo documents; no verified medical corpus or user-facing citations. |
| Nearby-care map | Owner confirmed maps work; live API test returned hospital results. No guaranteed live hours, nearest-ER routing, or computed travel times. |
| Workflow documentation | PR #1 merged. Shared agent rules, contributor guide, and initial assessment exist. |
| Conversation reliability fix | PR #2 merged. TLS certificate roots and creation loading/error feedback added. |
| Local setup and deployment | Dependencies installed; frontend production deployment succeeded. FastAPI was verified locally; hosted backend deployment is not established. |
| Runtime data isolation | Hash-verified snapshot and recovery stash retained locally; ignored backend environment selects a separate active local Chroma store. Original binary data is still tracked historically. |

Ad hoc validation scripts passed for TLS configuration, auth endpoints, ownership,
SSE/persistence, urgent termination, provider errors, and Mapbox. These are not yet
a committed regression suite or CI test pipeline. Lint has one existing unused
Badge import warning. Neither these checks nor a successful demo validate clinical use.

## Agreed collaboration rules

- One independently reviewable feature or maintenance outcome per branch/PR.
  Its UI, API, schema, tests, and documentation may belong together when they
  deliver that same outcome. Separate unrelated fixes and infrastructure work.
- Start from freshly fetched, updated main with a clean working tree. Avoid
  stacked feature branches unless dependencies and their merge order are explicit.
- Record a feature ID, expected behavior, exclusions, dependencies, acceptance
  checks, and branch before implementation. Confirm scope in discussion first.
- For every feature: read current context -> prepare the plan -> ask scope
  questions -> obtain explicit agreement -> implement -> verify -> review.
  Follow existing coding and visual conventions consistently throughout.
- Work on one active feature at a time by default. Check shared-file overlap with
  collaborators before implementation and again before integration.
- Review the full diff, run relevant checks, and inspect deployment results before
  merging. Do not silently bypass failed checks or force-push shared history.
- Pushing and merging follow the owner's authorization for that task. The previous
  authorization to merge PRs #1/#2 is not blanket approval for future features.
- Update this tracker with status, decision changes, verification limits, and PR
  links in the feature's own branch. Do not mark work Done until merged and verified.
- Keep credentials, private records, local stores, and backups out of commits.

## Next review priorities: agreed on 2026-10-22

The owner has a project review on 2026-10-23 and wants visible companion features:
SOS, marketplace, and medication reminders. SOS is first. No additional language
requirement was specified; English copy and the existing design should stay
consistent. The owner selected marketplace after SOS; reminders remain queued.

| ID | Feature | Current status | Scope record |
| --- | --- | --- | --- |
| SOS-01 | Automatic contact email and SOS assistance | Implemented and checked; integration tracked in [PR #3](https://github.com/SSY199/MedAssist-AI/pull/3) | [Detailed SOS plan](features/SOS.md) |
| MKT-01 | Medicine/health marketplace | Implemented and validated; integration tracked in PR #4 | [Marketplace delivery record](features/MARKETPLACE.md) |
| REM-01 | Medication reminders | Merged in [PR #5](https://github.com/SSY199/MedAssist-AI/pull/5); frontend deployment passed; hosted worker deferred | [Reminder delivery record](features/REMINDERS.md) |
| AWR-01 | Disease awareness home experience | Owner-approved version implemented locally; validation recorded; not pushed/merged | [Awareness delivery record](features/DISEASE_AWARENESS.md) |

No claim is made that all three features can be completed by the review. Complete
and verify one compact outcome before starting the next branch. Focused tests
belong with SOS; a separate testing-infrastructure project is not a prerequisite
for this review milestone.

## Longer-term chatbot direction: earlier proposal

An informational health chatbot that can ask useful follow-up questions, identify
high-risk input early, retrieve attributable evidence, and present concise answers
with sources, uncertainty, and appropriate escalation. A repeatable demo should
show which steps ran and where supporting information came from.

Explainability means evidence and a short understandable rationale, rather than
disclosing private internal model reasoning. Multi-agent orchestration should
coordinate defined responsibilities; it is not by itself proof of reliability.

The sequence below is a proposal, not approval to begin implementation. No
framework migration, medical rule set, source licensing, deadline, or budget is
selected by this document.

## Longer-term proposed feature queue

| ID | One outcome per branch | Acceptance criteria to refine before starting | Depends on | Status |
| --- | --- | --- | --- | --- |
| M01 | Committed regression baseline | A documented command runs isolated tests for existing conversation ownership, SSE success/error/urgent branches, and TLS options; external services mocked by default; no clinical accuracy claims. | Agreement on minimal runner | Proposed |
| F01 | Emergency routing before model calls | Agreed high-risk cases reach the existing alert before Gemini/retrieval calls; ambiguous, negated, historical, and provider-failure cases have explicit expected behavior; every turn passes the gate. No claim of complete emergency detection. | M01; reviewed policy and language scope | Proposed |
| F02 | Curated knowledge-source ingestion | A small agreed topic set has source URLs/titles, publisher, version/date, reuse terms, stable document/chunk IDs, and reproducible ingestion into a separate target store. Existing data is preserved. | Source/topic approval | Proposed |
| F03 | Answers with attributable citations | Answers link only to the source IDs supplied by retrieval; evidence is associated with the answer rather than simply listing everything retrieved; missing evidence produces an agreed limitation/abstention response; metadata survives history/resume. | M01, F02 | Proposed |
| F04 | Structured clarification flow | Incomplete supported queries produce focused follow-ups; answers update conversation state across reloads without crossing users; follow-up count is bounded; the emergency gate still runs first. | M01, F01; agreed supported topics | Proposed |
| F05 | Response verification stage | An explicit evidence/safety check evaluates a draft, handles unsupported claims, and has bounded revision/failure behavior. Tests cover insufficient and conflicting evidence. | F01, F03 | Proposed |
| F06 | Explicit multi-agent orchestration | Agreed stages become separately testable roles with typed shared state, bounded transitions, privacy-conscious traces, and preserved UI/auth contracts. Backend/framework selection is documented first. | Approved architecture; F01/F03/F04/F05, or resequence if the next review requires orchestration earlier | Proposed |
| F07 | Repeatable evaluation report | A versioned synthetic case set reports relevance, citation support, uncertainty, escalation behavior, consistency, and latency. Results and limitations are recorded without invented accuracy numbers. | Agreed evaluation rubric; grows alongside the preceding features | Proposed |

Earlier proposed order: M01 -> F01 -> F02 -> F03 -> F04 -> F05 -> F06 -> F07.
This does not override the owner's SOS-first review priorities above.
F02 can be researched while F01 is discussed, but implementation remains one
active feature at a time. Evaluation cases should be written with each feature;
F07 packages the results rather than delaying evaluation until the end.

Suggested branch names: `codex/regression-baseline`, `codex/emergency-routing`,
`codex/curated-knowledge`, `codex/chat-citations`, `codex/clarification-flow`,
`codex/response-verification`, `codex/agent-orchestration`, and
`codex/evaluation-report`. These branches have not been created.

## Other scope: not scheduled

Wearables, lab report upload/summarization, doctor-profile export, multilingual
support, and hosted-backend deployment remain candidate work. Their priority is undecided.
Do not imply their pages/integrations already exist.

Separate maintenance candidates: dependency locking, untracking generated data
after preserving it, environment-template accuracy, privacy/consent design,
request validation, and font-build reproducibility. Prioritize each deliberately;
do not bundle this list into a feature branch.

## Decision log

| Date | Decision | State |
| --- | --- | --- |
| 2026-10-22 | One feature/task per branch, compact scope, ongoing written tracking | Agreed by owner |
| 2026-10-22 | Keep backend choice open; PDF's Node/Express proposal does not authorize migration | Agreed by owner |
| 2026-10-22 | Discuss and agree next-phase scope before implementation | Agreed by owner |
| 2026-10-22 | Focus next phase on evidence-backed chatbot capabilities | Earlier proposal; postponed behind owner's review priorities |
| 2026-10-22 | Start with a committed regression baseline, then emergency routing | Earlier proposal; SOS first for the review |
| 2026-10-22 | Prioritize SOS, marketplace, and reminders; start with SOS | Agreed by owner |
| 2026-10-22 | Next review is tomorrow, 2026-10-23; keep language/style consistent | Confirmed by owner |
| 2026-10-22 | Write detailed SOS plan, ask questions, and agree before implementation; repeat this process for future features | Required by owner |
| 2026-10-22 | SOS contact channel: call + user-sent WhatsApp | Selected by owner |
| 2026-10-22 | SOS demo on laptop localhost; public/mobile support later | Selected by owner |
| 2026-10-22 | Preselect location and health summary in the sharing preview | Selected by owner; user still reviews before sharing |
| 2026-10-22 | Automatic email after confirmed SOS activation, with active incident status and fallback actions | Approved by owner |
| 2026-10-22 | Use existing Gmail account as SOS sender via server-only SMTP app password | Selected by owner; local TLS/login verification passed without sending |

Open questions: subsequent reminder scope and catalog expansion; longer-term target users and
languages; supported topics and source approval; provider budget; privacy
expectations; backend/orchestration choice; who reviews medical rules/evidence;
and which tasks the collaborator owns. SOS automatic-email scope is approved.

## Feature record to complete when scope is agreed

```text
ID / feature:
Owner / reviewer:
Status: Proposed | Ready | In progress | In review | Blocked | Done | Deferred
Outcome and user-visible behavior:
Included / excluded:
Dependencies and open decisions:
Acceptance cases and validation plan:
Branch / base commit:
PR / merge commit:
Checks run and results:
Remaining limitations / next action:
```

Ready means scope and acceptance cases are agreed. In review means a PR exists;
it does not imply approval. Done means merged with relevant verification recorded.
Planning records remain on `codex/next-phase-plan`. SOS implementation is on
`codex/sos-assistance`, created from main `d1ca817` with its associated planning
records carried into the feature. SOS integration and deployment status are tracked in [PR #3](https://github.com/SSY199/MedAssist-AI/pull/3);
the separate planning branch remains preserved.

### SOS follow-up (2026-10-22)

Owner confirmed email arrival and requested a shorter activation flow, selecting
a cancellable countdown over another confirmation button. Ten-second countdown
implemented on the existing SOS branch with explicit one-time opt-in, saved sharing
choices, direct Navbar/urgent-chat access, bounded GPS, cancellation, consent
revalidation and active-incident status. Automatic detection remains out of scope.
No additional live alert was sent during agent verification.

### SOS integration

The owner authorized merging SOS into main. [PR #3](https://github.com/SSY199/MedAssist-AI/pull/3)
contains the feature and its associated planning records. Final local validation:
production build, TypeScript, lint with the pre-existing Badge warning, 22 Python
tests and six Node tests passed. Its live merge/deployment state is authoritative
on GitHub. Backend hosting and production Gmail setup are separate from the
frontend deployment check. SOS merged at `0accec1`; Vercel frontend production deployment passed. Marketplace application code and reminders remain unstarted.

### Marketplace research (2026-10-22)

The owner selected marketplace next, explicitly requested a research subagent,
a detailed plan and 5–10 questions before implementation. Created
`codex/medicine-marketplace` from freshly fetched main `0accec1`.
[Research](research/MARKETPLACE.md) compares demo commerce, provider handoff,
commercial pharmacy APIs, ONDC and owning fulfillment. The
[proposed plan](features/MARKETPLACE.md) recommends an explicit demo now and a
contracted partner later, pending ten owner decisions. No application code,
provider account, purchase, catalog ingestion or deployment has been changed.

### Marketplace scope answers (2026-10-23)

Owner selected a medicine/health-supply finder with price information, saved
favourites and redirection to sellers. No selling/cart/checkout/payment/address
collection, lab tests or automatic profile use. No partner/API access is available.
The initial demo-order proposal is superseded. Updated
[feature plan](features/MARKETPLACE.md) proposes authenticated Mongo favourites,
manual search, medicine details and verified seller links. Reference pricing versus
live comparison, curated versus comprehensive coverage and final plan approval
are pending. Application implementation has not started.

### Marketplace implementation (2026-10-23)

Owner approved reference MRP with source/date, seller price checks, curated coverage
and implementation. Added protected catalog search/details/filtering, seller links
and authenticated account favourites on `codex/medicine-marketplace`. Ten sourced
products; no live price/stock feed or exhaustive database. No cart, checkout, payment,
address, lab or automatic profile use. See [delivery details](features/MARKETPLACE.md).

Checks: 32 Python tests, eight Node tests, TypeScript and production build passed.
Lint has only the existing unused Badge warning. Local backend restarted; health
200 and unauthenticated marketplace 401. Browser verified authenticated catalog and favourites reads, ingredient/no-match search,
product details and Escape dismissal. Save/unsave/ownership/persistence were tested
with synthetic accounts and mocked Mongo only. No live account write, retailer
transaction, narrow viewport or second live-account test was performed.
Marketplace has not been pushed or merged. Reminders remain queued for a separate
planning discussion/branch.

### Marketplace category expansion (2026-10-23)

Owner requested broader categories. Added eight source-reviewed entries, bringing
the current catalog to 18 products across 16 categories. Existing 12-item pagination
now spans two pages; all categories remain searchable/filterable. Kept original IDs,
favourites and implementation contracts. Source/date and pricing decisions are
recorded in the [feature tracker](features/MARKETPLACE.md). Not pushed or merged.

Browser expansion check: 18-product count, all 16 category options, second-page
products and a Thyroid medicines filter passed. No saved account data was changed.

### Marketplace integration (2026-10-23)

Owner authorized merging. [PR #4](https://github.com/SSY199/MedAssist-AI/pull/4) contains the completed
18-product marketplace and its research/scope/validation record. GitHub reported
no conflicts with updated main. Vercel preview and required checks gate merge;
the PR records final merge and deployment state. CodeRabbit skipped its review.
Earlier “not pushed/merged” notes are historical pre-integration snapshots.

### Reminders research and planning (2026-10-23)

Marketplace PR #4 merged at `a5e2b07`; Vercel preview and production passed. Local
main was clean and synchronized. Started `codex/medication-reminders` from freshly
fetched origin/main for the next feature's research/planning.

Owner requested deep research, integration options, proposed reminder contents and
a question set, with plan agreement before coding. [Research](research/REMINDERS.md)
compares in-app, browser notifications, email, Web Push, SMS/WhatsApp and calendar
export, including worker/hosting limits. [Draft plan](features/REMINDERS.md) proposes
account-owned medication schedules, per-occurrence actions/history and a durable
worker, conditional on the owner's choices. Ten questions were presented. No app
code, DB records, environment, service subscriptions or messages changed.

### Reminder scope answers (2026-10-23)

Owner chose medication-only reminders with in-app + email delivery, localhost first,
one-time/daily/weekday schedules, Taken/Skipped/Snooze/history, recent catch-up,
optional explicit profile/marketplace name prefill, generic external content and no
new paid services. Deadline/demo question was clarified. The revised
[plan](features/REMINDERS.md) proposes concrete lateness/snooze/timezone defaults and
existing Gmail sender reuse; final agreement is pending before implementation.
No application, DB, environment or provider changes.

Owner subsequently confirmed the proposed close-tab/email/reopen/mark-Taken demo.
No specific deadline was stated. Final timing/sender/implementation agreement remains
pending; no need to repeat the initial question set.

### Reminder implementation approval (2026-10-23)

Owner approved the final medication reminder plan, timing rules and Gmail reuse.
Implementation is on `codex/medication-reminders`; UI/API/worker and synthetic tests
are in place. No new dependency/provider signup or public deployment. Worker runs
separately from FastAPI. Current validation and operational limits are recorded in
the [feature record](features/REMINDERS.md); owner authorized a single synthetic own-account test email; SMTP accepted once
while the agent-created test tab was closed. Receipt has not been verified.

### Reminder local delivery verification (2026-10-23)

Implemented the agreed version and validated 56 Python tests, 11 Node tests, strict
TypeScript, production build, AST and documentation/diff checks. Lint retains one
existing Badge warning. Owner authorized a labelled synthetic live schedule; worker
submitted one generic email (SMTP accepted once) while the agent test tab was
closed. Taken/history persisted after reload; Stop preserved history. The stopped
synthetic record remains for inspection. Inbox delivery is not established.

Local API/worker are running. Only new reminder collections/indexes and ignored
local sender switch were introduced; no dependency upgrades or public deployment.
Not pushed/merged; branch `codex/medication-reminders`. See
[feature record](features/REMINDERS.md) for operations and remaining limits.

### Reminder timing visibility (2026-10-23)

Owner confirmed the 08:00 email arrived within about a minute. Read-only metadata
showed worker pickup about 14 seconds after due time; no refresh-dependent email
bug was established. Added refresh-on-tab-return, last refresh display, actual
worker/submission/result timing fields and private-data-safe timestamped worker
errors. Polling and delivery policy are unchanged. The inspected schedule remains
paused. All 59 Python and 12 Node tests, TypeScript and build passed; lint retains
the pre-existing warning. See the [feature record](features/REMINDERS.md) for
evidence and limits. Remains on `codex/medication-reminders`, not pushed/merged.

Reminder banner follow-up: clarified that viewing does not acknowledge a dose;
Taken/Skipped/Snooze remain explicit. Added immediate count refresh after mutations
and on navigation, preserving pending history and delivery behavior.

### Reminder integration (2026-10-23)

Owner approved pushing and safely merging the completed feature. [PR #5](https://github.com/SSY199/MedAssist-AI/pull/5)
contains medication schedules, generic own-account email worker, explicit actions,
history and timing/banner follow-ups. Remote main matched the original feature
base at preparation. Merge is gated on current PR mergeability and deployment
checks. Earlier not-pushed/merged notes are historical snapshots.

Hosted automatic email is deferred until server deployment. This PR keeps the
local worker setup; a frontend deployment alone does not provision a scheduler.
The feature record documents validation evidence and remaining runtime limits.

### Disease awareness research (2026-10-23)

Reminder PR #5 merged as `1ebb4a7`; Vercel preview/production passed and local main
was synchronized/clean. Hosted reminder email remains deferred until backend
deployment. Started `codex/disease-awareness` from freshly fetched main.

Owner requested a standout disease-awareness feature prominent on home, explicit
research agents, deep data/integration research and joint planning before coding.
Three read-only workstreams covered engagement, official sources/rights and repo
integration. [Research](research/DISEASE_AWARENESS.md) recommends interactive
authored scenes/stories, evidence reveals and practical takeaways, with optional
bounded AI recap. No verified live public district API was established.

[Proposed plan](features/DISEASE_AWARENESS.md) records visual placement, phases,
evidence schema, integration, AI/data boundaries, validation and open decisions.
Nine scope questions were presented; answers and implementation agreement
are pending. No application code, store, environment, provider or service changed.

### Awareness owner answers and revised scope proposal

Owner selected `/dashboard`, India general public, English + Hindi, a same-day
target, one evidence-grounded AI interaction, account-saved progress/reset, and a
small dated official-report section. No qualified content reviewer is available.
The owner is open to scenes plus topic exploration/evidence and prioritizes major
global issues followed by India-relevant high-impact topics.

Revised [plan](features/DISEASE_AWARENESS.md) proposes four themes (heart/BP,
diabetes awareness, TB, dengue), one illustrated flagship plus short situations,
prepared AI questions with bounded calls, bilingual prototype content and curated
report snapshots. No live surveillance or automated health-profile targeting.
Final consolidated scope approval is pending before coding. Documentation only.

### Awareness implementation approval and local delivery

Owner approved proceeding after the consolidated scope check. Implemented on
`codex/disease-awareness`: redesigned signed-in home with an original courtyard
scene, four English/Hindi topics, 12 evidence-linked learning decisions, prepared
Gemini explanations, JWT-owned saved progress/reset and two official reports plus
one explicitly dated/limited archive resource card. No public landing redesign,
profile targeting, live surveillance feed or new paid service.

80 Python and 15 Node tests, TypeScript and production build passed; lint retains
the existing Badge warning. Browser verified the desktop lesson/correction and
Hindi AI; a fictional lesson's completion remains in the signed-in learning
progress. Quota, reset and account isolation use synthetic tests. No professional
clinical/translation review or mobile viewport test. Full architecture, provenance,
operational constraints and verification are in the [feature record](features/DISEASE_AWARENESS.md).
Not pushed or merged; await owner review/integration request.

### Embedded weekly outbreak reports

Owner requested a separate weekly section immediately above the dashboard care
tools. Added three source-checked official report selections and an in-app PDF.js
reader with navigation, zoom, text search/view and optional download. General
report cards remain separate. Native browser embed was tested and replaced after
it stayed blank. Same-origin PDF delivery verifies the session and allows only
reviewed NCDC files with size/type/redirect limits. No live feed or current-risk
inference. The report period and file-modified dates remain separate, including a
note for the original Week 34 cover's inconsistent badge. Validation: 81 Python,
19 Node tests, TypeScript/build and browser report interactions; lint retains the
existing Badge warning. See [feature record](features/DISEASE_AWARENESS.md).

### Official weekly archive expansion

Owner approved replacing the three-report browsing limit with official year/week
discovery. The dashboard now lists NCDC's available years and matching PDFs, keeps
source gaps, and reads selected originals in the existing viewer. A session-verified
listing endpoint uses fixed source paths, strict filenames, bounded fetches and a
one-hour per-process cache; outages show labelled stale data or reviewed fallback.
No period/review claims are inferred for newly discovered reports.

Live checks found 18 year folders (2009–2026), 34 reports for 2026, 52 for 2025 and
27 for 2009; both historical PDFs rendered in-app. All 27 Node helper tests,
TypeScript and production build passed; lint retains the existing Badge warning.
Unsigned listing requests return 401. No Python, patient data, learning progress,
email or worker changes. Still local to `codex/disease-awareness`, pending review.
