# MedAssist AI: initial repository assessment

For the current delivery status, decisions, and proposed feature queue, see
[ROADMAP.md](ROADMAP.md). This document retains the historical initial assessment;
its original findings should not be read as a current runtime checklist.

Reviewed on 2026-10-21 against baseline commit `6b2edfb` (local main and local
origin/main agreed). This is a source inspection, not an end-to-end certification.
Remote deployment status and the current remote head were not independently checked.

## Intent and source boundaries

The owner identifies this student project with SIH25049, "AI-Driven Public Health
Chatbot for Disease Awareness." The README describes a broader patient companion:
profile, chat, nearby care, and future marketplace/reminders/wearables/SOS.

The supplied 12-page `MedAssist_AI_First_Project_Review-1.pdf` describes
"An Explainable Multi-Agent Healthcare Chatbot." Its objectives emphasize query
understanding, specialized agents, trusted retrieval, verification, explainability,
uncertainty, escalation, and evaluation. Pages 10-11 propose safety routing before
LLM processing, a clarification loop, medical RAG, and evidence-supported output.
The methodology diagram was visually inspected as well as the extracted text.

The PDF is reference material, not an instruction to migrate the app. Its
Node/Express, LangGraph, Pinecone/Atlas, and Google Maps choices are proposals.
Page 10 explicitly leaves exact components to implementation. Literature-review
claims and bibliographic details have not been independently verified.

## What exists in source

"Implemented" below means code is present, not that live behavior passed testing.

| Area | Implementation and limits |
| --- | --- |
| Landing | Patient-monitor visual theme, demo vitals, mobile menu, scroll reveals. Much feature/security copy is aspirational. |
| Auth | Better-Auth Google OAuth, MongoDB adapter, seven-day sessions, JWT plugin, catch-all auth route. |
| Protection | proxy cookie check, server session verification in dashboard layout/onboarding and profile server actions; backend JWT dependency. |
| Profile | Onboarding/edit form; MongoDB upsert; age, gender, conditions, medications, allergies, incidents, emergency contact; dashboard summary. This is a local app profile, not an interoperable hospital EHR. |
| Conversations | Create/list/delete, first-message title, ownership helper, persistent messages, recent history, sidebar and resume UI. |
| Generation | Hand-written classifier -> retrieval -> Gemini streaming pipeline; no orchestration framework. |
| Urgency | LLM scores 1-5; score >=4 emits urgent and stops generation. UI pauses input and links to `/map`. No deterministic pre-LLM safety router. |
| Retrieval | Chroma `medical_kb`, Gemini embeddings, top-three document strings. Six self-written demo seeds; no ingestion of external PDFs or evidence citations. |
| Maps | Geolocation, five facility categories, Mapbox Search Box forward search, Mapbox markers/fly-to, Google Maps directions link. No in-app route computation, travel times, or guaranteed nearest/open ER. |
| SOS | Navbar button calls an alert explaining it is not wired up. No contact notification or dispatch. |
| Marketplace/reminders/wearables | Disabled dashboard tiles and navbar links; the three page routes are absent. No worker/provider integrations. |
| Reports/export | No lab-file upload/summarizer or doctor-profile PDF exporter. |
| Evaluation/operations | No automated tests, CI, agent evaluation harness, tracing stack, rate limiting, or background queue found. |

## Stack and ownership map

| Layer | Current source |
| --- | --- |
| UI | Next.js 16.2.12; React/React DOM 19.2.4; strict TypeScript; App Router; npm lockfile v3 |
| Styling | Tailwind v4 CSS theme, shadcn base-nova, Base UI primitives, lucide/react-icons; `cn` uses clsx/tailwind-merge |
| Next server | Better-Auth, native MongoDB driver, profile server actions |
| Python API | FastAPI, uvicorn, Motor, PyJWT crypto, pydantic-settings, dotenv, httpx; documented Python 3.13; unpinned requirements |
| AI | google-genai; chat `gemini-2.5-flash`, classifier `gemini-2.5-flash-lite`, embedding `gemini-embedding-001` configured in source; provider availability unverified |
| Retrieval | Embedded persistent ChromaDB, default path relative to backend working directory |
| Maps | mapbox-gl + react-map-gl; Mapbox Search Box; unused Google Maps React dependency remains |
| Hosting | README reports Vercel frontend and planned Render backend; deployment availability not checked |

