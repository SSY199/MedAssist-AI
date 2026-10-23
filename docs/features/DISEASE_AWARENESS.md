# AWR-01: disease awareness experience

Status: Revised proposal — owner choices recorded; final implementation agreement pending.
Date: 2026-10-23. Owner: Abhishek; no qualified content/clinical reviewer available.
Branch: `codex/disease-awareness`; base main `1ebb4a7`, reminders PR #5 merged.
Implementation/PR: not started. [Research and sources](../research/DISEASE_AWARENESS.md).

## Owner request and established boundaries

Build a distinctive, feasible disease-awareness experience aligned with the
owner's SIH25049 theme, prominent on home. Improve the sparse home experience.
Research through agents, propose a detailed plan and ask questions before coding.
Existing features and coding/visual conventions must be preserved.

Owner selected the signed-in dashboard, general public in India, English + Hindi,
one evidence-grounded AI interaction, account-saved learning with reset and a small
dated official-report section. Requested completion today (2026-10-23). The owner
has no specific experience design in mind and is open to scenes, topic exploration
and evidence reveals. Prioritize major global issues, then high-impact India topics.
These are product choices, not final approval of every implementation detail below.
No new provider, paid service, medical-data import or automatic publication is
proposed. Keep the current stack and preserve existing features.

## Revised first-release recommendation after owner answers

Combine the preferred directions as one dashboard experience: prominent interactive
learning, a topic explorer and inspectable evidence, supported by a modest report
section. A curated report snapshot is feasible today; live surveillance ingestion
is a different project. The scope below is a delivery target, not a guaranteed
same-day completion regardless of source review or validation failures.

1. Four initial topic modules: heart health/high blood pressure, type 2 diabetes
   prevention awareness (with clear distinctions from other diabetes types), TB,
   and dengue. This is a balanced editorial starting set, not a ranked list of all
   global burdens. Cancer, chronic respiratory disease, diarrhoeal disease, malaria
   and antimicrobial resistance remain expansion candidates.
2. Each module has a short overview, two or three authored decisions, one curated
   misconception, three takeaways and claim-linked evidence. One polished home/
   neighbourhood illustration is the flagship scene (dengue fits that visual
   interaction); other modules use accessible short situation cards. The explorer
   starts with global high-burden topics, independent of the visual hero's rotation.
3. English/Hindi switch across awareness controls, authored content and lesson
   feedback; source titles/language remain identifiable. Prefer official Hindi
   resources where available, including NCDC diabetes/hypertension FAQs. Any app
   adaptation/translation is labelled a student-prototype adaptation without
   professional translation or clinical validation. Do not imply official Hindi
   sources exist for every statement. Hindi text receives a separate consistency
   pass against the English claim map; do not generate published lessons live.
4. One AI action: prepared topic questions such as explaining a prevention point
   more simply, answered from that topic's evidence in the selected language.
   No open symptom textbox or automatic own-words grading in this version. Proposed
   bounds: one provider call per click, 20-second timeout, up to 180 words, five
   requests/minute and 30/day per verified user, with authored fallback. Validate
   source IDs and structured response; do not claim this proves medical correctness.
5. Saved learning completion/answers by topic and content version, continue/reset
   controls and no raw AI question/answer retention. Reset affects awareness data
   only. A completion indicator measures learning activity, never disease safety.
6. Two or three manually curated official report/resource cards, each with source,
   reporting period when relevant, publication date if known and reviewed date.
   Distinguish epidemiological bulletins from burden reports. Use neutral titles
   and visible stale/coverage notes; no live label, GPS, personal risk or case map.
   No automatic feed or new scheduled worker is needed for this version.
7. Home redesign composes awareness first, compact profile/utilities after it, and
   preserves existing SOS and reminder banner. Public landing stays outside this
   scoped dashboard release. Sharing, audio, extra languages and expanded content
   can follow on separate branches.

## Topic prioritization evidence

The [WHO NCD fact sheet](https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases)
identifies cardiovascular disease, cancer, chronic respiratory disease and diabetes
as major NCD groups; a disease-awareness home should not focus only on outbreaks.
[WHO hypertension](https://www.who.int/news-room/fact-sheets/detail/hypertension%E2%81%A0)
and [diabetes](https://www.who.int/news-room/fact-sheets/detail/diabetes) support
the first two proposed learning themes. The
[WHO Global TB Report 2025 factsheet](https://cdn.who.int/media/docs/default-source/global-tuberculosis-report-2025/global-tb-report-2025_factsheet.pdf)
supports TB's global importance, and the
[MoHFW TB programme update](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2203004&lang=2&reg=48)
provides India-specific context. Dengue supplies a practical prevention theme
using the researched WHO fact sheet. Mortality, incidence, prevalence and actionability
are different prioritization signals; do not combine them into an invented ranking.

The [NCDC education catalogue](https://ncdc.mohfw.gov.in/includes/Health_Information/generalpublic.php)
lists English and Hindi diabetes/hypertension FAQs. Their individual files, dates
and rights must be inspected before adaptation; a catalogue listing is not a
completed medical or translation review.

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

Confirmed placement: `/dashboard`, matching Navbar Home. Public `/` can receive
a separately agreed teaser later.

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

The revised first-release recommendation above supersedes the original candidate
topic list. Different types of topics need different templates; do not present
all as contagious diseases.

| Increment | Included | Gate |
| --- | --- | --- |
| 1: Source and visual prototype | Agreed topics, evidence schema, one complete scene, draft home layout | Owner reviews experience and example claims before broad authoring |
| 2: Core awareness experience | Bilingual home/topic explorer, scene/story, misconception, takeaway/evidence and curated report cards | Supported claims, accessibility and regression checks |
| 3: Narrow AI interaction | Prepared topic explanation, permitted evidence, quotas/timeout/fallback | Final limits/input policy and failure evaluation agreed |
| 4: Saved learning | Versioned progress, reset and continue learning | Data fields agreed; JWT ownership tests |
| Later separate feature branches | Automated reports, professional translation review/audio, generic share cards, public entry point, additional topics | Separate scope agreement |

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

All nine initial questions were answered. Confirmed owner choices are recorded at
the top. Remaining final agreement: four proposed themes, one illustrated flagship
plus short authored situations, bilingual student-prototype wording, prepared AI
question scope/limits, progress/reset and a curated dated report snapshot.
Ask one consolidated scope-approval question before coding. No automatic profile
targeting, GPS, emails or new services are part of that proposal.

## Research-stage validation

Three agents completed read-only work. Parent checked current dashboard/landing,
navigation, context/tracker and key official sources. Only planning documents
changed. Application tests are not applicable to this research-only update;
whitespace and local-document link checks passed before committing.
