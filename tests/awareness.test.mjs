import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  completedSteps,
  currentTopic,
  displayDate,
  topicAnswers,
} from "../lib/awareness.ts";
const catalog = JSON.parse(
  readFileSync(
    new URL("../backend/app/data/awareness.json", import.meta.url),
    "utf8",
  ),
);
const topic = catalog.topics[0];

test("learning progress ignores old content versions and invalid choices", () => {
  const old = [
    { topic_id: topic.id, version: 0, answers: { check: "choice-1" } },
  ];
  assert.equal(completedSteps(topic, old), 0);
  const current = [
    {
      topic_id: topic.id,
      version: topic.version,
      answers: { check: "choice-1", habits: "invented", evil: "choice-1" },
    },
  ];
  assert.deepEqual(topicAnswers(topic, current), { check: "choice-1" });
  assert.equal(completedSteps(topic, current), 1);
});
test("expiry is explicit and unknown report dates are not invented", () => {
  assert.equal(currentTopic(topic, "2026-10-23"), true);
  assert.equal(currentTopic(topic, "2027-01-22"), false);
  assert.equal(currentTopic(topic, "2026-10-22"), false);
  assert.equal(displayDate(null, "en"), "Date not supplied");
  assert.match(displayDate(null, "hi"), /उपलब्ध नहीं/);
  assert.match(displayDate("2025-11-12", "en"), /12 Nov 2025/);
});
test("all bilingual lesson answers resolve to authored choices and evidence", () => {
  for (const topic of catalog.topics) {
    const ids = new Set(topic.claims.map((c) => c.id));
    for (const step of topic.steps) {
      assert.ok(step.choices.some((c) => c.id === step.answerId));
      assert.ok(step.claimIds.every((id) => ids.has(id)));
      assert.ok(step.prompt.en && step.prompt.hi);
    }
  }
});
