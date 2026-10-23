# Disease awareness: research and design options

Researched 2026-10-23. Status: research, not approved implementation.
Branch: `codex/disease-awareness`, base main `1ebb4a7` (reminders PR #5).
Owner explicitly requested research agents, a distinctive feasible experience,
prominent home placement, questions and joint planning before coding.

Three research workstreams covered engagement/learning, official data/rights, and
read-only repository integration. No application code, data ingestion, provider
subscription, profile use, external message or deployment was authorized here.

## Product conclusion

Recommend an interactive awareness experience that connects noticing, choosing,
understanding evidence and remembering a useful action. A news feed alone can
increase exposure but does not demonstrate understanding. The design recommendation
is an inference from communication guidance; neither its uniqueness worldwide nor
its effectiveness in this population has been established.

Ranked options:

| Experience | Value | Feasibility and decision |
| --- | --- | --- |
| Illustrated scene + short branching situation | Tangible visual demonstration; users practise noticing prevention opportunities | High with a small authored scene and reviewed explanations; recommended flagship |
| Myth-to-evidence challenge | Makes sources inspectable and addresses misconceptions | High with curated claims; include within lessons rather than unrestricted automatic fact-checking |
| Own-words recap / teach-back adaptation | Reveals gaps and allows a more interesting AI interaction | Medium; source-bounded feedback must be evaluated, with non-AI fallback |
| Chosen-interest learning path and revisit | Gives users a reason to return | High if based on lesson progress, never inferred disease risk |
| Generic prevention card sharing | Extends reach beyond the app | High if user-triggered and sourced; no automatic messaging |
| Official public-health bulletin explorer | Shows real public-health context | Medium; dates, reporting gaps, geography and manual extraction matter |
| Live local outbreak radar / disease prediction | Attractive visual promise | Not supported by the public integrations verified; defer |
| Endless generated health lessons or automatic medical fact checker | Quick variety | Weak auditability and support; not the recommended first release |

## Learning and communication evidence

- [WHO communication principles](https://www.who.int/about/communications/principles)
  recommend accessible, actionable, credible, relevant, timely and understandable
  communication. This informs our editorial criteria, not proof of app outcomes.
- [WHO understandable communication](https://www.who.int/about/communications/understandable)
  supports familiar language, stories and visuals tied to a clear message.
- [HHS actionable content](https://odphp.health.gov/healthliteracyonline/create-actionable-content)
  includes practical action steps and interactive graphics/checklists. Its full
  guide also covers governance, small-screen testing and accessible presentation.
- [CDC Clear Communication Index](https://www.cdc.gov/ccindex/tool/how-to-use.html)
  provides a review framework for audience, message, language, visuals and evidence
  limits. We should use it to review drafts, not claim CDC approval.
- [AHRQ teach-back](https://www.ahrq.gov/health-literacy/improve/precautions/tool5.html)
  asks people to explain information in their own words. The original setting is
  healthcare communication; automated awareness feedback is an adaptation needing
  evaluation. Use supportive wording rather than a pass/fail judgement of people.
- [Retrieval practice experiment](https://doi.org/10.1126/science.1152408)
  supports revisiting learned material in general learning. It does not establish
  a clinical benefit or an optimal revisit interval for this app.
- [Accuracy-prompt experiments](https://www.nature.com/articles/s41467-022-30073-5)
  studied sharing discernment, largely with US samples and sharing intentions.
  This motivates testing evidence attention; it does not validate an Indian
  health-misinformation intervention.
- [W3C clear content guidance](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/)
  informs short blocks and clear choices. Scenes need equivalent labelled text,
  keyboard access, reduced motion and no time pressure or colour-only cues.

Evaluate whether users can explain one prevention action and find its source,
not only whether they clicked through a lesson. Immediate and later questions
can measure learning in a small usability exercise; never describe that as
clinical validation, measured disease prevention or a health protection score.

## Official data: verified suitability and access limits

| Source | Useful role | What was verified / what remains uncertain |
| --- | --- | --- |
| NCDC / MoHFW / NCVBDC education | India-specific prevention and awareness context | Public resources exist; check individual age, rights and applicability rather than trusting website modification time |
| WHO disease fact sheets | Topic explanations and source-backed prevention statements | Public pages available; individual publication/licence checks remain necessary |
| MedlinePlus health-topic XML | Structured summaries, topic vocabulary and further reading | Documented web service/bulk XML; example API request success was not established in the research browser |
| NCDC / IDSP weekly reports | Dated reported-event context | Public archive/PDF links; not a live prevalence or risk service |
| WHO Disease Outbreak News | Selected international public-health events | Public pages; explicitly non-exhaustive, unsuitable for complete local coverage |
| IHIP | Potential future institutional integration | Documentation covers authorized facility use; no supported anonymous district API established |
| WHO statistics | Historical burden education | Legacy API/deprecation notices require a fresh endpoint-specific integration check |
| NHS syndication | Possible later supplementary source | Registration/terms and UK localization add work; unnecessary for first release |

Primary references:

- [NCDC general-public education resources](https://www.ncdc.mohfw.gov.in/includes/Health_Information/generalpublic.php).
- [WHO dengue fact sheet](https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue).
- [MedlinePlus developers](https://medlineplus.gov/about/developers/),
  [search XML service](https://medlineplus.gov/about/developers/webservices/),
  [bulk XML](https://medlineplus.gov/xml.html).
- [NCDC weekly report archive](https://ncdc.mohfw.gov.in/includes/WeeklyOutbreaks.php),
  [2026 directory](https://ncdc.mohfw.gov.in/uploads/weekly_outbreaks/2026/).
- [WHO Disease Outbreak News](https://www.who.int/emergencies/disease-outbreak-news/).
- [IHIP facility documentation](https://ihip.mohfw.gov.in/idsp/download?fileid=37),
  [IDSP technical material](https://idsp.mohfw.gov.in/WriteReadData/l892s/26811157771705560089.pdf).
- [WHO DON API documentation](https://cms.platform.who.int/api/news/outbreaks/sfhelp)
  exists; working endpoint access and service reliability are unverified.
- [WHO GHO API documentation](https://www.who.int/data/gho/info/gho-odata-api),
  [legacy notice](https://www.who.int/data/gho/legacy?lang=en).
- [Official NHS API catalogue](https://www.api.gov.uk/nd/nhs-syndicated-content-rest-apis/).

Concrete freshness finding: on 2026-10-23 the inspected NCDC directory listed
reports through Week 34/2026; that file's server modification date was October 13.
An upload date is not its epidemiological reporting period. A fetched-today badge
cannot make an old report current. The research agent inspected the report and
identified its period as August 17–23; recheck the PDF during any actual extraction.
No district counts or coverage claims are proposed for implementation from this
research alone. Missing reports must not become zero cases or a green safe region.

Keep educational topics, official bulletins and historical statistics in separate
data types. Do not infer individual risk from any of these population sources.

## Reuse and attribution

- [MedlinePlus policy](https://medlineplus.gov/about/using/usingcontent/)
  distinguishes reusable topic summaries from licensed encyclopedia/drug/image
  content. Its RSS feeds are for personal use and unsuitable for app syndication.
  Prefer the documented XML sources for permitted content; attribute NLM.
- [WHO publication policy](https://www.who.int/about/policies/publishing/copyright)
  commonly uses CC BY-NC-SA 3.0 IGO and prohibits implied endorsement/logo use.
  [WHO dataset terms](https://data.who.int/about/data/terms-and-conditions) are a
  different regime. Verify the exact resource and third-party credits before
  copying, adapting, translating or ingesting it.
- [NCDC copyright policy](https://www.ncdc.mohfw.gov.in/includes/Footer/Copyright_Policy.php)
  requires acknowledgement and accurate context; third-party works need their
  own permissions. Do not generalize its terms to every government site.

Use original illustrations and short authored summaries with traceable evidence
after resource-level rights review. Do not bulk scrape, rehost official imagery,
copy full web pages or imply an official partnership. Source review and medical
review are distinct; owner review cannot be labelled clinician validation.

## Source-to-content workflow

1. Agree audience, topics and languages with owner.
2. Select authoritative, applicable pages with identifiable dates and reuse notes.
3. Draft brief claims and record supporting section/page and source IDs.
4. Author choices, explanations, prevention actions and optional FAQ against those
   claims. Fictional settings stay explicitly fictional; consequences are authored
   explanations, not epidemiological simulation or model predictions.
5. Review wording and every question's supported answer; record reviewer role.
6. Publish a versioned bundle only after approval; retain correction history.
7. Recheck on source changes and a proposed 90-day editorial review cycle.
   This interval is a product default, not a medical standard. Topic-sensitive
   policies and review-expiry behavior need agreement before launch.
8. Any future feed importer creates a draft review queue, never silently changes
   published health guidance. Store report period, publication, retrieval and
   local review dates separately, with absent dates explicitly unknown.

## Fit to the current repo

- Navbar Home means `/dashboard`; it is currently greeting/profile/quick access.
  Public `/` is a separate marketing page. Placement question remains open.
- Existing `backend/app/core/vector_store.py` returns plain strings from six
  placeholder texts. It is not an approved awareness evidence corpus.
- Existing chat includes profile/history context and its own urgency/SSE behavior.
  Awareness should not silently inherit that data sharing or modify its contract.
- Use the current Next/FastAPI stack and a small typed source collection; no
  orchestration migration or vector database is needed for this size.
- Optional AI: choose a topic's permitted evidence server-side, one explicit
  bounded call, structured output and server-resolved IDs/URLs. ID validation
  checks identity, not whether a medical statement is semantically supported.
- Authored scenes remain available without Gemini. No model call on home render.
  Quotas, timeout and fallback preserve cost control and a useful demo.
- Progress, if approved, belongs to a separate JWT-owned collection and stores
  learning state only. Reading level/interests come from explicit choices,
  not a medical profile, chat history or geolocation by default.

## Open decisions

Home placement; audience/language; deadline; flagship preference; first topic set;
AI scope and input policy; progress/reset; user-triggered sharing; content reviewer;
whether dated official bulletins are needed now or deferred. See the
[proposed feature plan](../features/DISEASE_AWARENESS.md).