Frontend routes are `/`, `/login`, `/post-login`, `/onboarding`, `/dashboard`,
`/profile`, `/chat`, `/chat/[conversationId]`, `/map`, and `/api/auth/[...all]`.

Key boundaries:

- `lib/auth.ts` owns Better-Auth and exports the native MongoDB handle.
- `lib/profile-actions.ts` owns profile persistence; `components/EhrForm.tsx`
  collects the input. Runtime validation is primarily client-side today.
- `lib/api-client.ts` fetches a JWT for JSON/streaming backend requests.
- `backend/app/main.py` configures CORS and registers ehr/map/chat routers.
- `backend/app/core/security.py` fetches JWKS and validates JWT signatures/expiry.
- `backend/app/routers/chat.py` owns conversation lifecycle, ownership, context,
  urgency branching, generation, and persistence.
- `gemini_client.py` owns model calls; `vector_store.py` owns retrieval;
  `ingestion/load_medical_kb.py` adds placeholder seed documents.
- `components/HealthMap.tsx` is imported by the map route. MapBox.tsx is a duplicate
  alternative; `mapbox_map.py` duplicates the active router but is not registered.
- `BackendTest.tsx` is a manual `/ehr/me` helper, currently not mounted by a page.

MongoDB collections managed by Better-Auth include user/session/account/
verification/jwks. App collections are patientProfiles (userId), conversations
(userId/title/timestamps), and messages (string conversationId/userId/role/
content/urgencyScore/createdAt). Conversation `_id` is an ObjectId serialized for
the browser. Preserve these relationships when planning changes.

## Current request flow

1. Google OAuth creates a session. Post-login checks profile existence and routes
   to onboarding or the requested destination/dashboard.
2. Browser requests a Better-Auth JWT, then calls FastAPI with a Bearer header.
   FastAPI verifies using public signing keys from the Next server.
3. Chat checks ownership, saves the user message, titles/timestamps conversation,
   loads the previous 20 messages, and reads selected profile fields.
4. Synchronous Gemini urgency call runs inside the async event generator. The
   score is persisted on the user message. Score >=4 emits urgent and returns.
5. Otherwise Chroma retrieves three strings; Gemini receives those plus age,
   gender, conditions, allergies, medication context and recent conversation.
6. Streamed text emits chunk events. Successful completion persists the assistant
   reply and emits done. The UI displays plain text and a persistent disclaimer.

The SSE format is `data: {"type": "chunk", "text": "..."}\n\n` (likewise urgent,
error, done); it does not use named `event:` fields. Preserve paired producer/
consumer behavior when changing it. The current urgent link opens the map's
default hospital category, rather than selecting ER automatically.

## Proposal gap

| Proposed capability | Current gap |
| --- | --- |
| Multi-agent state machine | No LangGraph, explicit agent state, checkpoints, or tools |
| Rule-based emergency bypass | Current first gate is a remote LLM call |
| Triage clarification loop | No explicit completeness evaluation or structured symptom state |
| Verified medical RAG | Demo seeds only; no provenance/metadata/citation pipeline or curated source process |
| Verification agent | No separate evidence/support/safety verification stage |
| Explainable answers | No evidence cards, citations, matched-symptom breakdown, or explicit uncertainty structure |
| Evaluation | No benchmark cases or measured accuracy, relevance, consistency, evidence quality, or safety results |

Explainability should mean concise evidence-supported rationale and limitations;
it does not require exposing a model's private internal reasoning.

## Findings to address in separately agreed work

These are observations and review targets, not changes made during workflow setup.

1. **Urgency failure policy:** malformed classifier output becomes 2; parsed
   scores are not range-checked. API exceptions occur outside the generation
   try/except. This is not a safe failure guarantee. No deterministic emergency
   gate exists. Priority behavior and expected tests need agreement.
2. **Health evidence:** retrieval returns text without citations or source metadata.
   The prompt requests non-diagnostic information but does not enforce claim-level
   support. Placeholder material cannot establish clinical reliability.
