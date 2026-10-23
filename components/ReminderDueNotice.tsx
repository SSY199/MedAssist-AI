"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function ReminderDueNotice() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    let ignore = false;
    let sequence = 0;
    const controller = new AbortController();
    const read = () => {
      const current = ++sequence;
      apiFetch("/reminders/summary", { signal: controller.signal })
        .then((data) => {
          if (!ignore && current === sequence) setCount(data.due_count);
        })
        .catch(() => {});
    };
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") read();
    };
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("medassist:reminders-changed", read);
    read();
    const timer = setInterval(read, 60000);
    return () => {
      ignore = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("medassist:reminders-changed", read);
    };
  }, [pathname]);
  return count ? (
    <div
      role="status"
      className="border-b border-panel-border bg-panel px-5 py-3 text-center text-sm text-ink-muted"
    >
      {count} medication reminder{count === 1 ? "" : "s"} awaiting your
      response. Choose Taken, Skipped or Snooze on the reminders page.{" "}
      <Link
        href="/reminders"
        className="text-trace underline underline-offset-4"
      >
        View reminders
      </Link>
    </div>
  ) : null;
}
