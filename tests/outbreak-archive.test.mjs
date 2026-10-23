import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARCHIVE_TTL,
  OUTBREAK_ROOT,
  archiveReports,
  archiveYears,
  createArchiveLoader,
  reportIdentity,
} from "../lib/outbreak-archive.ts";

const reviewed = JSON.parse(
  readFileSync(
    new URL("../backend/app/data/awareness.json", import.meta.url),
    "utf8",
  ),
).weeklyReports;
const row = (href, date = "2026-09-10 05:13") =>
  `<tr><td><a href="${href}">${href}</a></td><td>${date}</td></tr>`;
const response = (html) =>
  new Response(html, { headers: { "content-type": "text/html" } });

test("year discovery allows only real listed year folders, sorts and deduplicates", () => {
  const html = [
    "2025/",
    "2009/",
    "2026/",
    "2025/",
    "../",
    "2099/",
    "https://evil.test/2024/",
    "https://user@ncdc.mohfw.gov.in/uploads/weekly_outbreaks/2024/",
    "/uploads/weekly_outbreaks/2023/?x=1",
  ]
    .map((href) => row(href))
    .join("");
  assert.deepEqual(archiveYears(html, 2026), [2026, 2025, 2009]);
});
test("historical and timestamped files are discovered without inventing missing weeks or periods", () => {
  const html = [
    row("week25.pdf"),
    row("week28_123.pdf"),
    row("week0.pdf"),
    row("week54.pdf"),
    row("https://evil.test/week27.pdf"),
    row("../2024/week26.pdf"),
    row("week29.pdf?url=evil"),
  ].join("");
  const reports = archiveReports(html, 2009);
  assert.deepEqual(
    reports.map((r) => r.week),
    [28, 25],
  );
  assert.ok(
    reports.every(
      (r) =>
        r.periodStart === null &&
        r.periodEnd === null &&
        r.pages === null &&
        r.reviewedOn === null &&
        r.publishedOn === null,
    ),
  );
  assert.equal(reports[0].fileModifiedOn, "2026-09-10");
  assert.equal(reports[0].id, "idsp-2009-week-28");
});
test("duplicate weeks prefer the newer source file, and reviewed metadata is matched by exact URL", () => {
  const known = reviewed[0];
  const filename = known.url.split("/").pop();
  const html =
    row(filename, "2026-10-13 04:15") + row("week34_1.pdf", "2026-01-01 00:00");
  assert.equal(
    archiveReports(html, 2026, reviewed)[0].periodStart,
    "2026-08-17",
  );
  const replaced = archiveReports(
    html + row("week34_9999999999.pdf", "2026-10-24 00:00"),
    2026,
    reviewed,
  )[0];
  assert.equal(replaced.reviewedOn, null);
  assert.equal(replaced.periodStart, null);
});
test("report IDs cannot inject paths, URLs, zero or future weeks/years", () => {
  assert.deepEqual(reportIdentity("idsp-2009-week-53"), {
    year: 2009,
    week: 53,
  });
  for (const id of [
    "https://evil.test",
    "idsp-2026-week-0",
    "idsp-2026-week-54",
    "idsp-2099-week-1",
    "idsp-2026-week-1/../../x",
  ])
    assert.equal(reportIdentity(id), null);
});
test("loader caches and coalesces official listings, omits credentials and limits requests to fixed paths", async () => {
  const calls = [];
  let now = 1000;
  const loader = createArchiveLoader(
    reviewed,
    async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, "error");
      assert.equal(options.credentials, "omit");
      assert.deepEqual(options.headers, { Accept: "text/html" });
      return response(url === OUTBREAK_ROOT ? row("2025/") : row("week52.pdf"));
    },
    () => now,
  );
  const [a, b] = await Promise.all([loader(2025), loader(2025)]);
  assert.equal(calls.length, 2);
  assert.equal(a.reports[0].week, 52);
  assert.equal(a.mode, "official");
  assert.deepEqual(a, b);
  now += ARCHIVE_TTL - 1;
  await loader(2025);
  assert.equal(calls.length, 2);
  now += 2;
  await loader(2025);
  assert.equal(calls.length, 4);
});
test("outages preserve stale timestamps or fall back to seed reports without pretending a different year exists", async () => {
  let now = 1000;
  let down = false;
  const loader = createArchiveLoader(
    reviewed,
    async (url) => {
      if (down) throw new Error("synthetic outage");
      return response(url === OUTBREAK_ROOT ? row("2025/") : row("week52.pdf"));
    },
    () => now,
  );
  const first = await loader(2025);
  now += ARCHIVE_TTL + 1;
  down = true;
  const stale = await loader(2025);
  assert.equal(stale.mode, "stale");
  assert.equal(stale.listedAt, first.listedAt);
  const cold = createArchiveLoader(reviewed, async () => {
    throw new Error("synthetic outage");
  });
  const seed = await cold(2026);
  assert.equal(seed.mode, "fallback");
  assert.equal(seed.reports.length, 3);
  assert.equal(seed.listedAt, null);
  await assert.rejects(() => cold(2009));
});
test("unknown/malformed years never fetch a user-controlled destination", async () => {
  const calls = [];
  const loader = createArchiveLoader([], async (url) => {
    calls.push(url);
    return response(row("2025/"));
  });
  await assert.rejects(() => loader(2024));
  assert.deepEqual(calls, [OUTBREAK_ROOT]);
  calls.length = 0;
  for (const year of [NaN, 2025.5, 1999, 2099])
    await assert.rejects(() => loader(year));
  assert.equal(calls.length, 0);
});
test("bad type, oversized or malformed listing data fail safely rather than expanding the PDF allowlist", async () => {
  for (const upstream of [
    new Response("x", { headers: { "content-type": "application/json" } }),
    new Response("x", { status: 404 }),
    new Response("x", {
      headers: {
        "content-type": "text/html",
        "content-length": String(1024 * 1024 + 1),
      },
    }),
    response("not a directory"),
  ]) {
    const loader = createArchiveLoader([], async () => upstream);
    await assert.rejects(() => loader());
  }
  assert.throws(() => archiveReports("x".repeat(1024 * 1024 + 1), 2025));
});
