import test from "node:test";
import assert from "node:assert/strict";
import {
  trustedSellerUrl,
  referencePrice,
  prescriptionLabels,
} from "../lib/marketplace.ts";

test("seller links reject injected schemes, credentials, query and lookalike hosts", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://www.1mg.com.evil.test/x",
    "http://www.1mg.com/x",
    "https://user@www.1mg.com/x",
    "https://www.1mg.com/x?token=secret",
    "https://www.1mg.com:8000/x",
    "invalid",
  ])
    assert.equal(trustedSellerUrl(value), null);
  assert.equal(
    trustedSellerUrl("https://www.1mg.com/drugs/product"),
    "https://www.1mg.com/drugs/product",
  );
});

test("missing price is explicit and integer minor units preserve reference MRP", () => {
  assert.equal(
    referencePrice({ reference_price: null }),
    "Check current price on seller",
  );
  assert.equal(
    referencePrice({
      reference_price: { amount_minor: 3228, currency: "INR", kind: "MRP" },
    }),
    "₹32.28",
  );
  assert.match(prescriptionLabels.unknown, /unverified/);
});
