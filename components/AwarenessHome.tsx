"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  Heart,
  Languages,
  Leaf,
  MapPin,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  User,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AwarenessScene } from "@/components/AwarenessScene";
import { AwarenessLesson } from "@/components/AwarenessLesson";
import { apiFetch } from "@/lib/api-client";
import {
  completedSteps,
  currentTopic,
  displayDate,
  topicAnswers,
  type AwarenessCatalog,
  type AwarenessTopic,
  type Language,
  type LearningProgress,
} from "@/lib/awareness";

const topicIcons = [Heart, Leaf, Wind, ShieldCheck];
const accents = [
  "text-[#edb7a5] bg-[#edb7a5]/10",
  "text-[#d8dfa1] bg-[#d8dfa1]/10",
  "text-[#9fcdd5] bg-[#9fcdd5]/10",
  "text-[#b6d9b2] bg-[#b6d9b2]/10",
];

export default function AwarenessHome({
  catalog,
  firstName,
  profileReady,
}: {
  catalog: AwarenessCatalog;
  firstName: string;
  profileReady: boolean;
}) {
  const [language, setLanguage] = useState<Language>("en");
  const [progress, setProgress] = useState<LearningProgress[]>([]);
  const [progressState, setProgressState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [selection, setSelection] = useState<{
    id: string;
    step: number;
    visit: number;
    summary: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const lock = useRef(false);
  const sequence = useRef(0);
  const lessonRef = useRef<HTMLDivElement>(null);
  const hi = language === "hi";
  const active = catalog.topics.find((t) => t.id === selection?.id);
  const complete = catalog.topics.filter(
    (t) => currentTopic(t) && completedSteps(t, progress) === t.steps.length,
  ).length;
  const choices = catalog.topics.reduce(
    (sum, t) => sum + completedSteps(t, progress),
    0,
  );
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++sequence.current;
    try {
      const data = await apiFetch("/awareness/progress", { signal });
      if (!signal?.aborted && request === sequence.current) {
        setProgress(data.progress);
        setProgressState("ready");
      }
    } catch {
      if (!signal?.aborted && request === sequence.current)
        setProgressState("error");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem("medassist-awareness-language");
        if (saved === "hi" || saved === "en") setLanguage(saved);
      } catch {
        /* Storage may be unavailable. */
      }
      void load(controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  function changeLanguage(value: Language) {
    setLanguage(value);
    try {
      localStorage.setItem("medassist-awareness-language", value);
    } catch {
      /* Session switch still works. */
    }
  }
  function open(topic: AwarenessTopic, step?: number) {
    if (lock.current) return;
    const answers = topicAnswers(topic, progress);
    const next = topic.steps.findIndex((s) => !answers[s.id]);
    setSelection((old) => ({
      id: topic.id,
      step: step ?? Math.max(0, next),
      visit: (old?.visit ?? 0) + 1,
      summary: false,
    }));
    setError("");
    setTimeout(() => {
      lessonRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      lessonRef.current?.focus({ preventScroll: true });
    }, 30);
  }
  async function save(stepId: string, choiceId: string) {
    if (lock.current || !active) return false;
    lock.current = true;
    setSaving(true);
    setError("");
    ++sequence.current;
    try {
      await apiFetch(`/awareness/progress/${active.id}`, {
        method: "PUT",
        body: JSON.stringify({
          version: active.version,
          step_id: stepId,
          choice_id: choiceId,
        }),
      });
      setProgress((old) => {
        const answers = topicAnswers(active, old);
        return [
          ...old.filter((p) => p.topic_id !== active.id),
          {
            topic_id: active.id,
            version: active.version,
            answers: { ...answers, [stepId]: choiceId },
          },
        ];
      });
      setProgressState("ready");
      return true;
    } catch {
      setError(
        hi
          ? "प्रगति सहेजने की पुष्टि नहीं हो सकी। पाठ उपलब्ध है; कनेक्शन जाँचें और फिर प्रयास करें।"
          : "Could not confirm saved progress. Learning remains available; check the connection and retry.",
      );
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  async function reset() {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    ++sequence.current;
    try {
      await apiFetch("/awareness/progress", { method: "DELETE" });
      setProgress([]);
      setSelection(null);
      setResetOpen(false);
      setProgressState("ready");
    } catch {
      setError(
        hi
          ? "रीसेट की पुष्टि नहीं हो सकी। दोबारा लोड करके जाँचें।"
          : "Could not confirm reset. Reload to check before retrying.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const featured = catalog.topics.find((t) => t.id === "dengue")!;
  const resume = catalog.topics.find(
    (t) =>
      completedSteps(t, progress) > 0 &&
      completedSteps(t, progress) < t.steps.length &&
      currentTopic(t),
  );
  const found = catalog.topics.filter((t) =>
    `${t.title.en} ${t.title.hi} ${t.description.en} ${t.description.hi}`
      .toLocaleLowerCase()
      .includes(filter.toLocaleLowerCase().trim()),
  );
  return (
    <div
      lang={language}
      className="mx-auto max-w-[1440px] space-y-10 px-5 py-7 text-ink sm:px-8 lg:px-12 lg:py-10"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">
            {hi ? `फिर स्वागत है, ${firstName}` : `Welcome back, ${firstName}`}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {hi
              ? "आज कुछ ऐसा जानें जो काम आए।"
              : "A little awareness. A useful difference."}
          </h1>
        </div>
        <div
          className="flex items-center gap-2 rounded-full border border-panel-border bg-panel p-1.5"
          aria-label={hi ? "जागरूकता की भाषा" : "Awareness language"}
        >
          <Languages size={16} className="ml-2 text-ink-muted" />
          {(["en", "hi"] as const).map((l) => (
            <button
              type="button"
              key={l}
              disabled={saving}
              lang={l}
              aria-pressed={language === l}
              onClick={() => changeLanguage(l)}
              className={`rounded-full px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-trace ${language === l ? "bg-[#d8f0a8] font-semibold text-[#173a30]" : "text-ink-muted hover:text-ink"}`}
            >
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </header>
      <section
        aria-labelledby="awareness-title"
        className="grid overflow-hidden rounded-[28px] border border-panel-border bg-panel lg:grid-cols-[.95fr_1.05fr]"
      >
        <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-10">
          <p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[.15em] text-[#d8f0a8]">
            <span className="size-1.5 rounded-full bg-[#d8f0a8]" />
            {hi ? "जागरूकता स्टूडियो" : "The awareness studio"}
          </p>
          <h2
            id="awareness-title"
            className="max-w-lg font-display text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-[54px]"
          >
            {hi ? (
              <>
                बचाव को समझें।
                <br />
                <span className="text-[#d8f0a8]">एक नई नज़र से।</span>
              </>
            ) : (
              <>
                See the everyday.
                <br />
                <span className="text-[#d8f0a8]">Find the prevention.</span>
              </>
            )}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">
            {hi
              ? "एक घर। तीन सीखने के अवसर। दृश्य में खोजें, अपना विकल्प चुनें और उसके पीछे के प्रमाण समझें।"
              : "One home. Three moments to learn. Explore the scene, make a choice, and discover the evidence behind it."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              onClick={() => open(featured, 0)}
              className="h-auto gap-2 rounded-full bg-[#d8f0a8] px-5 py-3 font-semibold text-[#173a30] hover:bg-[#e5f5c3]"
            >
              {hi ? "दृश्य में खोजें" : "Explore the scene"}
              <ArrowUpRight size={17} />
            </Button>
            <a
              href="#awareness-topics"
              className="inline-flex items-center gap-2 rounded-full border border-panel-border px-5 py-3 text-sm hover:bg-white/5"
            >
              {hi ? "विषय चुनें" : "Browse topics"}
              <ArrowDown size={15} />
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              {hi ? "लगभग 3 मिनट" : "About 3 minutes"}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} />
              {hi ? "स्रोत सहित सीखें" : "Evidence you can inspect"}
            </span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">
            {hi
              ? "शिक्षा के लिए छात्र प्रोटोटाइप · पेशेवर चिकित्सा समीक्षा नहीं।"
              : "Educational student prototype · no professional medical review."}
          </p>
        </div>
        <div className="p-3 sm:p-5 lg:p-6">
          <AwarenessScene
            language={language}
            onExplore={(i) => open(featured, i)}
            completed={Object.keys(topicAnswers(featured, progress))}
          />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {featured.steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => open(featured, i)}
                className="rounded-full px-3 py-2 text-xs text-ink-muted underline decoration-panel-border underline-offset-4 hover:text-ink"
              >
                {i + 1}.{" "}
                {i === 0
                  ? hi
                    ? "पानी का बर्तन"
                    : "Water container"
                  : i === 1
                    ? hi
                      ? "खिड़की"
                      : "Window"
                    : hi
                      ? "दिन का बचाव"
                      : "Daytime protection"}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <section
          className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-panel-border bg-panel p-5 sm:p-6"
          aria-label={hi ? "सीखने की प्रगति" : "Learning progress"}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {hi ? "आपकी सीख" : "Your learning trail"}
            </p>
            <p className="mt-2 font-display text-xl font-semibold">
              {progressState === "loading"
                ? hi
                  ? "प्रगति लोड हो रही है…"
                  : "Loading your progress…"
                : progressState === "error"
                  ? hi
                    ? "सहेजी गई प्रगति उपलब्ध नहीं"
                    : "Saved progress unavailable"
                  : hi
                    ? `${complete} / 4 विषय पूरे · ${choices} निर्णय देखे`
                    : `${complete} of ${catalog.topics.length} topics complete · ${choices} decision${choices === 1 ? "" : "s"} explored`}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {hi
                ? "सीखने का रिकॉर्ड, स्वास्थ्य जोखिम का स्कोर नहीं।"
                : "Learning activity, never a health-risk score."}
            </p>
          </div>
          {progressState === "error" ? (
            <Button
              onClick={() => void load()}
              className="border border-panel-border bg-transparent text-ink"
            >
              {hi ? "फिर प्रयास करें" : "Retry"}
            </Button>
          ) : resume ? (
            <Button
              disabled={saving}
              onClick={() => open(resume)}
              className="gap-2 border border-panel-border bg-transparent text-trace"
            >
              {hi ? "आगे सीखें" : "Continue learning"}
              <ArrowRight size={15} />
            </Button>
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full border border-trace/20 text-trace">
              <Sparkles size={23} />
            </span>
          )}
        </section>
        <div className="rounded-2xl border border-[#d8dfa1]/15 bg-[#d8dfa1]/5 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#d8dfa1]">
            {hi
              ? "सवाल पूछना भी जागरूकता है"
              : "Curiosity is part of prevention"}
          </p>
          <p className="mt-2 text-base leading-relaxed">
            {hi
              ? "क्या कोई दावा भरोसेमंद है? हर पाठ में ‘क्यों’ और मूल स्रोत देखें।"
              : "What makes a health claim trustworthy? Every lesson lets you inspect the why—and the original source."}
          </p>
        </div>
      </div>
      <section
        id="awareness-topics"
        className="scroll-mt-28"
        aria-labelledby="topics-title"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-trace">
              {hi
                ? "वैश्विक समझ · भारत के लिए उपयोगी"
                : "Global perspective · relevant to India"}
            </p>
            <h2 id="topics-title" className="font-display text-2xl font-bold">
              {hi
                ? "किस बारे में जानना चाहेंगे?"
                : "What would you like to understand?"}
            </h2>
          </div>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            {hi ? "विषय खोजें" : "Find a topic"}
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-panel-border bg-panel px-4 py-2.5 text-base text-ink outline-none focus:border-trace sm:w-64"
              placeholder={hi ? "जैसे: मधुमेह" : "Try diabetes or TB"}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {found.map((topic) => {
            const i = catalog.topics.indexOf(topic);
            const Icon = topicIcons[i];
            const n = completedSteps(topic, progress);
            return (
              <button
                type="button"
                disabled={saving}
                key={topic.id}
                onClick={() => open(topic)}
                className="group flex flex-col rounded-2xl border border-panel-border bg-panel p-6 text-left transition-colors hover:border-trace/35 focus-visible:outline-2 focus-visible:outline-trace"
              >
                <div className="mb-6 flex w-full items-start justify-between">
                  <span
                    className={`flex size-12 items-center justify-center rounded-2xl ${accents[i]}`}
                  >
                    <Icon size={23} />
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="text-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </div>
                <p className="mb-2 text-xs text-ink-muted">
                  {topic.category[language]}
                </p>
                <h3 className="font-display text-xl font-semibold">
                  {topic.title[language]}
                </h3>
                <p className="mb-6 mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
                  {topic.description[language]}
                </p>
                <div className="flex w-full items-center justify-between gap-2 border-t border-panel-border pt-4 text-xs text-ink-muted">
                  <span>
                    {hi
                      ? "3 निर्णय · प्रमाण सहित"
                      : "3 decisions · sources included"}
                  </span>
                  <span className="text-trace">
                    {!currentTopic(topic)
                      ? hi
                        ? "समीक्षा आवश्यक"
                        : "Review needed"
                      : `${n}/3`}
                    {n === 3 && <Check size={12} className="ml-1 inline" />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {!found.length && (
          <p className="rounded-2xl border border-panel-border p-6 text-ink-muted">
            {hi
              ? "अभी इस संग्रह में यह विषय नहीं है। दूसरे शब्द से खोजें।"
              : "This topic isn’t in the current collection. Try another term."}
          </p>
        )}
      </section>
      <div
        id="awareness-lesson"
        ref={lessonRef}
        tabIndex={-1}
        className="scroll-mt-28 outline-none"
      >
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-amber/30 bg-amber/5 p-4 text-amber"
          >
            {error}
          </p>
        )}
        {active && selection && (
          <AwarenessLesson
            key={`${selection.id}-${selection.visit}-${language}`}
            topic={active}
            catalog={catalog}
            language={language}
            answers={topicAnswers(active, progress)}
            saving={saving}
            onSave={save}
            initialStep={selection.step}
            initialSummary={selection.summary}
            onPosition={(step, summary) =>
              setSelection((old) =>
                old && old.id === selection.id && old.visit === selection.visit
                  ? { ...old, step, summary }
                  : old,
              )
            }
          />
        )}
      </div>
      <section aria-labelledby="reports-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-cyan">
              {hi ? "मूल जानकारी तक पहुँचें" : "Go beyond the headline"}
            </p>
            <h2 id="reports-title" className="font-display text-2xl font-bold">
              {hi
                ? "आधिकारिक रिपोर्ट, सही संदर्भ में"
                : "Official reports, in context"}
            </h2>
          </div>
          <span className="rounded-full border border-panel-border px-3 py-1.5 text-xs text-ink-muted">
            {hi
              ? "चुना हुआ संग्रह · लाइव निगरानी नहीं"
              : "Curated collection · not live surveillance"}
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {catalog.reports.map((report) => (
            <article
              key={report.id}
              className="flex flex-col rounded-2xl border border-panel-border bg-panel p-6"
            >
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-cyan">
                {report.kind[language]}
              </p>
              <h3 className="font-display text-xl font-semibold">
                {report.title[language]}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {report.summary[language]}
              </p>
              <dl className="mt-5 space-y-2 text-xs text-ink-muted">
                <div>
                  <dt className="inline">{hi ? "अवधि: " : "Period: "}</dt>
                  <dd className="inline text-ink">{report.period[language]}</dd>
                </div>
                <div>
                  <dt className="inline">{hi ? "प्रकाशन: " : "Published: "}</dt>
                  <dd className="inline">
                    {displayDate(report.publishedOn, language)}
                  </dd>
                </div>
                <div>
                  <dt className="inline">
                    {hi ? "लिंक जाँचा: " : "Link reviewed: "}
                  </dt>
                  <dd className="inline">
                    {displayDate(report.reviewedOn, language)}
                  </dd>
                </div>
              </dl>
              <p className="mb-5 mt-4 rounded-lg bg-bg-deep/60 p-3 text-xs leading-relaxed text-amber">
                {report.limitation[language]}
              </p>
              <a
                className="mt-auto flex items-center gap-2 text-sm font-medium text-cyan underline underline-offset-4"
                href={report.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {report.publisher} ·{" "}
                {hi ? "मूल स्रोत खोलें" : "Read the original"}
                <ExternalLink size={14} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section
        aria-label={hi ? "आपके अन्य उपकरण" : "Your everyday tools"}
        className="rounded-2xl border border-panel-border bg-panel p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">
              {hi ? "आपकी देखभाल के उपकरण" : "Your care, within reach"}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {hi
                ? "सीख से आगे, आपके उपयोगी उपकरण।"
                : "Keep the practical tools close."}
            </p>
          </div>
          <Link
            href={profileReady ? "/profile" : "/onboarding"}
            className="flex items-center gap-2 text-sm text-trace underline underline-offset-4"
          >
            <User size={15} />
            {profileReady
              ? hi
                ? "अपनी प्रोफ़ाइल देखें"
                : "View your profile"
              : hi
                ? "प्रोफ़ाइल पूरी करें"
                : "Complete your profile"}
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              href: "/chat",
              Icon: MessageSquare,
              en: "Health chat",
              hi: "स्वास्थ्य चैट",
            },
            {
              href: "/map",
              Icon: MapPin,
              en: "Nearby care",
              hi: "आसपास देखभाल",
            },
            {
              href: "/marketplace",
              Icon: ShoppingBag,
              en: "Medicine finder",
              hi: "दवा खोजें",
            },
            {
              href: "/reminders",
              Icon: Clock,
              en: "Reminders",
              hi: "दवा रिमाइंडर",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between gap-2 rounded-xl border border-panel-border px-4 py-3 text-sm hover:border-trace/30"
            >
              <span className="flex items-center gap-2">
                <item.Icon size={16} className="text-ink-muted" />
                {hi ? item.hi : item.en}
              </span>
              <ArrowUpRight size={13} />
            </Link>
          ))}
        </div>
      </section>
      <footer className="space-y-4 border-t border-panel-border pb-4 pt-6 text-xs leading-relaxed text-ink-muted">
        <p className="flex items-start gap-2">
          <Stethoscope size={16} className="mt-0.5 shrink-0" />
          {hi
            ? "स्रोत-आधारित छात्र प्रोटोटाइप। पेशेवर चिकित्सा या अनुवाद समीक्षा नहीं हुई है। यह सामान्य शिक्षा है, निदान या व्यक्तिगत उपचार नहीं। गंभीर या तत्काल समस्या में चिकित्सकीय सहायता लें। WHO या अन्य संस्थाओं का समर्थन प्राप्त नहीं है।"
            : "Source-reviewed student prototype. No professional medical or translation review. General education, not diagnosis or personal treatment. Seek medical help for serious or urgent concerns. No endorsement by WHO or other source organisations."}
        </p>
        <p>
          {hi
            ? "हिन्दी पाठ ऐप का रूपांतरण है; मूल अंग्रेज़ी स्रोत जुड़े हैं। सीखने का रिकॉर्ड आपके खाते में सहेजा जाता है। AI प्रश्न/उत्तर हमारे प्रगति रिकॉर्ड में सहेजे नहीं जाते।"
            : "Hindi text is an app adaptation; original English sources are linked. Learning progress is saved to your account. AI questions/answers are not stored in our progress records."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {!resetOpen ? (
            <button
              type="button"
              disabled={saving || progressState !== "ready"}
              onClick={() => setResetOpen(true)}
              className="flex items-center gap-1.5 underline underline-offset-4 disabled:opacity-50"
            >
              <RotateCcw size={12} />
              {hi ? "सीखने की प्रगति रीसेट करें" : "Reset learning progress"}
            </button>
          ) : (
            <>
              <span>
                {hi
                  ? "केवल जागरूकता की सहेजी गई प्रगति मिटाएँ?"
                  : "Remove saved awareness progress only?"}
              </span>
              <Button
                disabled={saving}
                onClick={() => void reset()}
                className="border border-alert/30 bg-alert/10 text-alert"
              >
                {hi ? "हाँ, रीसेट करें" : "Yes, reset"}
              </Button>
              <Button
                disabled={saving}
                onClick={() => setResetOpen(false)}
                className="border border-panel-border bg-transparent text-ink"
              >
                {hi ? "रद्द करें" : "Cancel"}
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
