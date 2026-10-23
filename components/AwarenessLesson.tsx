"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  currentTopic,
  displayDate,
  type AwarenessCatalog,
  type AwarenessClaim,
  type AwarenessExplanation,
  type AwarenessTopic,
  type Language,
} from "@/lib/awareness";

export function Evidence({
  claims,
  catalog,
  language,
}: {
  claims: AwarenessClaim[];
  catalog: AwarenessCatalog;
  language: Language;
}) {
  const hi = language === "hi";
  return (
    <div className="space-y-3">
      {claims.map((claim) => (
        <div key={claim.id} className="border-l-2 border-trace/30 pl-4">
          <p className="text-base leading-relaxed text-ink">
            {claim.text[language]}
          </p>
          {claim.sourceIds.map((id) => {
            const source = catalog.sources.find((s) => s.id === id)!;
            return (
              <a
                key={id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cyan underline decoration-cyan/30 underline-offset-4"
              >
                {source.publisher} · {source.title} <ExternalLink size={12} />
                <span className="text-ink-muted">
                  {hi ? "मूल स्रोत: अंग्रेज़ी" : "Original: English"} ·{" "}
                  {displayDate(source.publishedOn, language)} · {claim.section}
                </span>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function AwarenessLesson({
  topic,
  catalog,
  language,
  answers,
  saving,
  onSave,
  initialStep = 0,
  initialSummary = false,
  onPosition,
}: {
  topic: AwarenessTopic;
  catalog: AwarenessCatalog;
  language: Language;
  answers: Record<string, string>;
  saving: boolean;
  onSave: (stepId: string, choiceId: string) => Promise<boolean>;
  initialStep?: number;
  initialSummary?: boolean;
  onPosition: (step: number, summary: boolean) => void;
}) {
  const hi = language === "hi";
  const [index, setIndex] = useState(initialStep);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(initialSummary);
  const [explanation, setExplanation] = useState<AwarenessExplanation | null>(
    null,
  );
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const request = useRef<AbortController | null>(null);
  const askLock = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  const step = topic.steps[index];
  const selected = picks[step.id] ?? answers[step.id];
  const claims = topic.claims.filter((c) => step.claimIds.includes(c.id));
  function move(step: number, summary = false) {
    setIndex(step);
    setShowSummary(summary);
    onPosition(step, summary);
  }
  async function next() {
    if (!selected || saving) return;
    if (!(await onSave(step.id, selected))) return;
    if (index < topic.steps.length - 1) move(index + 1);
    else move(index, true);
  }
  async function ask(question: string) {
    if (askLock.current) return;
    askLock.current = true;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setAsking(true);
    setExplanation(null);
    setAskError("");
    try {
      const result: AwarenessExplanation = await apiFetch(
        `/awareness/${topic.id}/explain`,
        {
          method: "POST",
          body: JSON.stringify({
            version: topic.version,
            language,
            question_id: question,
          }),
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted) setExplanation(result);
    } catch {
      if (!controller.signal.aborted)
        setAskError(
          hi
            ? "अभी व्याख्या उपलब्ध नहीं है या सीमा पूरी हो गई है। नीचे स्रोत-आधारित जानकारी पढ़ सकते हैं।"
            : "Explanation unavailable or limit reached. The source-backed learning points below remain available.",
        );
    } finally {
      askLock.current = false;
      if (!controller.signal.aborted) setAsking(false);
    }
  }
  if (!currentTopic(topic))
    return (
      <section className="rounded-2xl border border-amber/30 bg-panel p-6">
        <h3 className="text-xl font-bold">
          {hi ? "सामग्री की समीक्षा आवश्यक है" : "Content review needed"}
        </h3>
        <p className="mt-2 text-ink-muted">
          {hi
            ? "इस पाठ और AI को समीक्षा तक रोक दिया गया है। मूल स्रोत देखें।"
            : "This lesson and AI are paused until editorial review. Consult the original sources."}
        </p>
        {[...new Set(topic.claims.flatMap((c) => c.sourceIds))].map((id) => (
          <a
            className="mt-3 block text-cyan underline"
            key={id}
            href={catalog.sources.find((s) => s.id === id)!.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {catalog.sources.find((s) => s.id === id)!.title}
          </a>
        ))}
      </section>
    );
  return (
    <section
      aria-label={hi ? "इंटरैक्टिव पाठ" : "Interactive lesson"}
      className="overflow-hidden rounded-3xl border border-panel-border bg-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-panel-border p-5 sm:px-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-trace">
            {hi ? "देखें · चुनें · समझें" : "Notice · choose · understand"}
          </p>
          <h3 className="mt-2 font-display text-2xl font-bold">
            {topic.title[language]}
          </h3>
        </div>
        <span className="rounded-full border border-panel-border px-3 py-2 text-xs text-ink-muted">
          {hi ? "स्रोत जाँचे गए" : "Sources checked"} ·{" "}
          {displayDate(topic.reviewedOn, language)}
        </span>
      </div>
      <div className="grid lg:grid-cols-[1.25fr_1fr]">
        <div className="p-5 sm:p-8">
          <div
            className="mb-7 flex gap-2"
            aria-label={hi ? "पाठ के चरण" : "Lesson steps"}
          >
            {topic.steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                disabled={saving}
                aria-current={!showSummary && index === i ? "step" : undefined}
                onClick={() => {
                  move(i);
                }}
                className={`flex size-10 items-center justify-center rounded-full border text-sm focus-visible:outline-2 focus-visible:outline-trace ${index === i && !showSummary ? "border-trace bg-trace/10 text-trace" : "border-panel-border text-ink-muted"}`}
                aria-label={`${hi ? "चरण" : "Step"} ${i + 1}`}
              >
                {answers[s.id] ? <Check size={16} /> : i + 1}
              </button>
            ))}
          </div>
          {showSummary ? (
            <div aria-live="polite">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-trace/10 text-trace">
                <Check size={24} />
              </span>
              <h4 className="mt-4 font-display text-2xl font-bold">
                {hi ? "सीख को अपने साथ ले जाएँ" : "Take the learning with you"}
              </h4>
              <p className="mt-2 text-base leading-relaxed text-ink-muted">
                {hi
                  ? "आपकी प्रगति सहेजी गई है। यह सीखने की गतिविधि का रिकॉर्ड है, स्वास्थ्य सुरक्षा का स्कोर नहीं।"
                  : "Your progress is saved. This records learning activity, not a score of your health or protection."}
              </p>
              <Button
                onClick={() => {
                  move(0);
                }}
                className="mt-6 border border-panel-border bg-transparent text-ink"
              >
                {hi ? "फिर से देखें" : "Revisit the decisions"}
              </Button>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber">
                {step.kind === "evidence"
                  ? hi
                    ? "दावे की पड़ताल"
                    : "Challenge a claim"
                  : hi
                    ? "एक काल्पनिक स्थिति"
                    : "A fictional situation"}
              </p>
              <h4 className="text-xl font-semibold leading-relaxed sm:text-2xl">
                {step.prompt[language]}
              </h4>
              <div className="mt-6 space-y-3">
                {step.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={saving}
                    aria-pressed={selected === choice.id}
                    onClick={() => setPicks({ ...picks, [step.id]: choice.id })}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-base leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace ${selected === choice.id ? "border-trace/60 bg-trace/10" : "border-panel-border hover:border-trace/30"}`}
                  >
                    <span
                      className={`size-4 shrink-0 rounded-full border ${selected === choice.id ? "border-trace bg-trace" : "border-ink-muted"}`}
                    />
                    {choice.label[language]}
                  </button>
                ))}
              </div>
              {selected && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-trace/20 bg-trace/5 p-4"
                >
                  <p className="mb-3 text-sm font-semibold text-trace">
                    {selected === step.answerId
                      ? hi
                        ? "यह विकल्प प्रमाण से मेल खाता है।"
                        : "This choice matches the evidence."
                      : hi
                        ? "आइए प्रमाण से समझें। सही विकल्प:"
                        : "Let’s check the evidence. The supported choice is:"}
                  </p>
                  {selected !== step.answerId && (
                    <p className="mb-3 text-base font-medium">
                      {
                        step.choices.find((c) => c.id === step.answerId)!.label[
                          language
                        ]
                      }
                    </p>
                  )}
                  <Evidence
                    claims={claims}
                    catalog={catalog}
                    language={language}
                  />
                </div>
              )}
              <Button
                disabled={!selected || saving}
                onClick={() => void next()}
                className="mt-6 h-auto gap-2 bg-trace px-5 py-3 text-[#052914] hover:bg-trace/90"
              >
                {saving
                  ? hi
                    ? "सहेज रहे हैं…"
                    : "Saving…"
                  : index === topic.steps.length - 1
                    ? hi
                      ? "सहेजें और सार देखें"
                      : "Save & see takeaways"
                    : hi
                      ? "सहेजें और आगे बढ़ें"
                      : "Save & continue"}
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
        <aside className="border-t border-panel-border bg-bg-deep/40 p-5 sm:p-8 lg:border-l lg:border-t-0">
          <h4 className="mb-5 flex items-center gap-2 font-semibold">
            <BookOpen size={17} className="text-trace" />
            {hi ? "तीन बातें याद रखें" : "Three things to remember"}
          </h4>
          <Evidence
            claims={topic.claims.filter((c) =>
              topic.takeawayIds.includes(c.id),
            )}
            catalog={catalog}
            language={language}
          />
          <div className="mt-8 border-t border-panel-border pt-6">
            <h4 className="flex items-center gap-2 font-semibold">
              <Sparkles size={17} className="text-amber" />
              {hi ? "AI से आसान भाषा में समझें" : "Let AI make it clearer"}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {hi
                ? "केवल चुना गया प्रश्न, भाषा और इस विषय के प्रमाण Gemini को भेजे जाते हैं। आपकी प्रोफ़ाइल या चैट नहीं। AI गलती कर सकता है।"
                : "Only the prepared question, language and this topic’s evidence go to Gemini. No profile or chat history. AI can make mistakes."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {topic.questionIds.map((id) => (
                <Button
                  key={id}
                  disabled={asking}
                  onClick={() => void ask(id)}
                  className="h-auto whitespace-normal border border-amber/25 bg-amber/5 px-3 py-2 text-amber hover:bg-amber/10"
                >
                  {id === "basics"
                    ? hi
                      ? "मुख्य बातें समझाएँ"
                      : "Explain the essentials"
                    : hi
                      ? "बचाव के कदम समझाएँ"
                      : "Explain the useful actions"}
                </Button>
              ))}
            </div>
            <div aria-live="polite">
              {asking && (
                <p className="mt-4 text-sm text-ink-muted">
                  {hi
                    ? "प्रमाण के आधार पर समझा रहे हैं…"
                    : "Explaining from the evidence…"}
                </p>
              )}
              {askError && (
                <p className="mt-4 text-sm text-amber">{askError}</p>
              )}
              {explanation && (
                <div className="mt-4 rounded-xl border border-panel-border bg-panel p-4">
                  <p className="mb-2 text-xs font-semibold text-amber">
                    {explanation.mode === "ai"
                      ? hi
                        ? "AI व्याख्या · मूल स्रोत जाँचें"
                        : "AI explanation · check original sources"
                      : hi
                        ? "AI उपलब्ध नहीं · पहले से तैयार सार"
                        : "AI unavailable · authored summary"}
                  </p>
                  <p className="whitespace-pre-wrap text-base leading-relaxed">
                    {explanation.text}
                  </p>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-cyan">
                      {hi
                        ? "समर्थन देने वाले प्रमाण"
                        : "Supporting learning points"}
                    </summary>
                    <div className="mt-3">
                      <Evidence
                        claims={topic.claims.filter((c) =>
                          explanation.claim_ids.includes(c.id),
                        )}
                        catalog={catalog}
                        language={language}
                      />
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
