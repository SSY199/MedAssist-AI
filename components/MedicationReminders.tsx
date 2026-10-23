"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, Clock, History, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  calendarDate,
  deliveryLabel,
  reminderTime,
  newReminderDraft,
  scheduleLabel,
  type Occurrence,
  type Reminder,
  type ReminderDraft,
  type ReminderStatus,
} from "@/lib/reminders";
import type { CatalogResponse } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReminderForm from "@/components/ReminderForm";

const outline = "border-panel-border bg-bg-deep text-ink hover:bg-white/5";
function asDraft(row: Reminder): ReminderDraft {
  return {
    medicine: row.medicine,
    instructions: row.instructions,
    timezone: row.timezone,
    recurrence: row.recurrence,
    times: row.times,
    weekdays: row.weekdays,
    start_date: row.start_date,
    end_date: row.end_date,
    email_enabled: row.email_enabled,
    email_consent: false,
  };
}
export default function MedicationReminders({
  profileNames,
}: {
  profileNames: string[];
}) {
  const [day, setDay] = useState(() => calendarDate());
  const [schedules, setSchedules] = useState<Reminder[]>([]);
  const [events, setEvents] = useState<Occurrence[]>([]);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const readSequence = useRef(0);
  const [form, setForm] = useState<{
    draft: ReminderDraft;
    editing: Reminder | null;
  } | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const sequence = ++readSequence.current;
      try {
        const [a, b, c] = await Promise.all([
          apiFetch("/reminders", { signal }),
          apiFetch(`/reminders/occurrences?day=${day}`, { signal }),
          apiFetch("/reminders/status", { signal }),
        ]);
        if (!signal?.aborted && sequence === readSequence.current) {
          setSchedules(a.schedules);
          setEvents(b.occurrences);
          setStatus(c);
          setClock(Date.now());
        }
      } catch {
        if (!signal?.aborted && sequence === readSequence.current)
          setError(
            "Reminders could not be refreshed. Check the backend connection and retry. Displayed records may be out of date.",
          );
      } finally {
        if (!signal?.aborted && sequence === readSequence.current)
          setLoading(false);
      }
    },
    [day],
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void load(controller.signal), 0);
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void load(controller.signal);
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    const timer = setInterval(() => void load(controller.signal), 30000);
    return () => {
      controller.abort();
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [load]);
  useEffect(() => {
    let ignore = false;
    apiFetch("/marketplace/products?kind=medicine&limit=100")
      .then((data: CatalogResponse) => {
        if (!ignore) setProductNames(data.products.map((p) => p.name));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  async function mutate(
    path: string,
    method: string,
    body: object,
    message: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(path, { method, body: JSON.stringify(body) });
      setNotice(message);
      setStopId(null);
    } catch {
      setError(
        "Could not confirm the change. It may have been saved, or the record changed on another screen. Refresh before retrying. Snooze is once only and cannot overlap the next occurrence or an email submission.",
      );
    } finally {
      await load();
      lock.current = false;
      setPending(false);
    }
  }
  function stateChange(row: Reminder, state: Reminder["state"]) {
    void mutate(
      `/reminders/${row.id}`,
      "PATCH",
      { version: row.version, state },
      `Schedule ${state === "active" ? "resumed" : state}. Only future reminders are affected; submitted emails cannot be recalled.`,
    );
  }
  function act(row: Occurrence, action: "taken" | "skipped" | "snooze") {
    void mutate(
      `/reminders/occurrences/${row.id}/action`,
      "POST",
      { version: row.actionVersion, action, request_id: crypto.randomUUID() },
      action === "snooze"
        ? "Snoozed for 10 minutes. Other scheduled times stay unchanged."
        : `Recorded ${action}. This is your own report.`,
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5 pb-12 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-trace">
            <Bell size={15} /> Your daily rhythm
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">
            Medication reminders
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
            Keep your prescribed schedule in one place. Record your own Taken,
            Skipped or Snooze actions.
          </p>
        </div>
        <Button
          className="bg-trace text-bg-deep hover:bg-trace/90"
          disabled={pending || !!form}
          onClick={() => setForm({ draft: newReminderDraft(), editing: null })}
        >
          <Plus size={15} /> Add reminder
        </Button>
      </header>
      <div className="rounded-xl border border-panel-border bg-panel p-4 text-xs leading-relaxed text-ink-muted">
        Organization support, not medical advice or a guaranteed alarm. Follow
        your clinician&apos;s instructions; an unconfirmed entry does not mean
        you missed a dose. Email contains no medication details.
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            "Delivery",
            status?.email_ready
              ? "Generic email available"
              : "Email sender unavailable",
          ],
          [
            "Worker",
            status?.worker_online
              ? "Recently active"
              : "Offline / no recent heartbeat",
          ],
          ["Background reminders", "Laptop + worker must stay awake"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-panel-border bg-panel p-4"
          >
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-dim">
              {label}
            </p>
            <p className="text-sm text-ink">
              {status || label === "Background reminders" ? value : "Checking…"}
            </p>
          </div>
        ))}
      </div>
      {status && !status.worker_online && (
        <p className="text-sm text-ink-muted">
          Automatic emails are not being scheduled by a recently active worker.
          In-app records remain available. Start the local reminder worker to
          enable background processing.
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-trace">
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-panel-border p-4 text-sm text-alert"
        >
          <p>{error}</p>
          <Button
            variant="outline"
            className={outline}
            disabled={pending}
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Refresh reminders
          </Button>
        </div>
      )}
      {form && (
        <ReminderForm
          key={form.editing?.id ?? "new"}
          initial={form.draft}
          editing={form.editing}
          status={status}
          profileNames={profileNames}
          productNames={productNames}
          onCancel={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setNotice(
              "Schedule saved. Check the next due time and worker status below.",
            );
            void load();
          }}
        />
      )}
      <p className="text-xs text-ink-dim">
        The list updates every 30 seconds and when you return to this tab. Email
        is sent independently by the worker.
        {status && (
          <>
            {" "}
            Last refreshed:{" "}
            {new Intl.DateTimeFormat("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(new Date(clock))}
            .
          </>
        )}
      </p>
      <section className="space-y-4" aria-label="Due reminders and history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
            <Clock size={18} /> Scheduled day
          </h2>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={outline}
              onClick={() => setDay(calendarDate())}
            >
              Today
            </Button>
            <label className="text-xs text-ink-muted">
              Date
              <Input
                aria-label="Scheduled calendar date"
                type="date"
                className="mt-1 border-panel-border text-ink"
                value={day}
                min={calendarDate(new Date(clock - 30 * 86400000))}
                max={calendarDate(new Date(clock + 86400000))}
                onInput={(e) => {
                  if (e.currentTarget.value) {
                    setLoading(true);
                    setDay(e.currentTarget.value);
                  }
                }}
                onChange={(e) => {
                  if (e.target.value) {
                    setLoading(true);
                    setDay(e.target.value);
                  }
                }}
              />
            </label>
          </div>
        </div>
        <p className="text-xs text-ink-dim">
          Browse the last 30 days or tomorrow. Each entry uses its
          schedule&apos;s timezone and calendar date. Older unconfirmed entries
          do not trigger a burst of emails.
        </p>
        {loading ? (
          <p role="status" className="py-6 text-ink-muted">
            Loading reminders…
          </p>
        ) : !events.length ? (
          <div className="rounded-xl border border-dashed border-panel-border p-8 text-center text-sm text-ink-muted">
            No scheduled occurrences for this date. Add a schedule or choose
            another date.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-panel-border bg-panel p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 font-mono text-xs text-trace">
                      {row.localTime} · {row.timezone}
                    </p>
                    <h3 className="font-display text-lg font-bold text-ink">
                      {row.medicine}
                    </h3>
                    {row.instructions && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
                        Your instruction: {row.instructions}
                      </p>
                    )}
                    <p className="mt-3 text-sm capitalize text-ink">
                      {row.status === "pending"
                        ? row.snoozed &&
                          new Date(row.effectiveAt) > new Date(clock)
                          ? "Snoozed"
                          : row.overdue
                            ? "Due / unconfirmed"
                            : "Upcoming"
                        : row.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-ink-dim">
                      {deliveryLabel(row.delivery)}
                      {row.reason
                        ? ` · ${row.reason.replaceAll("_", " ")}`
                        : ""}
                    </p>
                    {row.workerPickedAt && (
                      <p className="mt-1 text-xs text-ink-dim">
                        Worker picked up:{" "}
                        {reminderTime(row.workerPickedAt, row.timezone)}
                      </p>
                    )}
                    {row.emailSubmittedAt && (
                      <p className="mt-1 text-xs text-ink-dim">
                        Email submission started:{" "}
                        {reminderTime(row.emailSubmittedAt, row.timezone)}
                      </p>
                    )}
                    {row.emailFinishedAt && (
                      <p className="mt-1 text-xs text-ink-dim">
                        Email result recorded:{" "}
                        {reminderTime(row.emailFinishedAt, row.timezone)} ·
                        inbox arrival can be later
                      </p>
                    )}
                    {row.snoozed && (
                      <p className="mt-1 text-xs text-ink-dim">
                        Snoozed until{" "}
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: row.timezone,
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(new Date(row.effectiveAt))}{" "}
                        · original scheduled time kept above
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["taken", "skipped", "snooze"] as const).map((action) => (
                      <Button
                        key={action}
                        variant="outline"
                        className={outline}
                        disabled={
                          pending ||
                          new Date(row.dueAt) > new Date(clock) ||
                          ["cancelled", "time_skipped"].includes(row.status) ||
                          row.status === action ||
                          (action === "snooze" &&
                            (row.snoozed || row.status !== "pending"))
                        }
                        onClick={() => act(row, action)}
                      >
                        {action === "taken" && <Check size={13} />}{" "}
                        {action === "snooze"
                          ? "Snooze 10 min"
                          : action === "taken"
                            ? "Taken"
                            : "Skipped"}
                      </Button>
                    ))}
                  </div>
                </div>
                {!!row.history.length && (
                  <details className="mt-4 border-t border-panel-border pt-3 text-xs text-ink-muted">
                    <summary className="cursor-pointer">
                      Action history / corrections
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {row.history.map((item, i) => (
                        <li key={i}>
                          {item.action} ·{" "}
                          {new Intl.DateTimeFormat("en-IN", {
                            timeZone: row.timezone,
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(item.at))}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      Up to the latest 20 actions are shown for this occurrence.
                      Taken/Skipped buttons can correct your report.
                    </p>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4" aria-label="Medication schedules">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <History size={18} /> Your schedules
        </h2>
        {!schedules.length && !loading && (
          <p className="text-sm text-ink-muted">
            No schedules yet. Names from your profile or marketplace are
            optional prefills, not treatment recommendations.
          </p>
        )}
        <div className="space-y-3">
          {schedules.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-panel-border bg-panel p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-ink">
                    {row.medicine}{" "}
                    <span className="ml-2 text-xs font-normal capitalize text-trace">
                      {row.state}
                    </span>
                  </h3>
                  <p className="mt-2 text-sm text-ink-muted">
                    {scheduleLabel(row)}
                  </p>
                  <p className="mt-1 text-xs text-ink-dim">
                    From {row.start_date}
                    {row.end_date ? ` through ${row.end_date}` : ""} ·{" "}
                    {row.email_enabled
                      ? "Generic email enabled"
                      : "In-app only"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className={outline}
                    disabled={pending || !!form}
                    onClick={() =>
                      setForm({ draft: asDraft(row), editing: row })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    className={outline}
                    disabled={pending}
                    onClick={() =>
                      stateChange(
                        row,
                        row.state === "active" ? "paused" : "active",
                      )
                    }
                  >
                    {row.state === "active" ? "Pause" : "Resume"}
                  </Button>
                  {row.state !== "stopped" && (
                    <Button
                      variant="outline"
                      className={outline}
                      disabled={pending}
                      onClick={() => setStopId(row.id)}
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </div>
              {stopId === row.id && (
                <div className="mt-4 space-y-3 border-t border-panel-border pt-4">
                  <p className="text-sm text-ink-muted">
                    Stop future reminders? Past history stays available. An
                    email already submitted may still arrive.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      disabled={pending}
                      variant="outline"
                      className={outline}
                      onClick={() => stateChange(row, "stopped")}
                    >
                      Confirm stop
                    </Button>
                    <Button
                      disabled={pending}
                      variant="outline"
                      className={outline}
                      onClick={() => setStopId(null)}
                    >
                      Keep schedule
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
