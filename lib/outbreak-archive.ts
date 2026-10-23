import type { OutbreakArchive, WeeklyOutbreakReport } from "./awareness";

export const OUTBREAK_ROOT =
  "https://ncdc.mohfw.gov.in/uploads/weekly_outbreaks/";
export const ARCHIVE_TTL = 60 * 60 * 1000;
const HTML_LIMIT = 1024 * 1024;

function links(html: string) {
  // Bounded official directory HTML only; never execute or render its markup.
  if (html.length > HTML_LIMIT) throw new Error("Archive listing too large");
  return Array.from(
    html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>[^<]*<\/a>/gi),
    (match) => {
      const end = match.index! + match[0].length;
      const rowEnd = html.indexOf("</tr>", end);
      const tail = html.slice(
        end,
        rowEnd >= 0 ? Math.min(rowEnd, end + 250) : end + 100,
      );
      const modified = tail.match(/\b(20\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\b/);
      return {
        href: match[1],
        modified: modified ? `${modified[1]} ${modified[2]}` : null,
      };
    },
  );
}

function officialUrl(href: string, base: string) {
  try {
    const url = new URL(href, base);
    return url.origin === "https://ncdc.mohfw.gov.in" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
}

export function archiveYears(
  html: string,
  currentYear = new Date().getUTCFullYear(),
) {
  return [
    ...new Set(
      links(html).flatMap(({ href }) => {
        const url = officialUrl(href, OUTBREAK_ROOT);
        const match = url?.pathname.match(
          /^\/uploads\/weekly_outbreaks\/(20\d{2})\/$/,
        );
        const year = match ? Number(match[1]) : 0;
        return year >= 2000 && year <= currentYear ? [year] : [];
      }),
    ),
  ].sort((a, b) => b - a);
}

export function archiveReports(
  html: string,
  year: number,
  reviewed: WeeklyOutbreakReport[] = [],
) {
  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > new Date().getUTCFullYear()
  )
    throw new Error("Invalid archive year");
  const byWeek = new Map<
    number,
    { report: WeeklyOutbreakReport; rank: string }
  >();
  for (const { href, modified } of links(html)) {
    const url = officialUrl(href, `${OUTBREAK_ROOT}${year}/`);
    const match = url?.pathname.match(
      new RegExp(
        `^/uploads/weekly_outbreaks/${year}/week(\\d{1,2})(?:_\\d+)?\\.pdf$`,
        "i",
      ),
    );
    const week = match ? Number(match[1]) : 0;
    if (!url || week < 1 || week > 53) continue;
    const known = reviewed.find(
      (report) =>
        report.url === url.href && report.year === year && report.week === week,
    );
    const report: WeeklyOutbreakReport = known ?? {
      id: `idsp-${year}-week-${week}`,
      title: { en: `Week ${week} · ${year}`, hi: `सप्ताह ${week} · ${year}` },
      publisher: "NCDC / IDSP",
      url: url.href,
      publishedOn: null,
      periodStart: null,
      periodEnd: null,
      pages: null,
      fileModifiedOn: modified?.slice(0, 10) ?? null,
      reviewedOn: null,
      sourceNote: null,
      week,
      year,
    };
    const rank = `${modified ?? ""}|${url.pathname}`;
    if (!byWeek.has(week) || rank > byWeek.get(week)!.rank)
      byWeek.set(week, { report, rank });
  }
  return [...byWeek.values()]
    .map((row) => row.report)
    .sort((a, b) => b.week - a.week);
}

export function reportIdentity(id: string) {
  const match = id.match(/^idsp-(20\d{2})-week-([1-9]|[1-4]\d|5[0-3])$/);
  if (!match || Number(match[1]) > new Date().getUTCFullYear()) return null;
  return { year: Number(match[1]), week: Number(match[2]) };
}

async function directory(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, {
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(12000),
  });
  if (
    !response.ok ||
    !response.body ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("text/html") ||
    Number(response.headers.get("content-length")) > HTML_LIMIT
  )
    throw new Error("Archive unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > HTML_LIMIT) throw new Error("Archive listing too large");
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel();
  }
}

export function createArchiveLoader(
  reviewed: WeeklyOutbreakReport[],
  fetcher: typeof fetch = fetch,
  clock = Date.now,
) {
  const cache = new Map<string, { html: string; at: number }>();
  const inFlight = new Map<
    string,
    Promise<{ html: string; at: number; stale: boolean }>
  >();
  async function load(path: string) {
    const old = cache.get(path);
    if (old && clock() - old.at < ARCHIVE_TTL) return { ...old, stale: false };
    const running = inFlight.get(path);
    if (running) return running;
    const operation = (async () => {
      try {
        const value = {
          html: await directory(OUTBREAK_ROOT + path, fetcher),
          at: clock(),
        };
        if (cache.size >= 32 && !cache.has(path))
          cache.delete(cache.keys().next().value!);
        cache.set(path, value);
        return { ...value, stale: false };
      } catch (error) {
        if (old) return { ...old, stale: true };
        throw error;
      } finally {
        inFlight.delete(path);
      }
    })();
    inFlight.set(path, operation);
    return operation;
  }
  return async function getArchive(year?: number): Promise<OutbreakArchive> {
    if (
      year !== undefined &&
      (!Number.isInteger(year) ||
        year < 2000 ||
        year > new Date().getUTCFullYear())
    )
      throw new Error("Invalid archive year");
    try {
      const root = await load("");
      const years = archiveYears(root.html);
      if (!years.length) throw new Error("Archive has no listed years");
      const selected = year ?? years[0];
      if (!years.includes(selected)) throw new Error("Year not listed");
      const listing = await load(`${selected}/`);
      const reports = archiveReports(listing.html, selected, reviewed);
      if (!reports.length) throw new Error("No report links recognized");
      return {
        years,
        year: selected,
        reports,
        listedAt: new Date(Math.min(root.at, listing.at)).toISOString(),
        mode: root.stale || listing.stale ? "stale" : "official",
      };
    } catch (error) {
      const fallback = reviewed.filter(
        (report) => year === undefined || report.year === year,
      );
      if (!fallback.length) throw error;
      return {
        years: [...new Set(reviewed.map((report) => report.year))].sort(
          (a, b) => b - a,
        ),
        year: year ?? fallback[0].year,
        reports: fallback.sort((a, b) => b.week - a.week),
        listedAt: null,
        mode: "fallback",
      };
    }
  };
}
