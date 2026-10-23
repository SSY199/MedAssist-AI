# REM-01: medication reminders — planning draft

Updated: 2026-10-23. Status: Implemented and validated locally; not pushed or merged.
Branch: `codex/medication-reminders`. Base: main `a5e2b07`, marketplace PR #4 merged.
[Research, alternatives and primary sources](../research/REMINDERS.md).
Owner explicitly approved implementation on 2026-10-23. Earlier proposals below are retained as planning history; the selected scope and implementation record are authoritative.

## Agreed outcome

A user records their existing medication schedule, sees what is due today,
receives reminders through an agreed channel and records Taken/Skipped/Snoozed
for each occurrence. The app supports organization; it does not determine doses,
prove ingestion or replace the user's prescribed instructions.

The key decision is background delivery: an in-app banner alone cannot alert
someone after the page closes. Email/Web Push still require a running backend
scheduler and functioning provider/device. Localhost can demonstrate background
email while the browser tab is closed, provided the laptop and worker stay awake.

## Initial proposal (refined by owner answers below)

- Medication schedules first, using the existing visual style and protected
  `/reminders` route. Appointments/habits remain separate unless selected.
- Manual medication name, optional user-entered dose/instruction label, explicit
  timezone, one/multiple daily times, selected weekdays or one-time date, start
  date and optional end date. Validate bounds and show the next occurrences
  before saving. No every-X-hours/tapers/PRN clinical logic unless agreed.
- Optional explicit name prefill from a profile medication or marketplace item,
  always requiring schedule confirmation. No silent schedule creation or profile
  updates. Saved favourites are not automatically treated as prescribed medicines.
- Today view: upcoming, due, overdue/unconfirmed and completed/skipped entries;
  schedule manager: edit, pause/resume and stop with clear future-effect semantics.
- Taken, Skipped and one-occurrence Snooze with a small action history; quantities,
  snooze duration, corrections/undo and retention to be finalized after answers.
- In-app due banner/list; automatic email to the signed-in user's verified account
  address if selected. Optional browser notifications/Web Push depending on scope.
  Generic external message by default; medication details after sign-in.
- Late reminder policy: propose one recent catch-up within an agreed grace period,
  suppress older external alerts and retain unconfirmed history. No automatic
  caregiver email/SOS, repeat nagging or escalation from an unacknowledged dose.
- A visibly labelled test/near-future schedule for review, using synthetic content
  and an owner-chosen test account. No testing against real medication records.

## User journey proposal

1. Open Reminders from Navbar/dashboard. Empty state explains setup and delivery
   availability; it does not immediately request notification permission.
2. Add a medication manually or explicitly choose a name prefill if agreed.
3. Enter existing prescription instructions and schedule, confirm timezone, dates
   and a readable preview of the next due times.
4. Enable the agreed external channel with recipient/content preview and consent.
   No automatic use of SOS recipient or its sharing configuration.
5. Save and see the item in Today/Upcoming. A backend worker schedules/delivers
   without depending on the open browser page.
6. Mark Taken or Skipped, or Snooze the specific occurrence. Persist the action
   to the account; refreshing/another device shows the same state.
7. Edit/pause/stop a schedule. Show which future reminders are affected, retain
   agreed history and explain that an email already submitted cannot be unsent.

## Fit with the current architecture

Frontend candidates:

- `app/(dashboard)/reminders/page.tsx` plus focused reminder form/list/history
  components and typed contracts/helpers. Reuse Base UI and existing theme tokens.
- `lib/api-client.ts` for authenticated requests. Protect every backend operation;
  dashboard layout alone does not authorize writes.
- Enable the Reminders dashboard tile only after implementing the protected page.
  `/reminders` is already in the proxy matcher.
- An agreed in-app reminder surface may wrap dashboard pages. Preserve SOS provider
  and urgency behaviour; no surprise notification permission request on mount.
- If Web Push is selected, add a scoped service worker, manifest if needed and
  subscription/settings UX. Avoid caching authenticated pages/private API data.
  Account switching/logout must not leave personal push notifications bound to the
  next user of a shared device. Push endpoints never go into logs or public output.

Backend candidates:

- A dedicated authenticated reminders router with bounded Pydantic input models.
  Ownership always comes from verified JWT `sub`.
- Separate `medicationReminders` schedules, `reminderOccurrences` and bounded
  delivery metadata (names provisional). Do not change auth/profile collections.
- Schedule: userId, entered labels, timezone, recurrence/times, date bounds,
  active/paused/stopped state, version, consent/channel choices, timestamps.
- Occurrence: unique user/schedule/version/due-instant identity, original dueAt,
  snoozedUntil if any, user-action state/timestamp and separate delivery state.
