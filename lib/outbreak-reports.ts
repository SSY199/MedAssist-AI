import type { WeeklyOutbreakReport } from "./awareness";

export const MAX_REPORT_BYTES = 8 * 1024 * 1024;

export function reviewedReport(reports: WeeklyOutbreakReport[], id: string) {
  const report = reports.find((r) => r.id === id);
  if (!report) return null;
  let url: URL;
  try {
    url = new URL(report.url);
  } catch {
    return null;
  }
  if (
    url.origin !== "https://ncdc.mohfw.gov.in" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !new RegExp(
      `^/uploads/weekly_outbreaks/${report.year}/week${report.week}_[0-9]+\\.pdf$`,
    ).test(url.pathname)
  )
    return null;
  return report;
}

export async function fetchReportPdf(
  report: WeeklyOutbreakReport,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(report.url, {
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/pdf" },
    cache: "force-cache",
    next: { revalidate: 86400 },
  });
  if (
    !response.ok ||
    !response.body ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/pdf") ||
    Number(response.headers.get("content-length")) > MAX_REPORT_BYTES
  )
    throw new Error("Report unavailable");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REPORT_BYTES) throw new Error("Report too large");
      parts.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  if (new TextDecoder().decode(result.slice(0, 5)) !== "%PDF-")
    throw new Error("Invalid report");
  return result;
}

export function matchingReportPages(pages: string[], query: string) {
  const term = query.trim().toLocaleLowerCase();
  return term
    ? pages.flatMap((text, i) =>
        text.toLocaleLowerCase().includes(term) ? [i + 1] : [],
      )
    : [];
}
