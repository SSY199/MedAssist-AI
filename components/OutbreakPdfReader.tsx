"use client";
import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Language, WeeklyOutbreakReport } from "@/lib/awareness";
import { matchingReportPages } from "@/lib/outbreak-reports";

export function OutbreakPdfReader({
  report,
  language,
}: {
  report: WeeklyOutbreakReport;
  language: Language;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(700);
  const [error, setError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [text, setText] = useState("");
  const [textView, setTextView] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pagesText = useRef<string[] | null>(null);
  const searchSequence = useRef({ sequence: 0 });
  const hi = language === "hi";
  const source = `/api/awareness/reports/${report.id}?v=${encodeURIComponent(report.url.split("/").pop() ?? "")}`;
  useEffect(() => {
    const searches = searchSequence.current;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const [pdfjs, response] = await Promise.all([
          import("pdfjs-dist"),
          fetch(source, { signal: controller.signal }),
        ]);
        if (!response.ok) throw new Error("Report unavailable");
        const data = await response.arrayBuffer();
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        task = pdfjs.getDocument({ data, useWasm: false, enableXfa: false });
        const document = await task.promise;
        if (document.numPages > 500) throw new Error("Unsupported page count");
        if (cancelled) return;
        setPdf(document);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      ++searches.sequence;
      controller.abort();
      void task?.destroy();
    };
  }, [source]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(240, entries[0].contentRect.width - 32)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let renderingTask: RenderTask | undefined;
    void (async () => {
      try {
        const documentPage = await pdf.getPage(page);
        if (cancelled || !canvas.current) return;
        setRendering(true);
        const base = documentPage.getViewport({ scale: 1 });
        const viewport = documentPage.getViewport({
          scale: Math.min(width / base.width, 1.5) * zoom,
        });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const element = canvas.current;
        element.width = Math.floor(viewport.width * outputScale);
        element.height = Math.floor(viewport.height * outputScale);
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        renderingTask = documentPage.render({
          canvas: element,
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
        });
        const content = await documentPage.getTextContent();
        if (!cancelled)
          setText(
            content.items
              .map((item) =>
                "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
              )
              .join(""),
          );
        await renderingTask.promise;
        if (!cancelled) setRendering(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setRendering(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      renderingTask?.cancel();
    };
  }, [pdf, page, zoom, width]);
  async function search() {
    if (!pdf || searching || !query.trim()) return;
    const sequence = ++searchSequence.current.sequence;
    setSearching(true);
    setSearched(false);
    setMatches([]);
    try {
      if (!pagesText.current) {
        const all = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (sequence !== searchSequence.current.sequence) return;
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          all.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          );
        }
        pagesText.current = all;
      }
      if (sequence !== searchSequence.current.sequence) return;
      const found = matchingReportPages(pagesText.current, query);
      setMatches(found);
      setSearched(true);
      if (found.length) setPage(found[0]);
    } catch {
      if (sequence === searchSequence.current.sequence) setError(true);
    } finally {
      if (sequence === searchSequence.current.sequence) setSearching(false);
    }
  }
  const style =
    "border border-panel-border bg-transparent text-ink hover:bg-white/5";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className={style}
            disabled={!pdf || page === 1}
            onClick={() => setPage((n) => n - 1)}
            aria-label={hi ? "पिछला पृष्ठ" : "Previous page"}
          >
            <ChevronLeft size={16} />
          </Button>
          <label className="flex items-center gap-2 text-sm">
            {hi ? "पृष्ठ" : "Page"}
            <select
              disabled={!pdf}
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              className="rounded-lg border border-panel-border bg-bg-deep p-2 text-ink"
              aria-label={hi ? "पृष्ठ चुनें" : "Select page"}
            >
              {Array.from(
                { length: pdf?.numPages ?? report.pages ?? 1 },
                (_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1}
                  </option>
                ),
              )}
            </select>
            <span>
              {hi ? "में से" : "of"} {pdf?.numPages ?? report.pages ?? "…"}
            </span>
          </label>
          <Button
            className={style}
            disabled={!pdf || page === pdf.numPages}
            onClick={() => setPage((n) => n + 1)}
            aria-label={hi ? "अगला पृष्ठ" : "Next page"}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className={style}
            disabled={!pdf || zoom <= 0.6}
            onClick={() => setZoom((n) => Math.max(0.6, n - 0.2))}
            aria-label={hi ? "ज़ूम कम करें" : "Zoom out"}
          >
            <ZoomOut size={15} />
          </Button>
          <span className="min-w-12 text-center text-sm">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            className={style}
            disabled={!pdf || zoom >= 2}
            onClick={() => setZoom((n) => Math.min(2, n + 0.2))}
            aria-label={hi ? "ज़ूम बढ़ाएँ" : "Zoom in"}
          >
            <ZoomIn size={15} />
          </Button>
          <Button
            className={style}
            disabled={!pdf}
            onClick={() => setTextView((v) => !v)}
            aria-pressed={textView}
          >
            {hi
              ? textView
                ? "मूल पृष्ठ"
                : "पृष्ठ का पाठ"
              : textView
                ? "Original page"
                : "Page text"}
          </Button>
          <a
            className="flex items-center gap-2 rounded-lg border border-panel-border px-3 py-2 text-sm"
            href={`${source}&download=1`}
            download={`${report.id}.pdf`}
          >
            <Download size={14} />
            {hi ? "PDF सहेजें" : "Save PDF"}
          </a>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="border-b border-panel-border px-5 py-3"
      >
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-panel-border bg-bg-deep px-3">
            <Search size={15} className="text-ink-muted" />
            <input
              value={query}
              disabled={searching}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
                setMatches([]);
              }}
              maxLength={80}
              placeholder={
                hi
                  ? "मूल अंग्रेज़ी रिपोर्ट में खोजें, जैसे Dengue"
                  : "Search the original report, e.g. Dengue"
              }
              aria-label={hi ? "रिपोर्ट में खोजें" : "Search report"}
              className="w-full bg-transparent py-2.5 text-sm text-ink outline-none"
            />
          </label>
          <Button
            type="submit"
            disabled={!pdf || searching || !query.trim()}
            className={style}
          >
            {searching
              ? hi
                ? "खोज रहे हैं…"
                : "Searching…"
              : hi
                ? "खोजें"
                : "Find"}
          </Button>
        </div>
        <div aria-live="polite">
          {searched && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span>
                {matches.length
                  ? hi
                    ? "इन पृष्ठों पर मिला:"
                    : "Found on pages:"
                  : hi
                    ? "कोई परिणाम नहीं। मूल रिपोर्ट अंग्रेज़ी में है।"
                    : "No matches. The original report is in English."}
              </span>
              {matches.map((n) => (
                <button
                  type="button"
                  className="rounded border border-cyan/30 px-2 py-1 text-cyan"
                  key={n}
                  onClick={() => setPage(n)}
                  aria-label={`${hi ? "मिलान वाला पृष्ठ" : "Matching page"} ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>
      <div
        ref={host}
        className="max-h-[760px] min-h-80 overflow-auto bg-[#dfe4e0] p-4"
        aria-busy={!pdf || rendering}
      >
        <div role="status" className="text-center text-sm text-[#173a30]">
          {error
            ? hi
              ? "रिपोर्ट लोड नहीं हो सकी। ऊपर ‘रीडर फिर लोड करें’ चुनें।"
              : "The report could not be loaded. Use Reload reader above to retry."
            : !pdf
              ? hi
                ? "आधिकारिक रिपोर्ट लोड हो रही है…"
                : "Loading the official report…"
              : rendering
                ? hi
                  ? "पृष्ठ दिखा रहे हैं…"
                  : "Rendering page…"
                : hi
                  ? `मूल रिपोर्ट · पृष्ठ ${page}`
                  : `Original report · page ${page}`}
        </div>
        <canvas
          ref={canvas}
          hidden={textView || error}
          role="img"
          aria-label={`${report.title[language]} · ${hi ? "पृष्ठ" : "page"} ${page}`}
          className="mx-auto mt-3 bg-white shadow-lg"
        />
        {textView && (
          <div className="mx-auto mt-3 max-w-4xl rounded-lg bg-white p-5 text-[#15231c]">
            <p className="mb-4 text-sm font-semibold">
              {hi
                ? "निकाला गया मूल पाठ। तालिकाओं और नक्शों का सही स्वरूप मूल पृष्ठ पर देखें।"
                : "Extracted original text. Use Original page for the layout of tables and maps."}
            </p>
            <pre
              lang="en"
              className="whitespace-pre-wrap break-words font-sans text-base leading-relaxed"
            >
              {text}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