- Indexes for user-scoped listing, unique occurrence identity and due/claim scans;
  add explicit, idempotent setup only for new collections. No existing-data migration.
- A separately launched Python worker for due detection, atomic claim/lease,
  stale-claim recovery, cancellation/version rechecks and bounded retries.
- Reuse Gmail account only after agreement. Keep reminder sending separately
  configurable/disableable; do not change SOS semantics or its delivery limits.
  The verified recipient must come from server-trusted account data, not an
  arbitrary browser-supplied email. Verify the actual Better-Auth email contract
  during implementation; current profile has no reminder-recipient setting.
- No long-lived timeout/sleep in Next.js request handlers or FastAPI requests.
  FastAPI BackgroundTasks alone is not persisted recurring scheduling.

Candidate APIs to finalize after decisions:

| Action | Candidate contract |
| --- | --- |
| List/create schedules | `GET/POST /reminders` |
| Edit/pause/resume/stop own schedule | `PATCH /reminders/{id}` with version/conflict handling |
| Today's occurrences/history | `GET /reminders/occurrences` with bounded range/page |
| Taken/Skipped/Snooze | `POST /reminders/occurrences/{id}/action`; replay-safe, ownership checked |
| Delivery settings/status | Authenticated own-account settings and server capability/status |
| Push subscriptions, if selected | Authenticated subscribe/unsubscribe with account/device isolation |

Exact endpoints, scheduler library and deployment are provisional. No provider
signup, spend, migration, credential reuse, new notification permission or message
send is authorized by this planning draft.

## Scheduling/recovery rules to settle

- Home timezone stays explicit; never silently move doses when browser timezone
  changes. Define DST nonexistent/ambiguous local times before implementing.
- Define duplicate times, midnight, start/end inclusivity, one-time expiry and
  overlapping schedules. Fixed clock-time recurrence is different from an interval.
- A user action changes one occurrence; do not shift the treatment schedule or
  silently infer a dose was missed. Explain unconfirmed history without advice.
- Agree snooze interval/limits and handling if snooze crosses the next due time.
- Decide grace window for late sends; avoid replay storms after laptop sleep or
  worker downtime. Show the original scheduled time when a reminder is delayed.
- Separate queued, claimed, provider-accepted, failed, ambiguous and suppressed
  delivery from Taken/Skipped. Only provider evidence can justify delivered status;
  SMTP acceptance alone cannot. Do not claim exactly-once external delivery.
- Pause/edits/stop invalidate future work by version and recheck before send.
  A message already submitting may still arrive. History deletion/retention needs
  a clear user action and privacy decision rather than accidental cascade.
- Running workers must coordinate; unique IDs and atomic claims guard duplicates
  across restarts/concurrent processes. Gmail/shared sender load must be bounded
  so reminders do not exhaust the account used by SOS.

## Implementation sequence after explicit scope agreement

1. Record ten owner answers, resolve channel/hosting/privacy/scheduling questions,
   revise this plan and obtain approval for the concrete first version.
2. Define schedule/occurrence/channel contracts and recurrence examples. Read the
   installed Next.js guides and backend rules before writing application code.
3. Implement authenticated CRUD and occurrence actions with synthetic Mongo mocks
   and a controllable clock. Explicitly review indexes/retention without modifying
   existing collections.
4. Add the separate worker and selected delivery channel, including consent,
   retries/ambiguity handling and local start/stop/status instructions.
5. Build form, timezone/schedule preview, Today/history/settings in existing style.
   Integrate optional name prefill only if agreed; preserve profile/marketplace/SOS.
6. Run the contributor matrix plus scheduling/worker tests and browser review with
   synthetic schedules. Any real test message needs agreed recipient/content.
7. Record evidence, review a focused PR, inspect checks and merge only when requested.
   Public worker deployment and paid infrastructure require their own agreement.

## Acceptance checklist proposal

- Two synthetic accounts cannot read/change/act on each other's records.
- One-time/daily/weekday recurrence, timezone conversion, DST boundaries, midnight,
  date limits, invalid/duplicate times and schedule previews agree with frozen time.
- Taken/Skipped/Snooze persist across reload, repeated clicks and concurrent clients;
  stale versions and contradictory actions receive explicit handling.
- Due work survives restart; two workers do not claim the same occurrence normally;
  crash/timeout/unknown submission outcomes do not cause blind repeated messages.
- Pause, edit, stop and consent withdrawal suppress future work as specified.
- Downtime follows the agreed grace policy; no burst of old reminders.
- Permission denied/expired subscription/provider unavailable/laptop asleep paths
  show honest fallback and delivery status. No guaranteed alarm or delivery claim.
