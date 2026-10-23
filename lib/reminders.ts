export type ReminderDraft = {
  medicine: string;
  instructions: string;
  timezone: string;
  recurrence: "once" | "daily" | "weekdays";
  times: string[];
  weekdays: number[];
  start_date: string;
  end_date: string | null;
  email_enabled: boolean;
  email_consent: boolean;
};
export type Reminder = Omit<ReminderDraft, "email_consent"> & {
  id: string;
  state: "active" | "paused" | "stopped";
  version: number;
};
export type Occurrence = {
  id: string;
  reminder_id: string;
  medicine: string;
  instructions: string;
  timezone: string;
  localDate: string;
  localTime: string;
  dueAt: string;
  effectiveAt: string;
  status: "pending" | "taken" | "skipped" | "cancelled" | "time_skipped";
  delivery: string;
  reason: string;
  actionVersion: number;
  snoozed: boolean;
  overdue: boolean;
  history: { action: string; at: string }[];
};
export type ReminderStatus = {
  email_ready: boolean;
  worker_online: boolean;
  recipient: string | null;
  generic_preview: string;
};
export type Preview = {
  local_date: string;
  local_time: string;
  due_at: string;
  clock_change: boolean;
};

export function calendarDate(now = new Date(), zone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function newReminderDraft(): ReminderDraft {
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  return {
    medicine: "",
    instructions: "",
    timezone,
    recurrence: "daily",
    times: ["09:00"],
    weekdays: [],
    start_date: calendarDate(new Date(), timezone),
    end_date: null,
    email_enabled: false,
    email_consent: false,
  };
}
export function scheduleLabel(reminder: Reminder) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const repeat =
    reminder.recurrence === "once"
      ? reminder.start_date
      : reminder.recurrence === "daily"
        ? "Daily"
        : reminder.weekdays.map((day) => days[day]).join(", ");
  return `${repeat} · ${reminder.times.join(", ")} · ${reminder.timezone}`;
}
export function deliveryLabel(value: string) {
  return (
    (
      {
        accepted: "Email accepted by provider",
        pending: "Email not submitted",
        claimed: "Preparing email",
        submitting: "Submitting email",
        unknown: "Email outcome unknown; automatic retry stopped",
        failed: "Email submission failed",
        suppressed: "Email suppressed",
      } as Record<string, string>
    )[value] ?? "Email status unavailable"
  );
}