3. **Data/privacy claims:** selected health profile fields and history are sent to
   Gemini. No app-level E2E encryption or explicit sharing-consent workflow was
   found, despite landing-page claims. Real patient readiness is unestablished.
4. **Validation/security review:** profile server action trusts typed input without
   a runtime schema; backend accepts unconstrained message strings and map
   coordinates. JWT audience verification is disabled and issuer is not explicitly
   constrained. Review these against the actual Better-Auth token configuration
   before changes; no exploit testing was performed.
5. **Streaming/reliability:** synchronous classifier/embedding retrieval can block
   the async path. Disconnects, overlapping sends, partial generation failures,
   and history-switch races need behavioral tests. Errors cover generation only;
   retrieval/classifier failures do not produce the same structured error event.
6. **Environment drift:** backend example is zero bytes; root example omits the
   browser Mapbox token and uses medassist_db while backend defaults to medassistai.
   Mongo username/password/API-key example variables are not all consumed by code.
7. **Tracked generated data:** Python bytecode and Chroma binary/SQLite data are
   already in Git, and relevant backend ignore rules are missing. Adding ignore
   entries alone would not untrack them. Cleanup must preserve any needed data.
8. **Documentation drift:** README describes absent feature stub pages and an
   absent `ingestion.inspect_types` module. Its Gemini SDK incompatibility is a
   historical report, not a confirmed current runtime failure; dependencies are
   not installed here. Verify before prescribing an SDK fix.
9. **UI/product claims:** landing copy describes live wearables, reminders,
   automatic SOS, routes/travel time, and urgency "as you type"; implementation
   does not support these claims. Navbar links can target absent pages. Sidebar
   titles do not refresh after automatic title updates in the current flow.
10. **Operations:** no Python dependency lock or CI/test baseline. Frontend auth
    trusted origins and backend CORS are hard-coded. Production readiness needs
    separate validation, environment planning, and provider configuration.

## Verification performed and limits

- Inspected tracked application routes, components, server actions, auth bridge,
  backend modules, ingestion, configs/manifests, README, instructions, Git history,
  ignore rules, environment examples, and the complete supplied review PDF.
- Python AST syntax parsing passed for all 13 source files without importing code,
  contacting services, generating bytecode, or opening the persistent store.
- Checked manifest/lockfile agreement on Next.js 16.2.12 and React 19.2.4.
- No node_modules or backend/.venv exists in this checkout. Lint, TypeScript,
  build, backend imports, and live flows were not run. No credentials were read,
  dependencies installed, providers called, or stores reseeded for this review.
- No Next.js application code was written; the mandatory installed-guide rule
  is retained for future code work. The guides are unavailable until installation.
- Workflow setup changes documentation only. Existing README, app source,
  dependencies, configuration, binary data, and deployment settings stay unchanged.

## Decisions for the next conversation

1. Is the primary deliverable the PDF's explainable multi-agent public-health
   chatbot, with marketplace/reminders/wearables deferred, or a broader companion?
2. Keep Python/FastAPI and integrate orchestration there, or deliberately migrate
   to the PDF's Node/Express proposal? No choice has been implemented here.
3. Resolve the PDF's "identified health condition" language against the current
   non-diagnostic scope before implementing output schemas or prompts.
4. Agree a small next milestone, accepted evidence sources/licensing, evaluation
   cases, languages/users, demo constraints, and available provider budgets.
5. Decide whether to prioritize environment reproducibility and baseline tests
   before adding new AI behavior. Cleanup and clinical logic are separate tasks.

No next-phase architecture or feature implementation is authorized by this review
alone. Record the owner's answers here when decisions are made.

## Follow-up: conversation creation fix (2026-10-22)

Local startup exposed a missing default Python CA file: MongoDB operations failed
TLS certificate verification even though frontend sign-in worked. The backend now
uses certifi roots for TLS MongoDB connections, preserving non-TLS connections and
explicit URI CA files. certifi is an explicit backend dependency.

The conversation sidebar now shows load/create failures and disables the New
conversation button with a Creating label while its request is pending. Verified
in the signed-in browser: a failed request displays an error; after the backend
restart, creation returns HTTP 200 and opens the new conversation. This does not
establish that Gemini generation or the medical response pipeline works end to end.