- No medication changes, diagnosis, inferred dose, refill/pill-count advice, caregiver
  sharing or automatic SOS appears without separate scope agreement.
- Existing sign-in/profile/chat/map/marketplace/SOS remain functional. No real health
  data, provider secrets or generated stores enter commits.

## Original decision set (answered below)

Ten questions cover feature types, channels, platforms, schedule patterns, dose
logging, late reminders, input/prefill, message privacy, hosting budget and target
outcome/deadline. Answers and final agreement will be recorded before coding.

## Owner answers and revised first version (2026-10-23)

The owner selected:

| Decision | Selected scope |
| --- | --- |
| Reminder types | Medication reminders only |
| Channels | In-app plus automatic email |
| Initial environment | Laptop localhost; public/mobile later |
| Recurrence | One-time, daily times, selected weekdays |
| Actions | Taken, Skipped, Snooze and history |
| Downtime | One recent catch-up; older entries in history |
| Creation | Manual entry, optional explicit profile/marketplace name prefill |
| External content | Generic notification; medication details only after sign-in |
| Budget | Local first; no new paid services |
| Deadline/demo outcome | Owner confirmed create → close tab → email → reopen → Taken demo; no specific completion date stated |

These selections supersede alternatives above. Web Push/browser OS notifications,
SMS/WhatsApp, appointments/habits, caregiver escalation, public hosting, complex
intervals and AI-generated treatment/doses are excluded from this first version.

Defaults approved in the final scope confirmation:

- Show a confirmed timezone on each schedule (suggest the device's IANA timezone
  initially); preserve that timezone when travelling unless explicitly edited.
- A 30-minute late-delivery window. After downtime, send at most the latest eligible
  catch-up per medication schedule; older occurrences remain overdue/unconfirmed
  in history. Do not replay every old alert or imply missed doses should be taken.
- Snooze once for 10 minutes on an unresolved occurrence, without changing future
  scheduled times. Block a snooze overlapping that schedule's next occurrence and
  explain it. A snooze may produce one further generic notification.
- For DST: skip nonexistent wall-clock times with visible unconfirmed/skipped-time
  explanation; use the first instant for an ambiguous repeated time, once only.
  One-time nonexistent times are rejected with an explicit validation message.
- Taken/Skipped are self-reports, stored with timestamps. Corrections are explicit
  user actions; notification acceptance never changes a dose to Taken.
- History UI initially shows the last 30 days. Do not silently purge records. Pause
  or stop preserves past history; permanent history deletion, if included, requires
  an explicit user action/confirmation. Retention automation is not part of this plan.
- Separate worker checks due work in bounded batches on a short polling interval,
  with durable Mongo state, atomic claims and bounded recovery. This targets prompt
  prototype delivery while awake/connected, not an exact-time medical alarm.
- Propose the existing configured Gmail account as sender, with reminder sending
  separately enabled/disabled. Recipient is only the signed-in user's server-verified
  account email. Require explicit email opt-in and show a recipient/content preview.
  Do not reuse SOS consent, recipients or activation functions. Keep sending bounded
  so reminder load does not overwhelm the shared Gmail account.
- Generic subject/body such as “MedAssist reminder” and “You have a scheduled
  reminder. Sign in to MedAssist to view it.” No medicine, dose, condition or user
  identifier in the external message/link. Never claim SMTP accepted means delivered.

Proposed demonstration: enter a synthetic medication and near-future time, enable
email, close the website tab while laptop/worker stay awake, receive a generic
email, reopen/sign in, mark Taken, then show persisted history and pause controls.
Test messages require the owner's selected test account/recipient; the planning
choices alone do not authorize sending health information to anyone.

The owner confirmed the proposed demonstration after question ten was clarified.
No completion date was specified. The owner subsequently approved the final scope
including timing defaults, Gmail reuse and implementation before coding began.

## Approved implementation (2026-10-23)

Owner explicitly selected “Yes, implement this version” for the final scope check,
including the configured Gmail sender, generic own-account email, 30-minute
catch-up window and one 10-minute snooze. Application implementation is authorized;
no public hosting, paid services, push/SMS/WhatsApp or caregiver messages.

Implementation now includes protected reminder screens and dashboard link, typed
forms/previews, explicit optional profile/catalog-name prefill, per-occurrence
actions/history and pause/resume/stop. The dashboard due notice is generic.

FastAPI routes use JWT identity; server-trusted Better-Auth Mongo user data supplies
the verified recipient. Email consent is stored with recipient fingerprint, version
and timestamp; a changed/unverified recipient suppresses sends until re-confirmed.

