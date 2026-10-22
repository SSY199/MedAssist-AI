# Reminder delivery and scheduling research

Reviewed: 2026-10-23. Planning reference for REM-01, not approved implementation.
Branch: `codex/medication-reminders`, from merged main `a5e2b07` (marketplace PR #4).
No provider account, subscription, notification permission or message was created.

## Repository findings

- Next.js/React already provides protected dashboard layout, Navbar and a disabled
  Reminders tile. `proxy.ts` already includes `/reminders`; the page is absent.
- FastAPI verifies Better-Auth JWTs, and Motor/Mongo stores app records separately
  from auth data. There is no reminder schema, occurrence history or worker.
- Profile medications are strings, without structured dose, recurrence, timezone
  or start/end dates. They cannot be converted into schedules automatically.
- Marketplace metadata identifies products but does not prescribe a regimen.
  A saved product is not proof that the owner takes that medication.
- Gmail SMTP exists exclusively for SOS today. Reusing its account/transport is a
  proposal requiring agreement; reminder messages must not invoke SOS or notify
  emergency contacts. Keep channel configuration and disable controls distinct.
- No PWA manifest, push subscriptions or service worker was found. Public frontend
  deployment passed, but hosted backend/worker readiness is not established.
- README's Twilio/Redis reminders wording is an old proposal, not an implemented
  contract or requirement to introduce either service.

## Delivery options

| Option | Works without the website tab? | Advantages | Constraints / recommendation |
| --- | --- | --- | --- |
| In-app due list/banner | No active alert after page closes; persistent due list can be read later | No notification permission or delivery provider; useful schedule/history foundation | Browser timers alone are insufficient for background delivery. Always retain this UI as fallback. |
| Browser notification triggered by an open page | Depends on the page still executing | Visible desktop demo with explicit permission | Hidden tabs may throttle timers; denied permission and OS settings need fallback. Not equivalent to Web Push. |
| Server email | Yes, if the worker is running and the mail provider accepts the message | Fits current Python/Gmail experience; no PWA install | Sender quotas, spam filtering and delays; accepted is not delivered/read. Recipient/content consent required. Proposed first external channel. |
| Web Push | Can reach an opted-in subscription without a loaded page | Better app-like background notification UX | Service worker, subscriptions, server sender/VAPID, HTTPS, permissions, expired endpoints and device testing. OS/network/browser policy still affects delivery. Optional follow-up or first-version choice. |
| SMS / automated WhatsApp | Independent of the app tab | Familiar mobile channel | Provider setup, recipient consent, messaging charges and channel rules/templates. No account/access currently established. Defer unless owner selects. |
| Calendar export | Calendar app can manage its own configured alerts | Helpful portable schedule | Import/alert behaviour varies; one-time exports can become stale after edits. Not the same as synchronized reminder delivery. Optional later scope. |

## What primary documentation establishes

1. [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
   describes server-pushed messages even when the app is not loaded, using a
   service worker and a subscription. Subscription endpoints are capability URLs:
   protect them like secrets; do not log or expose another user's endpoint.
2. [MDN: Notifications usage](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)
   documents notification permission states and user-interaction requirements.
   Permission denial must leave the in-app due list usable. Request only from an
   explicit enable-notifications action, never automatically on page load.
3. [MDN: setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)
   documents throttling in inactive tabs. Inference for this app: a long browser
   timeout cannot serve as its persistent medication scheduler.
4. [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
   documents HTTPS secure contexts and localhost's development exception. A service
   worker is event-driven; do not treat it as an always-running alarm clock.
5. [WebKit: iOS/iPadOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
   documents support starting with iOS/iPadOS 16.4 for Home Screen web apps and
   permission requests following direct user interaction. Plan an installed-PWA
   test if iPhone support is included; a normal Safari tab alone is not sufficient
   evidence that this setup works.
6. [FastAPI: Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
   runs work after returning a request response and discusses larger worker tools.
   Inference: BackgroundTasks alone does not supply a persisted recurring schedule
   or recovery after process restart. Do not sleep in an HTTP request until a dose.
7. [Celery: periodic tasks](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html)
   describes beat dispatching work to workers, a single scheduler per schedule to
   prevent duplicates, timezone configuration and possible task overlap. It is a
   valid expansion option, but broker/worker/beat operations add services to this
   small app. It is not selected merely because reminders need background work.
8. [Vercel: Cron usage/pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
   currently lists Hobby cron minimum daily intervals with per-hour precision;
   Pro/Enterprise support minute intervals. Inference: Hobby cron is unsuitable
   for scheduling arbitrary dose times. No assumption is made about the owner's
   actual Vercel plan. Even paid cron is not a delivery guarantee.
9. [Render: free service limits](https://render.com/docs/free)
   documents idle spin-down after 15 minutes without incoming traffic. Inference:
   background scheduling inside a sleeping free web service cannot be relied on.
   [Render background workers](https://render.com/docs/background-workers)
   describes continuously running worker services. A hosting choice/budget remains
   open; no paid instance is being created.
10. [Gmail sending limits](https://support.google.com/mail/answer/22839?hl=en)
    documents per-day/recipient restrictions and temporary send blocks. Use only
    for a small opt-in prototype if selected. Do not portray SMTP acceptance as
    inbox delivery or assume an unlimited/no-cost production messaging service.
11. [Twilio SMS India pricing](https://www.twilio.com/en-us/sms/pricing/in),
    [WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing), and
    [WhatsApp concepts](https://www.twilio.com/docs/whatsapp/key-concepts)
    describe usage-based pricing and template/channel rules. No exact cost quote
    or India sender eligibility is established for this app; verify the chosen
    account, destination and message type before any later integration.

## Proposed integration choice, conditional on owner answers

For localhost first, use a persisted schedule/occurrence model in Mongo with a
separate Python worker process and in-app Today/history views. If email is chosen,
add explicit delivery consent and a server-only transport. The laptop, worker,
network and provider must be available. Closing the website is different from
closing/sleeping the laptop.

The worker can poll due records in bounded batches on a short interval, claim an
occurrence atomically, recheck status/version and send via the agreed channel.
Mongo retains pending work after restart. Poll interval is an implementation
choice, not a promise of exact-minute or clinical reliability. Public delivery
requires an independently running hosted worker or an appropriately frequent
managed trigger, plus safe endpoint authentication if triggers use HTTP.

A small Mongo-backed worker avoids a broker dependency initially, but leases,
crash recovery and concurrency need tests. Redis/Celery or a managed queue is
an alternative if scale, task isolation or hosting preferences justify it. An
in-process scheduler under multiple uvicorn workers must not enqueue duplicates.
No final scheduler library/framework or new dependency is approved yet.

## Product/reliability decisions that must be explicit

- Separate a recurring schedule, each due occurrence, its delivery attempts and
  user-reported action. Email sent does not mean medication taken.
- Store an IANA timezone and wall-clock times as entered; compute UTC instants.
  Explain whether travel preserves home timezone or follows device timezone.
  DST gaps/overlaps and date boundaries require deterministic rules and tests.
- Persist snooze per occurrence, not by shifting the whole treatment schedule.
  Record the original due time; do not create a duplicate dose after snooze.
- Do not infer a missed dose or non-adherence solely from no click. Say overdue
  or unconfirmed; never automatically recommend a replacement/double dose.
- Agree a lateness window before catch-up sends. Never replay all old reminders
  after downtime; history and current notification needs are separate concerns.
- Use unique occurrence identities, atomic claims and bounded retry rules. A
  disconnect during SMTP submission creates an ambiguous outcome; do not promise
  exactly-once delivery or blindly retry an email that may have been accepted.
- Edits, pause, stop and deletion cancel future work using schedule versions.
  Recheck just before sending; explain that already-submitted messages cannot be
  recalled. Define history retention and deletion rather than deleting silently.
- Generic notification content reduces medication disclosure on shared screens.
  Detailed content, alternate recipients and caregiver escalation need separate
  consent/scope. Do not reuse emergency-contact sharing preferences for reminders.
- User input only records an existing prescribed plan; no AI-generated dose,
  treatment changes, interaction checking or urgent escalation in this milestone.

## Research status

A ten-question decision set was presented to the owner. The feature plan is a
proposal until answers are recorded and the revised scope is explicitly approved.
No application code, database records or environment settings changed.
