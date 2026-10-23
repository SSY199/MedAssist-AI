import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fetchReportPdf,
  matchingReportPages,
  MAX_REPORT_BYTES,
  reviewedReport,
} from "../lib/outbreak-reports.ts";
const catalog = JSON.parse(
  readFileSync(
    new URL("../backend/app/data/awareness.json", import.meta.url),
    "utf8",
  ),
);
const report = catalog.weeklyReports[0];

test("only reviewed official PDFs are accepted; arbitrary URLs cannot become proxy targets", () => {
  assert.equal(reviewedReport(catalog.weeklyReports, report.id), report);
  assert.equal(
    reviewedReport(catalog.weeklyReports, "https://evil.test/x"),
    null,
  );
  for (const url of [
    "not-a-url",
    "http://ncdc.mohfw.gov.in/x.pdf",
    "https://ncdc.mohfw.gov.in.evil.test/x.pdf",
    "https://user@ncdc.mohfw.gov.in/x.pdf",
    "https://ncdc.mohfw.gov.in/uploads/weekly_outbreaks/2026/week1_1.pdf",
    report.url + "?url=https://evil.test",
  ]) {
    assert.equal(reviewedReport([{ ...report, url }], report.id), null);
  }
});
test("PDF fetch omits user credentials and rejects upstream redirects", async () => {
  const bytes = new TextEncoder().encode("%PDF-synthetic");
  const result = await fetchReportPdf(report, async (url, options) => {
    assert.equal(url, report.url);
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    assert.deepEqual(options.headers, { Accept: "application/pdf" });
    return new Response(bytes, {
      headers: { "content-type": "application/pdf" },
    });
  });
  assert.deepEqual(result, bytes);
});
test("bad type, status, magic and oversized PDF payloads are rejected", async () => {
  for (const response of [
    new Response("not pdf", { headers: { "content-type": "text/html" } }),
    new Response("missing", { status: 404 }),
    new Response("not pdf", { headers: { "content-type": "application/pdf" } }),
    new Response("%PDF-x", {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(MAX_REPORT_BYTES + 1),
      },
    }),
    new Response(new Uint8Array(MAX_REPORT_BYTES + 1), {
      headers: { "content-type": "application/pdf" },
    }),
  ]) {
    await assert.rejects(() => fetchReportPdf(report, async () => response));
  }
});
test("report search is literal and returns one-based matching pages", () => {
  assert.deepEqual(
    matchingReportPages(
      ["Dengue cases", "Other report", "Suspected dengue"],
      " dengue ",
    ),
    [1, 3],
  );
  assert.deepEqual(matchingReportPages(["Dengue"], "["), []);
  assert.deepEqual(matchingReportPages(["Dengue"], " "), []);
});
