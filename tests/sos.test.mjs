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
