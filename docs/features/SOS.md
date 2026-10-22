# SOS-01: automatic contact email and emergency assistance

Updated: 2026-10-22. Review: 2026-10-23.
Status: Implemented and checked locally; awaiting owner demo, not merged.
Branch: `codex/sos-assistance`, based on updated `origin/main` at `d1ca817`.
The earlier planning branch remains `codex/next-phase-plan`. This branch starts
from main and carries the planning documents as feature context; it does not
stack on the planning branch or merge it implicitly.

## Approved scope and decisions

The owner approved automatic email after confirmed activation, an active SOS
screen, location and selected health summary by default, nearby-care results,
call and user-sent WhatsApp fallbacks. Gmail is the available sender. Demo on a
localhost laptop now; responsive browser layout for future mobile use. India 112
is labelled explicitly. No backend migration or hosted-backend work is included.
Marketplace and reminders remain separate features, each requiring discussion.

Process agreed: read context -> prepare plan -> ask questions -> obtain scope
agreement -> implement consistently -> verify -> review. One feature per branch.
The initial call/WhatsApp-only proposal was superseded when the owner requested
an alert that does not require the patient to speak or compose a message.

## Implemented flow

1. Navbar SOS and the existing urgent-chat action open protected `/sos`.
   Opening the page never sends an email, makes a call, or requests GPS.
2. Profile supports an optional emergency-contact email, validated server-side.
   Existing profiles without it still load; email activation requires it.
3. Capture location explicitly, with an eight-second timeout and denied/unavailable
   fallback. Coordinates also go to the existing Mapbox nearby-care search.
   A manual description can replace GPS. Email can proceed without location.
4. Review exact recipient and email content. Age, conditions, allergies and
   medications are preselected; each can be removed. Past incidents, full profile,
   and chat history are not included. The backend builds the message from the
   authenticated user's own profile and checks a preview hash before submission.
5. Confirm activation. The backend records one latest incident per account,
   claims submission atomically in MongoDB, and sends via Gmail SMTP/STARTTLS.
   GPS older than ten minutes is rejected. No Gemini call is needed.
6. The active screen shows incident reference, timestamps, recipient, attempts,
   email status, shared location, and selected field names. It polls while a
   submission is in progress; refresh/reload restores persisted incident metadata.
7. Failed submissions can be explicitly retried after 60 seconds, up to three
   attempts. Accepted or ambiguous submissions cannot be retried automatically.
   A process interruption left in `sending` becomes `unknown` after two minutes
   when status is next requested. Ending SOS cannot recall submitted email.
8. Call 112 (India), call the saved international phone number, copy a message,
   or open WhatsApp with a prefilled message. The user presses Send in WhatsApp.
   Care results link to directions; no live hours/capacity/ETA/nearest-ER guarantee.

## Sender setup

In ignored `backend/.env` only:

```dotenv
SOS_GMAIL_ADDRESS="your-sender@gmail.com"
SOS_GMAIL_APP_PASSWORD="your-dedicated-google-app-password"
```

