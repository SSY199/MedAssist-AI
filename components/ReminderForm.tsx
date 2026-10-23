"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import type {
  Preview,
  Reminder,
  ReminderDraft,
  ReminderStatus,
} from "@/lib/reminders";

const field =
  "h-10 rounded-lg border border-panel-border bg-bg-deep px-3 text-sm text-ink";
const outline = "border-panel-border bg-bg-deep text-ink hover:bg-white/5";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ReminderForm({
  initial,
  editing,
  status,
  profileNames,
  productNames,
  onSaved,
  onCancel,
}: {
  initial: ReminderDraft;
  editing: Reminder | null;
  status: ReminderStatus | null;
  profileNames: string[];
  productNames: string[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview[] | null>(null);
  const requestId = useRef("");
  const lock = useRef(false);
  function change(next: Partial<ReminderDraft>) {
    setDraft((old) => ({ ...old, ...next }));
    setPreview(null);
    setError("");
  }
  async function review() {
    setBusy(true);
    setError("");
    try {
      const result = await apiFetch("/reminders/preview", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      setPreview(result.occurrences);
    } catch {
      setError(
        "Check the medicine name, timezone, unique times, weekdays and date range. One-time reminders must use a valid future local time.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview?.length || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      await apiFetch(editing ? `/reminders/${editing.id}` : "/reminders", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(
          editing
            ? { version: editing.version, schedule: draft }
            : { request_id: requestId.current, schedule: draft },
        ),
      });
      onSaved();
    } catch {
      setError(
        "Could not confirm the save. Retry this form, or refresh the page to check its saved state. Edits require the latest version; email requires a verified account and enabled sender.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-2xl border border-trace/40 bg-panel p-5 md:p-6"
      aria-label={
        editing ? "Edit medication schedule" : "New medication schedule"
      }
    >
      <h2 className="mb-2 font-display text-xl font-bold text-ink">
        {editing ? "Edit schedule" : "Add a medication reminder"}
      </h2>
      <p className="mb-5 text-xs leading-relaxed text-ink-muted">
        Enter your existing prescribed plan. MedAssist does not calculate doses.
        Prefill copies a name only; review every schedule.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void review();
        }}
        className="space-y-5"
      >
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-ink-muted">
              Medicine name
              <Input
                required
                maxLength={120}
                value={draft.medicine}
                onChange={(e) => change({ medicine: e.target.value })}
                className={field}
              />
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Your prescribed instruction (optional)
              <Input
                maxLength={300}
                value={draft.instructions}
                onChange={(e) => change({ instructions: e.target.value })}
                placeholder="Copy your own prescription instructions"
                className={field}
              />
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Prefill from your profile
              <select
                className={`${field} block w-full`}
                value=""
                onChange={(e) => change({ medicine: e.target.value })}
              >
                <option value="">Choose a saved medication name</option>
                {profileNames.map((name, i) => (
                  <option key={i}>{name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Prefill from marketplace
              <select
                className={`${field} block w-full`}
                value=""
                onChange={(e) => change({ medicine: e.target.value })}
              >
                <option value="">Choose a catalog medicine name</option>
                {productNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Repeat
              <select
                value={draft.recurrence}
                onChange={(e) =>
                  change({
                    recurrence: e.target.value as ReminderDraft["recurrence"],
                    weekdays: [],
                    times:
                      e.target.value === "once"
                        ? [draft.times[0]]
                        : draft.times,
                    end_date: null,
                  })
                }
                className={`${field} block w-full`}
              >
                <option value="once">One time</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Selected weekdays</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              Timezone (IANA)
              <Input
                required
                maxLength={80}
                value={draft.timezone}
                onChange={(e) => change({ timezone: e.target.value })}
                placeholder="Asia/Kolkata"
                className={field}
              />
              <span className="block text-xs">
                This timezone stays fixed when you travel.
              </span>
            </label>
            <label className="space-y-2 text-sm text-ink-muted">
              {draft.recurrence === "once" ? "Date" : "Start date"}
              <Input
                type="date"
                required
                value={draft.start_date}
                onInput={(e) => change({ start_date: e.currentTarget.value })}
                onChange={(e) => change({ start_date: e.target.value })}
                className={field}
              />
            </label>
            {draft.recurrence !== "once" && (
              <label className="space-y-2 text-sm text-ink-muted">
                End date (optional)
                <Input
                  type="date"
                  min={draft.start_date}
                  value={draft.end_date ?? ""}
                  onInput={(e) =>
                    change({ end_date: e.currentTarget.value || null })
                  }
                  onChange={(e) => change({ end_date: e.target.value || null })}
                  className={field}
                />
              </label>
            )}
          </div>
          {draft.recurrence === "weekdays" && (
            <fieldset>
              <legend className="mb-2 text-sm text-ink-muted">Weekdays</legend>
              <div className="flex flex-wrap gap-3">
                {days.map((day, index) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={draft.weekdays.includes(index)}
                      onChange={(e) =>
                        change({
                          weekdays: e.target.checked
                            ? [...draft.weekdays, index].sort()
                            : draft.weekdays.filter((v) => v !== index),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-2 text-sm text-ink-muted">
              Scheduled times · preview uses a 24-hour clock
            </legend>
            <div className="flex flex-wrap items-end gap-3">
              {draft.times.map((clock, index) => (
                <label key={index} className="text-xs text-ink-dim">
                  Time {index + 1}
                  <Input
                    aria-label={`Scheduled time ${index + 1}`}
                    className={`${field} mt-1`}
                    type="time"
                    required
                    value={clock}
                    onInput={(e) =>
                      change({
                        times: draft.times.map((v, i) =>
                          i === index ? e.currentTarget.value : v,
                        ),
                      })
                    }
                    onChange={(e) =>
                      change({
                        times: draft.times.map((v, i) =>
                          i === index ? e.target.value : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              {draft.recurrence !== "once" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={outline}
                    disabled={draft.times.length >= 8}
                    onClick={() => change({ times: [...draft.times, ""] })}
                  >
                    Add time
                  </Button>
                  {draft.times.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      className={outline}
                      onClick={() =>
                        change({ times: draft.times.slice(0, -1) })
                      }
                    >
                      Remove last time
                    </Button>
                  )}
                </>
              )}
            </div>
          </fieldset>
          <div className="space-y-3 rounded-xl border border-panel-border bg-bg-deep p-4 text-sm text-ink-muted">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.email_enabled}
                disabled={
                  !draft.email_enabled &&
                  (!status?.email_ready || !status.recipient)
                }
                onChange={(e) =>
                  change({
                    email_enabled: e.target.checked,
                    email_consent: false,
                  })
                }
              />
              <span>
                Email generic reminders to my verified account
                {status?.recipient
                  ? ` (${status.recipient})`
                  : " — verified account unavailable"}
              </span>
            </label>
            <p className="text-xs">
              Preview: “
              {status?.generic_preview ??
                "You have a scheduled reminder. Sign in to MedAssist to view it."}
              ” Medicine details stay inside the app.
            </p>
            {draft.email_enabled && (
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  required
                  checked={draft.email_consent}
                  onChange={(e) => change({ email_consent: e.target.checked })}
                />
                <span>
                  I agree to generic emails to my account. The laptop and worker
                  must stay awake. Existing submitted emails cannot be recalled.
                </span>
              </label>
            )}
            {!status?.email_ready && (
              <p className="text-xs">
                Email sender disabled or unavailable. You can still save in-app
                reminders.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          )}
          {preview && (
            <div className="rounded-xl border border-panel-border p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                Review next scheduled times
              </h3>
              {preview.length ? (
                <ul className="space-y-1 text-sm text-ink-muted">
                  {preview.map((item) => (
                    <li key={item.due_at}>
                      {item.local_date} · {item.local_time} · {draft.timezone}
                      {item.clock_change
                        ? " — skipped: local clock change"
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-alert">
                  No future occurrences. Adjust the date or time.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="outline"
              className={outline}
              disabled={busy}
            >
              Preview schedule
            </Button>
            <Button
              type="button"
              className="bg-trace text-bg-deep hover:bg-trace/90"
              disabled={busy || !preview?.length}
              onClick={save}
            >
              {busy ? "Working…" : "Save reviewed schedule"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={outline}
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
