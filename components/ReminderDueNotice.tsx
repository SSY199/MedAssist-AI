"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function ReminderDueNotice() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const read = () => {
      apiFetch("/reminders/summary", { signal: controller.signal })
        .then((data) => {
          if (!ignore) setCount(data.due_count);
        })
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, 60000);
    return () => {
      ignore = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return count ? (
    <div
      role="status"
      className="border-b border-panel-border bg-panel px-5 py-3 text-center text-sm text-ink-muted"
    >
      {count} medication reminder{count === 1 ? "" : "s"} awaiting your
      response.{" "}
      <Link
        href="/reminders"
        className="text-trace underline underline-offset-4"
      >
        View reminders
      </Link>
    </div>
  ) : null;
}