The standalone worker uses Mongo records, deterministic occurrence IDs, atomic
claims, two-attempt limits for definite failures, and no automatic retry of
ambiguous SMTP submissions. It rechecks the schedule and action before submission.
Accepted mail remains separate from Taken/Skipped. A message already submitting
can still arrive after an action, pause or edit.

Local command (run in a separate terminal from `backend/`, while API is running):

```bash
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m app.workers.reminders
```

The worker creates indexes only for the new `medicationReminders`,
`reminderOccurrences` collections and stores heartbeat/quota metadata in
`reminderWorkerState`. It checks every 15 seconds; UI refreshes every 30 seconds
and dashboard due count every 60 seconds. A heartbeat older than 90 seconds is
shown as offline. This is a prototype target, not a timing/delivery guarantee.

`REMINDERS_EMAIL_ENABLED` is a separate server-only master switch (template default
false). Local ignored `.env` enables it for the approved version, using existing
`SOS_GMAIL_ADDRESS` / `SOS_GMAIL_APP_PASSWORD`; SOS transport/activation is unchanged.
Set the switch false and restart API/worker to disable all reminder email.
Each schedule still requires its own email opt-in/consent; no email is sent merely
by opening the page, previewing, or starting the worker.

Prototype bounds: 50 schedules/account, eight times/schedule, 500 rows per day;
latest 20 action corrections per occurrence. History browsing covers 30 days; no
silent history deletion/TTL job. Dates supported through 2100. Old history beyond
the backfill window is not reconstructed after an outage longer than 30 days.
Email quotas (UTC buckets): six/hour and 30/day per account, 20/hour and 100/day
globally. These conservative caps reserve sender capacity for SOS; budget-suppressed
reminders stay in-app with an explicit reason. Failed/partial quota reservations
can conservatively consume capacity; they never increase allowance.

Validation so far: 56 synthetic Python tests and 11 Node helper tests passed,
including the mocked create → worker → accepted email → Taken → persisted read
flow. TypeScript and production build passed. Lint has only the existing unused
Badge warning. AST parsing and diff whitespace checks passed.
Owner separately authorized one generic test email using a labelled synthetic
schedule in the currently signed-in account. The schedule was saved for 01:23
Asia/Calcutta on 2026-10-23, then the agent-created test tab was closed. The worker
continues independently; final submission/action verification is recorded below.

Live verification: the authorized synthetic one-time occurrence was submitted once
while the agent-created test tab was closed. Read-only delivery metadata confirmed
`attempts=1`, `delivery=accepted`, `status=pending`; this proves SMTP acceptance, not
inbox delivery. No recipient address, token or medication profile was printed or
committed. The user's other browser tabs were preserved.

Browser review also caught a native date/time input synchronization issue: the
preview could retain the previous controlled value. Explicit input-event handling
now invalidates/rebuilds the preview; the displayed and saved 01:23 time matched.
A response sequence guard prevents older day/poll responses replacing newer data.

## Completed local verification

- 56 Python tests passed (24 reminders, 10 marketplace, 22 SOS); 11 Node tests passed.
  Frozen-clock/mocked-provider tests include auth/ownership, one-time/daily/weekday
  recurrence, DST gaps/overlaps, preview validation, replay-safe creation/actions,
  Taken/Skipped corrections, snooze/next-time overlap, pause/version conflicts,
  worker restart/concurrency, failed/ambiguous submission, catch-up and quotas.
- Final production build, TypeScript, AST parsing and whitespace/link checks passed.
  Lint has only the pre-existing unused Badge warning. No dependencies were added.
- Browser verified empty state, worker/sender status, synthetic weekday preview,
  native date/time preview agreement, synthetic one-time save, accepted email state,
  Taken, reload-persisted Taken/history, and Stop preserving that history.
- Owner-authorized synthetic live test: one SMTP-accepted submission/one attempt
  while the agent test tab was closed. It was then recorded Taken, reloaded and
  stopped. The labelled test schedule/history remain visible, with no future send.
  Inbox receipt was not independently verified, and other user tabs were preserved.
- The original profile/medications were not edited. No real medication, caregiver
  message, push permission or public deployment was involved. APIs/new collections
  were exercised with synthetic records; existing patient/auth collections were not
  changed by the implementation. Narrow mobile viewport and multiple live accounts
  were not exercised; those ownership paths are covered by isolated tests.

The local API and separate worker are running. Later restart requires both services;
Gmail credentials and `REMINDERS_EMAIL_ENABLED=true` remain only in ignored local
environment files. Production reminder delivery is not configured by a frontend build.
Push/PR/merge and hosted delivery remain owner-authorized follow-up actions.
