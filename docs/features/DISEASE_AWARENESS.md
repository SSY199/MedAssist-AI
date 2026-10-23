# AWR-01: disease awareness experience

Status: Proposed — owner discussion and explicit implementation agreement pending.
Date: 2026-10-23. Owner: Abhishek; content/clinical reviewer not assigned.
Branch: `codex/disease-awareness`; base main `1ebb4a7`, reminders PR #5 merged.
Implementation/PR: not started. [Research and sources](../research/DISEASE_AWARENESS.md).

## Owner request and established boundaries

Build a distinctive, feasible disease-awareness experience aligned with the
owner's SIH25049 theme, prominent on home. Improve the sparse home experience.
Research through agents, propose a detailed plan and ask questions before coding.
Existing features and coding/visual conventions must be preserved.

No choice below is implementation approval. Audience, placement, topics and
languages are pending. India/general-public and signed-in dashboard are research
defaults only. No new provider, budget, medical-data sharing or autonomous content
publication is approved. Backend technology remains the current implementation
unless a later deliberate decision changes it.

## Recommended concept: Awareness Studio

Working name, changeable. Main experience: a short interactive scene/story where
users notice prevention opportunities, choose what to do, inspect the explanation
and source, and take away a practical action. The goal is learning and evidence
literacy, not diagnosis or personal risk assessment.

Illustrative first mission: a fictional household scene themed around dengue
prevention. A few labelled, keyboard-accessible objects reveal choices and
source-backed prevention explanations. This theme is proposed, not approved
content; all actual objects, claims and alternatives need source review.

User journey:

1. Home opens on a large featured scene and a clear short-mission invitation.
2. User explores three or four authored choices; a text-list equivalent is always
   available. No countdown or penalty for accessibility needs.
3. Each choice reveals a supportive explanation, supporting claim/source, and
   what to remember. No fabricated risk percentage or animated infection forecast.
4. One curated misconception asks the user to inspect evidence, with immediate
   correction/context; it never labels arbitrary internet claims true on demand.
5. A three-point prevention summary follows. Saving it is not proof of doing it.
6. Optional AI recap: explain a learning point in your own words, then receive
   bounded feedback linked to the reviewed points. Alternatively choose a prepared
   topic question. Feedback is fallible; static source-backed explanations remain.
7. If approved, save content-versioned progress and offer a later revisit based
   on questions, not health profile. Generic sharing is an optional user action.

This coherent loop is the proposed differentiator. Article search, animations,
badges and a second chat box by themselves are not the core outcome. No claim of
worldwide novelty or proven health benefit is made.

## Proposed home composition

Default recommendation pending answer: `/dashboard` first, matching Navbar Home.
Public `/` can later include an educational teaser or the same public content;
that choice affects auth/routes and needs agreement.

- Top: welcome + strong awareness hero, illustrated scene and one primary action.
- Supporting area: resume learning / one misconception / practical takeaway.
- Explore: a small topic collection grouped by understandable categories.
- Compact utility area: profile summary and existing chat/map/marketplace/reminder
  links, preserving access and their actual implemented status.
- Preserve SOS navigation and pending medication banner; use current theme tokens,
  readable body text, responsive layout and reduced-motion support.

Design a composed useful page rather than filling every gap. Start with a rough
layout review before full interactions, with synthetic user details for screenshots.
Do not redesign unrelated feature screens or rewrite the public landing wholesale
unless the owner chooses that scope.

## Proposed first release and later increments

Recommended initial content: three or four well-sourced topics. Candidate set:
dengue, TB, diabetes awareness and antibiotic awareness. Final set comes from
owner priorities and source-review feasibility. Different types of topics need
different templates; do not present all as contagious diseases.

| Increment | Included | Gate |
| --- | --- | --- |
| 1: Source and visual prototype | Agreed topics, evidence schema, one complete scene, draft home layout | Owner reviews experience and example claims before broad authoring |
| 2: Core awareness experience | Home composition, small topic explorer, scene/story, misconception, takeaway and evidence drawer | Supported claims, accessibility and regression checks |
| 3: Narrow AI interaction, if selected | Topic-bound recap or explanation, permitted evidence, quotas/timeout/fallback | Scope/input policy and failure/safety evaluation agreed |
| 4: Saved learning, if selected | Explicit interests, versioned progress, reset and later revisit | Data fields/retention agreed; JWT ownership tests |
| Later separate feature branches | Dated public-health bulletin explorer, reviewed translation/audio, generic share cards, public entry point | Separate decisions where not selected for AWR-01 |

The increments are checkpoints within a single agreed outcome, not authorization
for an oversized branch. If optional capabilities become independent outcomes,
finish/merge the core first and create fresh branches from updated main.

## Evidence and data design

Start with a version-controlled structured collection rather than a scraping
pipeline or admin CMS. Proposed schema:

```text
Topic: id, version, category, title, aliases, audience, language,
       summary, claims[], scenes[], misconceptions[], preventionSteps[],
       reviewedOn, reviewDue, reviewerRole, publicationStatus
Source: id, publisher, title, canonicalUrl, sourceDate|null,
        accessedOn, applicableRegion, reuseNotes
Claim: id, authoredText, sourceIds[], sourceSectionOrPage, reviewNotes
Scene: id, labelledObjects[], choices[], explanationClaimIds[], textAlternative
Progress (optional): userId, topicId, contentVersion, completedStepIds,
                     quizResponses, updatedAt
```