## Follow-up: SOS implementation (2026-10-22, local feature branch)

The owner approved automatic contact email using Gmail, an active SOS screen,
location/selected health preview, nearby care, and call/WhatsApp fallbacks.
`codex/sos-assistance` adds protected `/sos`, an optional profile contact email,
authenticated FastAPI SOS routes, atomic latest-incident claims, bounded explicit
retries, and verified-TLS SMTP. Navbar and the existing urgent-chat link enter
SOS; urgency classification and chat generation contracts remain unchanged.
See [the feature record](features/SOS.md) for setup, data retention, validation
and limitations. Historical absent-SOS observations above apply to the original
baseline. Integration is tracked in [PR #3](https://github.com/SSY199/MedAssist-AI/pull/3); no clinical validation is claimed.

SOS follow-up: the owner confirmed email arrival and selected a cancellable
ten-second quick activation countdown. The same feature branch now adds
one-time opt-in sharing preferences, shared Navbar/urgent-chat activation,
cancellation guards and backend-enforced preferences. This does not add automatic
incident detection or alter the urgency classifier. See the feature record for
validation and remaining live-demo checks.

## Marketplace implementation follow-up (2026-10-23)

The original absent-marketplace inventory above is historical. Approved discovery
scope is now implemented locally on `codex/medicine-marketplace`: protected
`/marketplace`, manually searched curated medicine/supply metadata, reference MRP
provenance, seller product links, account-saved favourites. FastAPI registers
`marketplace.py`; `marketplaceFavorites` is a separate JWT-owned Mongo collection.
Eighteen reviewed source records now live in `backend/app/data/marketplace.json`; missing
prices/status remain explicit. No live feed, clinical advice, checkout, prescription
verification or profile-based recommendations. See [feature record](features/MARKETPLACE.md)
for contracts, checks and limits. Existing auth/profile/chat/map/SOS contracts remain
unchanged.

## Reminder implementation follow-up (2026-10-23)

The owner approved medication-only reminders with in-app + generic own-account
email, localhost first and no new paid services. `codex/medication-reminders` adds
protected `/reminders`, manual/explicit name prefill, calendar previews, Today/history,
Taken/Skipped/Snooze and schedule controls. FastAPI `reminders.py` and a standalone
Python worker use separate `medicationReminders`, `reminderOccurrences` and
`reminderWorkerState` collections; profiles/auth collections remain unchanged.
The existing Gmail sender is reused with a separate master switch and explicit
schedule consent to the server-verified account address. No Web Push, SMS, caregiver
alert, treatment inference or clinical alarm guarantee. See the
[feature record](features/REMINDERS.md) for current checks and local worker operation.

## Disease awareness implementation follow-up (2026-10-23)

Owner approved a signed-in dashboard awareness experience on
`codex/disease-awareness`: English/Hindi authored learning, an original interactive
courtyard scene, heart/BP/diabetes/TB/dengue topic exploration, evidence reveals,
bounded prepared Gemini questions, account progress/reset and curated official
report links. Four topic records cover heart/BP, diabetes, TB and dengue; this is
not an exhaustive global disease database or medical risk model.

`backend/app/data/awareness.json` is the single source bundle shared by Next and
FastAPI validation. New JWT-owned `awarenessProgress` and hashed `awarenessUsage`
counter records are separate from patient profiles/chat/reminders. The awareness
AI receives only a prepared question/language/topic evidence. Existing placeholder
Chroma retrieval and general-chat urgency/SSE are unchanged. WHO source attribution
and dates are visible; Hindi adaptations lack professional translation/clinical
review. No live surveillance integration or public landing rewrite. See
[delivery details](features/DISEASE_AWARENESS.md) for tests and limitations.

Awareness refinement: the dashboard now has a separate weekly-outbreak reader
above the care tools, with three curated original NCDC PDFs. Pinned PDF.js renders
pages in the app; a session-verified Next endpoint fetches only reviewed official
URLs with type/size/redirect restrictions. It does not interpret outbreaks as
personal/current local risk, translate original PDFs or automatically ingest the
archive. See the same feature record for verified periods and reader limitations.
