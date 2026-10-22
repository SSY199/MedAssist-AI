# REM-01: medication reminders — planning draft

Updated: 2026-10-23. Status: Research complete; owner decisions pending.
Branch: `codex/medication-reminders`. Base: main `a5e2b07`, marketplace PR #4 merged.
[Research, alternatives and primary sources](../research/REMINDERS.md).
No application implementation is approved or started.

## Proposed outcome

A user records their existing medication schedule, sees what is due today,
receives reminders through an agreed channel and records Taken/Skipped/Snoozed
for each occurrence. The app supports organization; it does not determine doses,
prove ingestion or replace the user's prescribed instructions.

The key decision is background delivery: an in-app banner alone cannot alert
someone after the page closes. Email/Web Push still require a running backend
scheduler and functioning provider/device. Localhost can demonstrate background
email while the browser tab is closed, provided the laptop and worker stay awake.

## Candidate first scope — not yet agreed

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

## Pending owner decisions

Ten questions cover feature types, channels, platforms, schedule patterns, dose
logging, late reminders, input/prefill, message privacy, hosting budget and target
outcome/deadline. Answers and final agreement will be recorded before coding.