Dates have distinct meanings. Unknown source dates stay unknown. A local review
date does not mean a clinician reviewed it. Content expiry must be explicit; the
proposed behavior is withdraw expired interactive/AI material and show source links
with a review-needed explanation until a new version is approved.

Source priority: applicable Indian government guidance, WHO topic information,
permitted MedlinePlus topic summaries; resolve conflicts by relevance/date and
human review, not automatic source counting. Check each item's reuse rights.
Official names are source attribution, not partner/endorsement badges.

Do not include real-time disease-risk maps in the first version. NCDC reports and
WHO DON can support a later dated bulletin view; incomplete or old reporting
cannot establish current local safety. No disease probabilities or case counts
are invented to decorate the dashboard.

## Integration proposal

Keep Next.js 16 / React / Tailwind / Base UI and Python FastAPI. Read installed
Next guides before code changes. Proposed paths, subject to implementation review:

- `backend/app/data/awareness.json`: reviewed topics, sources and claim mappings.
- `backend/app/services/awareness_catalog.py`: schema validation and deterministic
  topic/search selection following the existing catalog pattern.
- `backend/app/routers/awareness.py`: content and optional JWT-owned progress APIs.
- `backend/app/services/awareness_answers.py`: optional bounded Gemini interaction.
- `lib/awareness.ts`, `components/AwarenessHome.tsx` and focused scene/evidence UI.
- `app/(dashboard)/awareness/` and dashboard composition; Navbar/main registration
  and proxy matcher reviewed only as required for the agreed access model.

Static/curated learning must not require a model call. Choose a single source of
truth and a validated frontend-safe projection/build artifact if home must render
without FastAPI; do not maintain two hand-edited copies. Final delivery choice
depends on public-versus-authenticated placement and offline expectations.

Preserve existing profile, conversation ownership, SSE, urgency behavior, SOS,
marketplace and reminder worker. No Chroma migration/reseed, backend replacement,
new messaging consent, automatic emails or provider signup is required.

## Optional AI policy to agree

- No automatic provider call on dashboard render or arbitrary internet browsing.
- Server selects one reviewed topic bundle; strict input/output lengths, a single
  call, timeout, rate limit and per-account quota. Exact limits set before coding.
- Sources are untrusted data; instructions inside them or user text cannot alter
  the contract. Model returns approved IDs; server creates links from known URLs.
- Existence of a citation does not prove support. Test unsupported claims and
  review outputs; use authored text for critical prevention/seek-care statements.
- No profile/history/GPS import. Explain clearly if free text is sent to Gemini;
  propose avoiding storage of raw recaps/questions. Learning progress is separate.
- Out-of-scope or unsupported questions return an honest limitation and relevant
  authored content. Provider error/malformed output never becomes invented advice.
- Personal symptoms/diagnosis/treatment requests need an explicit scoped handling
  policy before allowing free text. Existing urgency/SOS rules remain unchanged;
  this education feature must not become an unreviewed clinical triage flow.
- Prepared question chips reduce first-release scope. An own-words recap is more
  distinctive but still accepts free text and needs the same boundary review.

## Acceptance and evaluation plan

1. Every displayed health assertion, choice explanation and answer key maps to
   applicable reviewed evidence. No orphan IDs, invented dates or implied endorsement.
2. One full learning journey works with Gemini unavailable; unsupported questions,
   expired content and missing sources have useful, visible fallbacks.
3. Scene has keyboard/text alternatives, mobile layout, screen-reader labels,
   readable contrast and reduced motion; no colour-only answers or forced timers.
4. AI tests cover evidence gaps, source injection, URL/ID fabrication, personal
   symptoms, treatment requests, malformed JSON, quota and timeout failures.
5. Progress, if approved, is JWT-owned with synthetic cross-user/persistence/reset
   cases. No existing medical/auth collections are changed for ordinary verification.
6. Home keeps existing utility paths, SOS and reminder banner working; no secrets
   or profile context appear in awareness payloads or screenshots.
7. Apply contributor checks: focused Python/Node behaviors, AST, lint, strict
   TypeScript, production build, diff/link review and manual synthetic UI journey.
8. Record small usability observations: can someone explain one takeaway, find
   its source and complete the scene? Optional delayed revisit measures recall.
   Record actual sample/latency/failure results; no invented clinical accuracy.

## Discussion questions and approval gate

Asked asynchronously: (1) dashboard/public/both, (2) audience/language, (3) deadline
and owner's own example/idea, (4) preferred flagship, (5) first topics, (6) AI now
or later. Await answers; no silent assumption turns proposals into requirements.

Also asked: (7) account progress/reset or session-only, (8) availability of a
qualified content reviewer, (9) bulletins now versus later. User-triggered generic
sharing remains optional discussion scope. Avoid automatic profile targeting, GPS, email or
additional languages without agreement. We will rewrite this plan around the
chosen scope, confirm acceptance cases and obtain explicit coding approval.

## Research-stage validation

Three agents completed read-only work. Parent checked current dashboard/landing,
navigation, context/tracker and key official sources. Only planning documents
changed. Application tests are not applicable to this research-only update;
whitespace and local-document link checks passed before committing.
