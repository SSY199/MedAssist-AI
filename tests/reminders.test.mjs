import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDate,
  reminderTime,
  scheduleLabel,
  deliveryLabel,
  newReminderDraft,
} from "../lib/reminders.ts";

test("calendar dates follow the selected timezone across UTC midnight", () => {
  const instant = new Date("2026-10-23T20:00:00Z");
  assert.equal(calendarDate(instant, "Asia/Kolkata"), "2026-10-24");
  assert.equal(calendarDate(instant, "America/New_York"), "2026-10-23");
});
test("weekday labels preserve prescribed clock times and timezone", () => {
  assert.equal(
    scheduleLabel({
      recurrence: "weekdays",
      weekdays: [0, 4],
      times: ["09:00", "21:00"],
      timezone: "Asia/Kolkata",
    }),
    "Mon, Fri · 09:00, 21:00 · Asia/Kolkata",
  );
});
test("new drafts require explicit consent and SMTP acceptance is not delivery", () => {
  const draft = newReminderDraft();
  assert.equal(draft.email_enabled, false);
  assert.equal(draft.email_consent, false);
  assert.equal(deliveryLabel("accepted"), "Email accepted by provider");
  assert.match(deliveryLabel("unknown"), /automatic retry stopped/);
});

test("worker timestamps show seconds in the schedule timezone", () => {
  assert.match(
    reminderTime("2026-10-23T02:30:13.935Z", "Asia/Calcutta"),
    /08:00:13/,
  );
});
