"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutbreakPdfReader } from "@/components/OutbreakPdfReader";
import {
  displayDate,
  type Language,
  type OutbreakArchive,
  type WeeklyOutbreakReport,
} from "@/lib/awareness";

export function WeeklyOutbreakReports({
  reports,
  language,
}: {
  reports: WeeklyOutbreakReport[];
  language: Language;
}) {
  const initialYear = reports[0]?.year ?? new Date().getUTCFullYear();
  const [year, setYear] = useState(initialYear);
  const [archive, setArchive] = useState<OutbreakArchive>({
    years: [...new Set(reports.map((r) => r.year))],
    year: initialYear,
    reports,
    listedAt: null,
    mode: "fallback",
  });
  const [selected, setSelected] = useState(reports[0]?.id ?? "");
  const [reload, setReload] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  const hi = language === "hi";
  const available = archive.year === year ? archive.reports : [];
  const report = available.find((r) => r.id === selected) ?? available[0];
  useEffect(() => {
    const controller = new AbortController();
    const current = ++sequence.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      void fetch(`/api/awareness/reports?year=${year}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Archive unavailable");
          return response.json() as Promise<OutbreakArchive>;
        })
        .then((data) => {
          if (controller.signal.aborted || current !== sequence.current) return;
          setArchive(data);
          setSelected((old) =>
            data.reports.some((r) => r.id === old)
              ? old
              : (data.reports[0]?.id ?? ""),
          );
        })
        .catch(() => {
          if (!controller.signal.aborted && current === sequence.current)
            setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted && current === sequence.current)
            setLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [year, refresh]);
  return (
    <section
      aria-labelledby="weekly-outbreak-title"
      className="overflow-hidden rounded-3xl border border-cyan/20 bg-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-panel-border p-5 sm:p-7">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan">
            <FileText size={15} />
            {hi
              ? "NCDC / IDSP · आधिकारिक संग्रह"
              : "NCDC / IDSP · official archive"}
          </p>
          <h2
            id="weekly-outbreak-title"
            className="font-display text-2xl font-bold"
          >
            {hi ? "साप्ताहिक प्रकोप रिपोर्ट" : "Weekly outbreak reports"}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">
            {hi
              ? "वर्ष और सप्ताह चुनें। आधिकारिक संग्रह की उपलब्ध रिपोर्ट यहीं पढ़ें।"
              : "Choose a year and week. Read the reports available in the official archive right here."}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-end gap-3 lg:w-auto">
          <label className="flex flex-col gap-2 text-sm text-ink-muted">
            {hi ? "वर्ष" : "Year"}
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setLoading(true);
                setFailed(false);
              }}
              className="rounded-xl border border-panel-border bg-bg-deep px-4 py-3 text-base text-ink outline-none focus:border-cyan"
            >
              {archive.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-2 text-sm text-ink-muted">
            {hi ? "सप्ताह" : "Week"}
            <select
              disabled={!available.length || loading}
              value={report?.id ?? ""}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-xl border border-panel-border bg-bg-deep px-4 py-3 text-base text-ink outline-none focus:border-cyan disabled:opacity-60"
            >
              {!available.length && (
                <option value="">{hi ? "लोड हो रहा है…" : "Loading…"}</option>
              )}
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title[language]}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRefresh((n) => n + 1);
            }}
            className="h-auto gap-2 border border-panel-border bg-transparent px-3 py-3 text-ink hover:bg-white/5"
          >
            <RotateCcw size={14} />
            {hi ? "सूची फिर लोड करें" : "Reload list"}
          </Button>
        </div>
      </div>
      <div
        aria-live="polite"
        className="space-y-1 border-b border-panel-border px-5 py-3 text-sm text-ink-muted sm:px-7"
      >
        <p>
          {loading
            ? hi
              ? "आधिकारिक सूची लोड हो रही है…"
              : "Loading the official listing…"
            : hi
              ? `${year} में ${available.length} उपलब्ध साप्ताहिक रिपोर्ट`
              : `${available.length} weekly reports available for ${year}`}
        </p>
        {(failed || (!loading && archive.mode === "fallback")) && (
          <p className="text-amber">
            {hi
              ? "आधिकारिक सूची अभी उपलब्ध नहीं है। उपलब्ध सहेजी हुई रिपोर्ट दिखा रहे हैं; सूची फिर लोड करें।"
              : "Official listing unavailable. Showing any saved reports available for this year; reload the list to retry."}
          </p>
        )}
        {!loading && archive.mode === "stale" && (
          <p className="text-amber">
            {hi
              ? "स्रोत उपलब्ध नहीं है; पुरानी कैश की गई सूची दिखा रहे हैं।"
              : "Source unavailable; showing a previously cached listing."}
          </p>
        )}
        {archive.listedAt && archive.year === year && (
          <p className="text-xs">
            {hi ? "सूची प्राप्त हुई: " : "Listing retrieved: "}
            {new Intl.DateTimeFormat(hi ? "hi-IN" : "en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(archive.listedAt))}{" "}
            · {hi ? "कैश लगभग एक घंटे तक" : "listing cache up to one hour"}
          </p>
        )}
      </div>
      {report ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-border bg-cyan/5 px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <p className="flex items-center gap-2">
                <CalendarDays size={16} className="text-cyan" />
                {report.periodStart && report.periodEnd ? (
                  <>
                    {displayDate(report.periodStart, language)} –{" "}
                    {displayDate(report.periodEnd, language)}
                  </>
                ) : hi ? (
                  "रिपोर्टिंग तारीखों के लिए मूल दस्तावेज़ देखें"
                ) : (
                  "See the original document for reporting dates"
                )}
              </p>
              <span className="text-ink-muted">
                {report.pages
                  ? `${report.pages} ${hi ? "पृष्ठ · " : "pages · "}`
                  : ""}
                {hi ? "मूल भाषा: अंग्रेज़ी" : "original language: English"}
              </span>
            </div>
            <Button
              onClick={() => setReload((n) => n + 1)}
              className="gap-2 border border-panel-border bg-transparent text-ink hover:bg-white/5"
            >
              <RotateCcw size={14} />
              {hi ? "रीडर फिर लोड करें" : "Reload reader"}
            </Button>
          </div>
          {report.sourceNote && (
            <p className="border-b border-panel-border px-5 py-3 text-xs leading-relaxed text-amber sm:px-7">
              {report.sourceNote[language]}
            </p>
          )}
          <OutbreakPdfReader
            key={`${report.id}-${report.url}-${reload}`}
            report={report}
            language={language}
          />
          <div className="space-y-2 px-5 py-4 text-xs leading-relaxed text-ink-muted sm:px-7">
            <p className="text-amber">
              {hi
                ? "ऐतिहासिक रिपोर्ट, वर्तमान स्थानीय जोखिम नहीं। रिपोर्टिंग अधूरी हो सकती है; अनुपलब्ध सप्ताह का अर्थ शून्य मामले नहीं है।"
                : "Historical reporting, not current local risk. Coverage may be incomplete; a missing week does not mean zero cases."}
            </p>
            <p>
              {hi ? "स्रोत फ़ाइल में बदलाव: " : "Source file modified: "}
              {displayDate(report.fileModifiedOn, language)}
              {report.reviewedOn && (
                <>
                  {" "}
                  · {hi ? "अवधि जाँची: " : "Period reviewed: "}
                  {displayDate(report.reviewedOn, language)}
                </>
              )}
            </p>
            <p>
              {report.reviewedOn
                ? hi
                  ? "इस रिपोर्ट की अवधि अलग से जाँची गई है।"
                  : "This report’s period was individually checked."
                : hi
                  ? "वर्ष/सप्ताह स्रोत सूची से हैं। विस्तृत सामग्री और अवधि की अलग से समीक्षा नहीं हुई है; अपलोड की तारीख रिपोर्टिंग अवधि नहीं है।"
                  : "Year/week come from the source listing. Detailed contents and periods have not been individually reviewed; upload dates are not reporting periods."}
            </p>
            <p>
              {hi
                ? "खोज उपलब्ध PDF पाठ पर काम करती है, स्कैन किए गए शब्दों पर नहीं। नई फाइलें स्रोत की सूची अपडेट होने पर अगले सूची अनुरोध में मिलती हैं; यह लाइव निगरानी नहीं है।"
                : "Search uses available PDF text, not scanned words. Newly listed files appear on later requests after the listing cache refreshes; this is not live surveillance."}
            </p>
          </div>
        </>
      ) : (
        <p className="p-7 text-ink-muted">
          {loading
            ? hi
              ? "रिपोर्ट सूची की प्रतीक्षा है…"
              : "Waiting for the report listing…"
            : hi
              ? "इस वर्ष की रिपोर्ट अभी उपलब्ध नहीं है। दूसरा वर्ष चुनें या दोबारा प्रयास करें।"
              : "Reports for this year are unavailable. Choose another year or retry."}
        </p>
      )}
    </section>
  );
}
