"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { SOS_COUNTDOWN_SECONDS, startSosCountdown } from "@/lib/sos-countdown";
import {
  HEALTH_FIELDS,
  type SosLocation,
  type SosPreview,
  type SosQuickPreferences,
} from "@/lib/sos";

const SosQuickContext = createContext<{
  trigger: () => void;
  incidentVersion: number;
} | null>(null);
export function useSosQuick() {
  const trigger = useContext(SosQuickContext);
  if (!trigger) throw new Error("SOS controls need SosQuickProvider");
  return trigger.trigger;
}

export function useSosIncidentVersion() {
  return useContext(SosQuickContext)?.incidentVersion ?? 0;
}

export function SosQuickProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [incidentVersion, setIncidentVersion] = useState(0);
  const [phase, setPhase] = useState<
    "loading" | "countdown" | "sending" | "error"
  >("loading");
  const [seconds, setSeconds] = useState(SOS_COUNTDOWN_SECONDS);
  const [error, setError] = useState("");
  const [prefs, setPrefs] = useState<SosQuickPreferences | null>(null);
  const [preview, setPreview] = useState<SosPreview | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const run = useRef(0);
  const stopTimer = useRef<(() => void) | null>(null);
  const snapshot = useRef<SosLocation | null>(null);
  const allowLocation = useRef(false);
  const frozen = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const initialPreview = useRef<SosPreview | null>(null);

  function cancel() {
    if (frozen.current) return;
    run.current += 1;
    pending.current = false;
    allowLocation.current = false;
    stopTimer.current?.();
    setOpen(false);
  }

  // Navigation/unmount or hiding the page disarms pending countdown work.
  useEffect(() => {
    const disarm = () => {
      run.current += 1;
      pending.current = false;
      allowLocation.current = false;
      stopTimer.current?.();
    };
    const onHidden = () => {
      if (document.hidden && !frozen.current) {
        disarm();
        setOpen(false);
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      disarm();
    };
  }, [pathname]);

  async function trigger() {
    if (pending.current) return;
    pending.current = true;
    const id = ++run.current;
    frozen.current = false;
    snapshot.current = null;
    allowLocation.current = false;
    setOpen(true);
    setPhase("loading");
    setError("");
    setPreview(null);
    setPrefs(null);
    try {
      const [settings, current] = await Promise.all([
        apiFetch("/sos/preferences") as Promise<SosQuickPreferences>,
        apiFetch("/sos/current"),
      ]);
      if (run.current !== id) return;
      if (current.incident && !current.incident.endedAt) {
        cancel();
        router.push("/sos");
        return;
      }
      setPrefs(settings);
      if (!settings.enabled)
        throw new Error(
          "Save your countdown SOS settings first. No alert has been sent.",
        );
      if (!settings.senderReady)
        throw new Error(
          "The Gmail sender is not configured. Use the detailed SOS panel for fallback actions.",
        );
      const initial = await apiFetch("/sos/quick/preview", {
        method: "POST",
        body: JSON.stringify({ location: null }),
      });
      if (run.current !== id) return;
      initialPreview.current = initial;
      setPreview(initial);
      setPhase("countdown");
      allowLocation.current = settings.shareLocation;
      setLocationNote(
        settings.shareLocation
          ? "Locating… If unavailable at the deadline, email sends without location."
          : "Location sharing is off.",
      );
      stopTimer.current = startSosCountdown({
        onTick: setSeconds,
        onMissed: () => {
          if (run.current !== id) return;
          run.current += 1;
          pending.current = false;
          allowLocation.current = false;
          setPhase("error");
          setError(
            "Countdown was interrupted. No alert was sent. Tap SOS again when ready.",
          );
        },
        onExpire: () => {
          void dispatch(id);
        },
      });
      if (settings.shareLocation && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (run.current !== id || frozen.current || !allowLocation.current)
              return;
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              capturedAt: new Date(position.timestamp).toISOString(),
            };
            snapshot.current = location;
            setLocationNote(
              `Location captured · approximately ±${Math.round(location.accuracy)} m`,
            );
            void apiFetch("/sos/quick/preview", {
              method: "POST",
              body: JSON.stringify({ location }),
            })
              .then((data) => {
                if (
                  run.current === id &&
                  !frozen.current &&
                  allowLocation.current
                )
                  setPreview(data);
              })
              .catch(() => {
                /* Final preview is checked again before submission. */
              });
          },
          () => {
            if (run.current === id && !frozen.current)
              setLocationNote(
                "Location unavailable. Email will send without GPS.",
              );
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
        );
      } else if (settings.shareLocation)
        setLocationNote("Location unsupported. Email will send without GPS.");
    } catch (cause) {
      if (run.current !== id) return;
      pending.current = false;
      stopTimer.current?.();
      setPhase("error");
      setError(
        cause instanceof Error && !cause.message.startsWith("Backend request")
          ? cause.message
          : "Could not prepare SOS. No alert was sent. Check your saved contact and backend connection.",
      );
    }
  }

  async function dispatch(id: number) {
    if (run.current !== id) return;
    // Freeze the snapshot at expiry. Late GPS callbacks cannot alter this send.
    const location = allowLocation.current ? snapshot.current : null;
    allowLocation.current = false;
    setLocationNote(
      location
        ? "Using the captured location snapshot."
        : "Sending without location.",
    );
    try {
      const finalPreview: SosPreview = await apiFetch("/sos/quick/preview", {
        method: "POST",
        body: JSON.stringify({ location }),
      });
      if (
        !finalPreview.consentHash ||
        finalPreview.consentHash !== initialPreview.current?.consentHash
      ) {
        throw new Error("Contact, health or sharing choices changed");
      }
      if (run.current !== id) return;
      setPreview(finalPreview);
      frozen.current = true;
      setPhase("sending");
      await apiFetch("/sos/quick/activate", {
        method: "POST",
        body: JSON.stringify({
          location,
          requestId: crypto.randomUUID(),
          previewHash: finalPreview.previewHash,
          consentHash: finalPreview.consentHash,
          confirmed: true,
        }),
      });
      if (run.current !== id) return;
      setOpen(false);
      pending.current = false;
      frozen.current = false;
      setIncidentVersion((value) => value + 1);
      router.push("/sos");
      router.refresh();
    } catch {
      if (run.current !== id) return;
      if (frozen.current) setIncidentVersion((value) => value + 1);
      setPhase("error");
      setError(
        frozen.current
          ? "Submission could not be confirmed. Check SOS status before trying again; an email may already have been submitted."
          : "Could not finalize the alert, or contact/sharing details changed. No email was submitted by this attempt. Review setup and try again.",
      );
      frozen.current = false;
      pending.current = false;
    }
  }

  function skipLocation() {
    allowLocation.current = false;
    snapshot.current = null;
    setLocationNote("Location omitted for this alert.");
    setPreview(initialPreview.current);
  }

  return (
    <SosQuickContext.Provider
      value={{
        trigger: () => {
          void trigger();
        },
        incidentVersion,
      }}
    >
      {children}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) cancel();
        }}
      >
        <SheetContent
          side="center"
          showCloseButton={false}
          initialFocus={cancelButton}
          className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl border-panel-border bg-panel p-6 text-ink"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-xl text-ink">
              <ShieldAlert className="text-alert" />
              {phase === "countdown"
                ? "SOS email countdown"
                : phase === "sending"
                  ? "Submitting SOS email…"
                  : "Emergency SOS"}
            </SheetTitle>
            <SheetDescription className="text-ink-muted">
              This alerts your saved contact. It does not dispatch emergency
              services.
            </SheetDescription>
          </SheetHeader>
          {prefs && (
            <p className="text-sm">
              To: {prefs.contactName || "Emergency contact"} · {prefs.recipient}
              <br />
              <span className="text-xs text-ink-muted">
                Health fields:{" "}
                {prefs.fields
                  .map(
                    (key) =>
                      HEALTH_FIELDS.find(([field]) => field === key)?.[1],
                  )
                  .join(", ") || "none"}
              </span>
            </p>
          )}
          {phase === "loading" && (
            <p role="status">
              Checking setup and existing SOS status. Nothing has been sent.
            </p>
          )}
          {phase === "countdown" && (
            <>
              <p
                role="timer"
                aria-live="polite"
                className="text-center font-mono text-6xl font-bold text-alert"
              >
                {seconds}
              </p>
              <p className="text-center text-sm">
                Email sends automatically when the countdown ends.
              </p>
              <p role="status" className="text-xs text-ink-muted">
                {locationNote}
              </p>
              {prefs?.shareLocation && (
                <Button
                  variant="ghost"
                  className="text-trace"
                  onClick={skipLocation}
                >
                  Continue without location
                </Button>
              )}
            </>
          )}
          {preview && (
            <details>
              <summary className="cursor-pointer text-sm text-trace">
                Message preview
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-ink-muted">
                {preview.message}
              </pre>
            </details>
          )}
          {error && (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          )}
          <Button
            ref={cancelButton}
            disabled={phase === "sending"}
            className="h-12 w-full border border-alert/40 bg-alert-dim font-bold text-alert hover:bg-alert/20"
            onClick={cancel}
          >
            {phase === "countdown" || phase === "loading"
              ? "Cancel SOS · do not send"
              : phase === "sending"
                ? "Submission started · cannot recall email"
                : "Close"}
          </Button>
          <a
            href="tel:112"
            className="text-center text-sm font-semibold text-alert underline"
          >
            Call 112 · India
          </a>
          <Link
            href="/sos#quick-setup"
            onClick={(event) => {
              if (phase === "sending") {
                event.preventDefault();
                return;
              }
              cancel();
            }}
            className="text-center text-sm text-trace underline"
          >
            {phase === "error"
              ? "Open SOS setup / status"
              : "Cancel and open full SOS panel"}
          </Link>
        </SheetContent>
      </Sheet>
    </SosQuickContext.Provider>
  );
}
