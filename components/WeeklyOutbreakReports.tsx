"use client";
import { useState } from "react";
import { CalendarDays, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutbreakPdfReader } from "@/components/OutbreakPdfReader";
import {
  displayDate,
  type Language,
  type WeeklyOutbreakReport,
} from "@/lib/awareness";

export function WeeklyOutbreakReports({
  reports,
  language,
}: {
  reports: WeeklyOutbreakReport[];
  language: Language;
}) {
  const [selected, setSelected] = useState(reports[0]?.id ?? "");
  const [reload, setReload] = useState(0);
  const hi = language === "hi";
  const report = reports.find((r) => r.id === selected) ?? reports[0];
  if (!report) return null;
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
              ? "NCDC / IDSP · आधिकारिक दस्तावेज़"
              : "NCDC / IDSP · official documents"}
          </p>
          <h2
            id="weekly-outbreak-title"
            className="font-display text-2xl font-bold"
          >
            {hi ? "साप्ताहिक प्रकोप रिपोर्ट" : "Weekly outbreak reports"}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">
            {hi
              ? "सप्ताह चुनें और पूरी मूल रिपोर्ट यहीं पढ़ें। पृष्ठ, नक्शे और तालिकाएँ मूल दस्तावेज़ में हैं।"
              : "Choose a week and read the complete original report here, including its pages, maps and tables."}
          </p>
        </div>
        <label className="flex w-full flex-col gap-2 text-sm text-ink-muted sm:w-auto">
          {hi ? "रिपोर्ट चुनें" : "Select a report"}
          <select
            value={report.id}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-56 rounded-xl border border-panel-border bg-bg-deep px-4 py-3 text-base text-ink outline-none focus:border-cyan"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title[language]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-border bg-cyan/5 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays size={16} className="text-cyan" />
            {displayDate(report.periodStart, language)} –{" "}
            {displayDate(report.periodEnd, language)}
          </p>
          <span className="text-ink-muted">
            {report.pages}{" "}
            {hi
              ? "पृष्ठ · मूल भाषा: अंग्रेज़ी"
              : "pages · original language: English"}
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
        key={`${report.id}-${reload}`}
        report={report}
        language={language}
      />
      <div className="space-y-2 px-5 py-4 text-xs leading-relaxed text-ink-muted sm:px-7">
        <p className="text-amber">
          {hi
            ? "ऐतिहासिक रिपोर्ट, वर्तमान स्थानीय जोखिम नहीं। रिपोर्टिंग अधूरी हो सकती है; जानकारी न होने का अर्थ शून्य मामले नहीं है।"
            : "Historical reporting, not current local risk. Reporting may be incomplete; missing information does not mean zero cases."}
        </p>
        <p>
          {hi ? "स्रोत फ़ाइल में बदलाव: " : "Source file modified: "}
          {displayDate(report.fileModifiedOn, language)} ·{" "}
          {hi ? "लिंक और अवधि जाँची: " : "Link and period checked: "}
          {displayDate(report.reviewedOn, language)}
        </p>
        <p>
          {hi
            ? "मूल PDF ऐप में पढ़ें, पृष्ठ बदलें और ज़ूम करें। खोज उपलब्ध PDF पाठ पर काम करती है; स्कैन किए गए चित्रों के शब्द नहीं मिल सकते। यह चुना हुआ तीन-रिपोर्ट संग्रह है, लाइव फ़ीड नहीं।"
            : "Read, navigate and zoom the original PDF inside the app. Search uses available PDF text; words in scanned images may not match. This is a curated three-report collection, not a live feed."}
        </p>
      </div>
    </section>
  );
}
