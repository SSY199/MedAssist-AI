import assert from "node:assert/strict";
import test from "node:test";
import { contactPhone, directionsUrl } from "../lib/sos.ts";

test("contact links require an explicit country code and strip display separators", () => {
  assert.equal(contactPhone("+91 (98765) 43210"), "919876543210");
  for (const value of [
    "9876543210",
    "",
    "+0bad",
    "javascript:alert(1)",
    "+91;evil",
  ])
    assert.equal(contactPhone(value), null);
});
test("directions link uses the facility coordinates", () => {
  const url = new URL(directionsUrl(19.076, 72.8777));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("destination"), "19.076,72.8777");
});

const { startSosCountdown } = await import("../lib/sos-countdown.ts");
function countdownHarness() {
  let now = 0;
  let tick;
  const result = { ticks: [], sent: 0, missed: 0, cleared: 0 };
  const cancel = startSosCountdown({
    now: () => now,
    schedule: (fn) => {
      tick = fn;
      return 1;
    },
    unschedule: () => {
      result.cleared++;
    },
    onTick: (seconds) => {
      result.ticks.push(seconds);
    },
    onExpire: () => {
      result.sent++;
    },
    onMissed: () => {
      result.missed++;
    },
  });
  return {
    result,
    cancel,
    at: (ms) => {
      now = ms;
      tick();
    },
  };
}
test("countdown expires exactly once after five seconds", () => {
  const h = countdownHarness();
  h.at(1000);
  h.at(4999);
  assert.equal(h.result.sent, 0);
  h.at(5000);
  h.at(6000);
  assert.equal(h.result.sent, 1);
  assert.equal(h.result.missed, 0);
  assert.deepEqual(h.result.ticks, [5, 4, 1, 0]);
});
test("cancelling just before expiry disarms later callbacks", () => {
  const h = countdownHarness();
  h.at(4999);
  h.cancel();
  h.at(5000);
  h.at(10000);
  assert.equal(h.result.sent, 0);
  assert.equal(h.result.missed, 0);
});
test("suspended overdue timers abort instead of sending a late alert", () => {
  const h = countdownHarness();
  h.at(15000);
  assert.equal(h.result.sent, 0);
  assert.equal(h.result.missed, 1);
});
test("cancelled runs cannot interfere with a fresh countdown", () => {
  const old = countdownHarness();
  old.cancel();
  const next = countdownHarness();
  old.at(5000);
  next.at(5000);
  assert.equal(old.result.sent, 0);
  assert.equal(next.result.sent, 1);
});
