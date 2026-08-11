"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveProfile, type PatientProfileInput } from "@/lib/profile-actions";

const COMMON_CONDITIONS = [
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Hypertension",
  "Asthma",
  "Heart Disease",
  "Thyroid Disorder",
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-panel-border bg-bg-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:border-trace-dim focus:outline-none"
    />
  );
}

function TagListInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <TextInput
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-lg border border-panel-border px-4 text-sm font-semibold text-ink hover:bg-white/5"
        >
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="flex items-center gap-1.5 rounded-full border border-panel-border bg-white/3 px-3 py-1 font-mono text-xs text-ink"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="text-ink-dim hover:text-alert"
                aria-label={`Remove ${v}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EhrForm({
  initialData,
  redirectTo = "/dashboard",
  submitLabel = "Save and continue",
}: {
  initialData?: PatientProfileInput | null;
  redirectTo?: string;
  submitLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [age, setAge] = useState(initialData?.age?.toString() ?? "");
  const [gender, setGender] = useState(initialData?.gender ?? "");
  const [chronicIllnesses, setChronicIllnesses] = useState<string[]>(
    initialData?.chronicIllnesses.filter((c) => COMMON_CONDITIONS.includes(c)) ?? []
  );
  const [otherCondition, setOtherCondition] = useState(
    initialData?.chronicIllnesses
      .filter((c) => !COMMON_CONDITIONS.includes(c))
      .join(", ") ?? ""
  );
  const [pastMedicalIncidents, setPastMedicalIncidents] = useState(
    initialData?.pastMedicalIncidents ?? ""
  );
  const [currentMedications, setCurrentMedications] = useState<string[]>(
    initialData?.currentMedications ?? []
  );
  const [allergies, setAllergies] = useState<string[]>(initialData?.allergies ?? []);
  const [emergencyContactName, setEmergencyContactName] = useState(
    initialData?.emergencyContactName ?? ""
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initialData?.emergencyContactPhone ?? ""
  );

  function toggleCondition(condition: string) {
    setChronicIllnesses((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAge = Number(age);
    if (!age || Number.isNaN(parsedAge) || parsedAge <= 0) {
      setError("Enter a valid age to continue.");
      return;
    }
    if (!gender) {
      setError("Select a gender to continue.");
      return;
    }

    const allConditions = otherCondition.trim()
      ? [...chronicIllnesses, ...otherCondition.split(",").map((c) => c.trim()).filter(Boolean)]
      : chronicIllnesses;

    startTransition(async () => {
      await saveProfile(
        {
          age: parsedAge,
          gender,
          chronicIllnesses: allConditions,
          pastMedicalIncidents,
          currentMedications,
          allergies,
          emergencyContactName,
          emergencyContactPhone,
        },
        redirectTo
      );
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-2xl rounded-card border border-panel-border bg-panel p-8"
    >
      <section className="mb-8">
        <h2 className="mb-4 font-display text-base font-bold text-ink">About you</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Age</Label>
            <TextInput
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="32"
            />
          </div>
          <div>
            <Label>Gender</Label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-lg border border-panel-border bg-bg-deep px-3 py-2.5 text-sm text-ink focus:border-trace-dim focus:outline-none"
            >
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-base font-bold text-ink">
          Chronic conditions
        </h2>
        <p className="mb-4 text-xs text-ink-muted">
          Select any that apply — this helps the AI chatbot and emergency SOS
          give you relevant answers.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {COMMON_CONDITIONS.map((condition) => (
            <label
              key={condition}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-panel-border px-3 py-2.5 text-sm text-ink has-checked:border-trace-dim has-checked:bg-trace/6"
            >
              <input
                type="checkbox"
                checked={chronicIllnesses.includes(condition)}
                onChange={() => toggleCondition(condition)}
                className="accent-trace"
              />
              {condition}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Label>Other conditions (comma-separated)</Label>
          <TextInput
            value={otherCondition}
            onChange={(e) => setOtherCondition(e.target.value)}
            placeholder="e.g. Migraine, Anemia"
          />
        </div>
      </section>

      <section className="mb-8 space-y-5">
        <TagListInput
          label="Current medications"
          placeholder="e.g. Metformin 500mg"
          values={currentMedications}
          onChange={setCurrentMedications}
        />
        <TagListInput
          label="Allergies"
          placeholder="e.g. Penicillin"
          values={allergies}
          onChange={setAllergies}
        />
        <div>
          <Label>Past medical incidents (optional)</Label>
          <textarea
            value={pastMedicalIncidents}
            onChange={(e) => setPastMedicalIncidents(e.target.value)}
            rows={3}
            placeholder="e.g. Appendectomy in 2019"
            className="w-full rounded-lg border border-panel-border bg-bg-deep px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:border-trace-dim focus:outline-none"
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-display text-base font-bold text-ink">
          Emergency contact
        </h2>
        <p className="mb-4 text-xs text-ink-muted">
          Used by SOS to notify someone if you trigger an emergency alert.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <TextInput
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              placeholder="e.g. Priya Sharma"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <TextInput
              type="tel"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
        </div>
      </section>

      {error && (
        <p className="mb-4 rounded-lg border border-alert/40 bg-alert-dim px-4 py-2.5 text-sm text-alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-trace py-3 text-sm font-semibold text-[#052914] transition hover:bg-[#65e89a] disabled:opacity-60"
      >
        {isPending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}