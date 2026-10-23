export type Language = "en" | "hi";
export type Bilingual = { en: string; hi: string };
export type AwarenessSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedOn: string | null;
  accessedOn: string;
  language: string;
  region: string;
  section: string;
  reuse: string;
};
export type AwarenessClaim = {
  id: string;
  text: Bilingual;
  sourceIds: string[];
  section: string;
};
export type AwarenessStep = {
  id: string;
  kind: string;
  prompt: Bilingual;
  choices: { id: string; label: Bilingual }[];
  answerId: string;
  claimIds: string[];
};
export type AwarenessTopic = {
  id: string;
  version: number;
  title: Bilingual;
  description: Bilingual;
  category: Bilingual;
  reviewedOn: string;
  reviewDue: string;
  reviewerRole: string;
  claims: AwarenessClaim[];
  steps: AwarenessStep[];
  takeawayIds: string[];
  questionIds: string[];
};
export type AwarenessReport = {
  id: string;
  title: Bilingual;
  publisher: string;
  url: string;
  publishedOn: string | null;
  period: Bilingual;
  summary: Bilingual;
  kind: Bilingual;
  reviewedOn: string;
  limitation: Bilingual;
};
export type AwarenessCatalog = {
  version: number;
  topics: AwarenessTopic[];
  sources: AwarenessSource[];
  reports: AwarenessReport[];
  weeklyReports: WeeklyOutbreakReport[];
};
export type WeeklyOutbreakReport = {
  sourceNote: Bilingual | null;
  id: string;
  title: Bilingual;
  publisher: string;
  url: string;
  publishedOn: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fileModifiedOn: string | null;
  reviewedOn: string | null;
  pages: number | null;
  week: number;
  year: number;
};
export type OutbreakArchive = {
  years: number[];
  year: number;
  reports: WeeklyOutbreakReport[];
  mode: "official" | "stale" | "fallback";
  listedAt: string | null;
};
export type LearningProgress = {
  topic_id: string;
  version: number;
  answers: Record<string, string>;
};
export type AwarenessExplanation = {
  mode: "ai" | "authored";
  text: string;
  claim_ids: string[];
};

export function currentTopic(
  topic: AwarenessTopic,
  today = new Date().toISOString().slice(0, 10),
) {
  return topic.reviewedOn <= today && today <= topic.reviewDue;
}
export function topicAnswers(
  topic: AwarenessTopic,
  progress: LearningProgress[],
) {
  const saved = progress.find(
    (p) => p.topic_id === topic.id && p.version === topic.version,
  );
  return Object.fromEntries(
    topic.steps.flatMap((step) => {
      const choice = saved?.answers[step.id];
      return typeof choice === "string" &&
        step.choices.some((c) => c.id === choice)
        ? [[step.id, choice]]
        : [];
    }),
  );
}
export function completedSteps(
  topic: AwarenessTopic,
  progress: LearningProgress[],
) {
  return Object.keys(topicAnswers(topic, progress)).length;
}
export function displayDate(value: string | null, language: Language) {
  if (!value)
    return language === "hi" ? "तारीख उपलब्ध नहीं" : "Date not supplied";
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}
