/** A cancellable timer; overdue/background callbacks never trigger a late alert. */
export function startSosCountdown({
  onTick,
  onExpire,
  onMissed,
  now = Date.now,
  schedule = (fn: () => void) => setInterval(fn, 100),
  unschedule = (id: ReturnType<typeof setInterval>) => clearInterval(id),
}: {
  onTick: (seconds: number) => void;
  onExpire: () => void;
  onMissed: () => void;
  now?: () => number;
  schedule?: (fn: () => void) => ReturnType<typeof setInterval>;
  unschedule?: (id: ReturnType<typeof setInterval>) => void;
}) {
  const deadline = now() + 5000;
  let armed = true;
  onTick(5);
  const timer = schedule(() => {
    if (!armed) return;
    const remaining = deadline - now();
    onTick(Math.max(0, Math.ceil(remaining / 1000)));
    if (remaining <= 0) {
      armed = false;
      unschedule(timer);
      if (remaining < -2000) onMissed();
      else onExpire();
    }
  });
  return () => {
    armed = false;
    unschedule(timer);
  };
}