Enable Google 2-Step Verification, create a dedicated app password, and paste it
locally. Never use an ordinary Google password or put it into a `NEXT_PUBLIC_`
variable. Restart FastAPI after editing. The contact's email belongs in the app
profile, not in the sender setting. Some accounts cannot create app passwords;
see [Google's app-password guidance](https://support.google.com/mail/answer/185833).
SMTP uses `smtp.gmail.com:587` with verified STARTTLS:
[Google SMTP documentation](https://developers.google.com/workspace/gmail/imap/imap-smtp).

No new paid provider or Python dependency is required. Gmail account limits and
spam filtering apply. This implementation is a review prototype, not a monitored
emergency service or guaranteed notification channel.

## Status and data boundaries

- `sending`: a submission was claimed; the final outcome is pending.
- `accepted`: Gmail accepted SMTP submission; inbox delivery, reading and response
  remain unconfirmed. Even a subsequent QUIT failure preserves acceptance.
- `failed`: submission was not accepted or the sender is unconfigured.
- `unknown`: submission outcome is ambiguous; it may already have been accepted.
  Use the fallback channels instead of silently creating duplicate emails.
- Incident storage retains only the latest contact, location/description, selected
  field names, preview hash, identifiers and timestamps/status/attempt count.
  Full health/message text is not retained with the incident or logged. Existing
  health profiles remain in their original collection. A new activation replaces
  the ended latest incident after cooldown; this is not an audit-history archive.
- Email content necessarily reaches Gmail and the selected recipient. The page
  shows the content before activation. No delivery/read webhook or acknowledgement
  link is implemented. A relative cannot open a laptop's localhost link remotely.
- Original email text is held only in the mounted browser component. After reload,
  the WhatsApp/copy fallback is clearly labelled as a minimal help request with
  saved location; it does not reconstruct historical health data from a changed
  profile. Current sharing preview remains visible for any explicit retry.
- There is no unconsciousness detection, ambulance dispatch, automatic call,
  continuous tracking, background escalation, durable email job queue, global
  provider quota enforcement or production availability guarantee. A crash after
  the atomic claim can leave an unsent/uncertain incident; no automatic resend.
- SMS was researched but not implemented. Twilio India SMS is charged per segment
  and trial recipients/content are restricted; cost/compliance would need separate
  agreement. [India pricing](https://www.twilio.com/en-us/sms/pricing/in),
  [trial constraints](https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account).

## Validation commands

From repo root:

```bash
npm run lint
npx --no-install tsc --noEmit --incremental false
npm run build
node --experimental-strip-types --test tests/sos.test.mjs
```

From `backend/`:

```bash
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -v
```

Tests use synthetic profiles and replace SMTP/Mongo with test doubles. They do
not send email or validate clinical use. Node 22 reports experimental type-strip
and module-inference warnings; no dependency or package-type change is needed.

Coverage: authenticated access, own-user isolation, exact selected-field payload,
changed preview, invalid email/coordinates and stale GPS, no send on page/read or
preview, duplicate activation, retry cooldown/limit, accepted/unknown/ended retry
rejection, new-incident cooldown, interrupted-send uncertainty, TLS validation,
authentication failure, ambiguous SMTP result and post-acceptance QUIT failure.
Frontend helpers check international phone links and facility directions.

## Review demonstration

1. Save a synthetic health profile and an emergency-contact email you control,
   plus an international phone number beginning with `+`.
2. Open `/sos`. Verify opening alone sends nothing. Capture location only if you
   want to share it with Mapbox/contact, or use a synthetic manual description.
3. Review recipient and health fields. Activate only when ready to send a real
   email. Confirm acceptance status, then check the recipient inbox/spam yourself.
4. Reload to show restored status and explain the difference between SMTP
   acceptance and confirmed inbox delivery. End the incident when finished.
5. Show fallback controls and care directions. Do not place an emergency call
   during the demonstration or send an alarming test message to an unaware person.

PR: not opened. Merge: not performed. Live Gmail authentication was verified
without sending email; real inbox delivery remains a user-run verification step.

## Verification results (2026-10-22)

- Lint passed with the existing unused `Badge` import warning on the landing page.
- TypeScript and production build passed, including protected `/sos`.
- 15 Python behavioral tests and two Node helper tests passed. Concurrent
  activation/retry cases use an isolated in-memory collection double.
- Gmail STARTTLS and authentication passed without sending an email.
- Read-only MongoDB ping and backend health passed. Unauthenticated FastAPI SOS
  returns 401; the frontend redirects unauthenticated `/sos` requests.
- Signed-in browser checked: page loads, missing-contact feedback disables email
  activation, selected health fields are visible, and dark-theme button contrast
  is corrected. Desktop and the earlier narrow single-column layout were viewed.
- Real inbox delivery, GPS permission paths and a complete active-incident browser
  demonstration remain to be exercised by the owner with a test inbox/profile.
- Automatic approval review rejected a proposed test that would create/drop
  temporary collections in the configured database. It was not executed.
  Replaced by in-memory concurrency coverage and a read-only connectivity check;
  actual MongoDB concurrent submission semantics have not been integration-tested.
- No real alerts/calls were sent. No application data was migrated or deleted.
