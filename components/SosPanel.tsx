"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Copy,
  MapPin,
  Phone,
  ShieldAlert,
  Send,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import type { PatientProfileInput } from "@/lib/profile-actions";
import {
  contactPhone,
  directionsUrl,
  EMAIL_STATUS,
  HEALTH_FIELDS,
  type HealthField,
  type SosIncident,
  type SosLocation,
  type SosPreview,
} from "@/lib/sos";

interface Facility {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}
const inputClass =
  "w-full rounded-lg border border-panel-border bg-bg-deep px-3 py-2.5 text-sm text-ink focus:border-trace-dim focus:outline-none";
const outlineClass = "border-panel-border bg-bg-deep text-ink hover:bg-white/5";
const linkClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-panel-border px-4 py-3 text-sm font-semibold hover:bg-white/5";

export function SosPanel({ profile }: { profile: PatientProfileInput | null }) {
  const [incident, setIncident] = useState<SosIncident | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [location, setLocation] = useState<SosLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState(
    "Capture your location, or enter a description below. You can activate without GPS.",
  );
  const [manualLocation, setManualLocation] = useState("");
  const [fields, setFields] = useState<HealthField[]>(
    HEALTH_FIELDS.map(([key]) => key),
  );
  const [preview, setPreview] = useState<SosPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [careNote, setCareNote] = useState(
    "Capture location to search nearby emergency care.",
  );
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const active = Boolean(incident && !incident.endedAt);
  const phone = contactPhone(profile?.emergencyContactPhone ?? "");
  const sharing = { location, manualLocation, fields };

  useEffect(() => {
    let cancelled = false;
    apiFetch("/sos/current")
      .then((data) => {
        if (!cancelled) {
          setIncident(data.incident);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load SOS status. Retry loading before activating to avoid duplicate alerts.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      apiFetch("/sos/preview", {
        method: "POST",
        body: JSON.stringify({ location, manualLocation, fields }),
      })
        .then((data) => {
          if (!cancelled) {
            setPreview(data);
            setPreviewError("");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPreview(null);
            setPreviewError(
              "Preview unavailable. Save a valid contact email in your profile and check the backend. GPS snapshots expire after 10 minutes.",
            );
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loaded, location, manualLocation, fields]);

  useEffect(() => {
    if (!busy && incident?.emailStatus !== "sending") return;
    let cancelled = false;
    const timer = setInterval(() => {
      apiFetch("/sos/current")
        .then((data) => {
          if (!cancelled) setIncident(data.incident);
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "Status refresh failed. Submission may still be running; use the fallback actions.",
            );
        });
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [busy, incident?.emailStatus]);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    apiFetch(`/map/nearby?lat=${location.lat}&lng=${location.lng}&category=er`)
      .then((data) => {
        if (!cancelled) {
          setFacilities(data.slice(0, 4));
          setCareNote(
            data.length
              ? "Mapbox search results. Confirm the facility can help; hours, capacity and travel time are unverified."
              : "No emergency-care results found. Open the full map or use the call actions.",
          );
        }
      })
      .catch(() => {
        if (!cancelled)
          setCareNote(
            "Nearby-care search unavailable. Call actions remain available.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationNote("Location is unsupported. Enter a description instead.");
      return;
    }
    setLocating(true);
    setLocationNote("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
        setPreview(null);
        setLocating(false);
        setLocationNote(
          "Location snapshot captured. This is not continuous tracking.",
        );
      },
      () => {
        setLocating(false);
        setLocationNote(
          "Location denied or unavailable. Enter a description, or activate without location.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  async function submit(retry = false) {
    if (!preview || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    requestId.current ??= crypto.randomUUID();
    try {
      const data = await apiFetch(
        retry && incident
          ? `/sos/${incident.incidentId}/retry`
          : "/sos/activate",
        {
          method: "POST",
          body: JSON.stringify({
            ...sharing,
            requestId: requestId.current,
            previewHash: preview.previewHash,
            confirmed: true,
          }),
        },
      );
      setIncident(data.incident);
      if (data.incident.previewHash === preview.previewHash)
        setSentMessage(preview.message);
    } catch {
      setError(
        "Could not confirm the request. Refresh SOS status before trying again; an email may already have been submitted.",
      );
      try {
        const data = await apiFetch("/sos/current");
        setIncident(data.incident);
      } catch {
        /* Keep uncertainty visible. */
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  async function refresh() {
    setError("");
    try {
      const data = await apiFetch("/sos/current");
      setIncident(data.incident);
      setLoaded(true);
    } catch {
      setError(
        "SOS status unavailable. Check the backend; use call or WhatsApp if needed.",
      );
    }
  }

  async function end() {
    if (!incident || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch(`/sos/${incident.incidentId}/end`, {
        method: "POST",
      });
      setIncident(data.incident);
      requestId.current = null;
    } catch {
      setError("Could not end SOS. Refresh its status and try again.");
    } finally {
      setBusy(false);
    }
  }

  // The original health message is deliberately not retained by the backend.
  // After a reload use a clearly labelled minimal fallback, not a reconstructed
  // message falsely presented as the exact email that was submitted.
  const fallbackLocation = incident?.location ?? location;
  const fallbackMessage = `MedAssist SOS: I need help. Please contact me.${fallbackLocation ? ` Location: https://www.google.com/maps/search/?api=1&query=${fallbackLocation.lat},${fallbackLocation.lng}` : ` Location: ${incident?.manualLocation || manualLocation || "unavailable"}`}`;
  const message = active
    ? sentMessage || fallbackMessage
    : preview?.message || fallbackMessage;

  return (
    <div className="min-h-screen bg-bg px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-alert">
              Emergency assistance
            </p>
            <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
              <ShieldAlert className="text-alert" />
              {active ? "SOS is active" : "Your SOS safety panel"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">
              Alert your saved contact, share essential information, and find
              care. This app does not dispatch emergency services or monitor
              your condition.
            </p>
          </div>
          <a
            href="tel:112"
            className={`${linkClass} border-alert/40 bg-alert-dim text-alert`}
          >
            <Phone size={18} />
            Call 112 · India
          </a>
        </header>

        {(error || notice) && (
          <div
            role={error ? "alert" : "status"}
            className="rounded-lg border border-panel-border bg-panel p-4 text-sm"
          >
            {error || notice}
          </div>
        )}
        {!loaded && (
          <Button onClick={refresh} variant="outline" className={outlineClass}>
            Reload SOS status
          </Button>
        )}

        {incident && (
          <Card className="border border-alert/30 bg-panel text-ink">
            <CardHeader>
              <CardTitle>
                {incident.endedAt ? "Last SOS ended" : "Active incident"} ·{" "}
                {incident.incidentId.slice(0, 8)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p
                className="font-semibold text-alert"
                role="status"
                aria-live="polite"
              >
                {EMAIL_STATUS[incident.emailStatus]}
              </p>
              <p className="text-sm text-ink-muted">
                Recipient: {incident.contactName || "Emergency contact"} ·{" "}
                {incident.recipient}
              </p>
              <p className="text-sm text-ink-muted">
                Accepted means Gmail accepted the submission. Delivery, reading,
                and a response are unconfirmed.
              </p>
              {incident.emailStatus === "failed" && (
                <p className="text-sm text-alert">
                  Email was not accepted. Check the Gmail sender configuration
                  and contact email. Use the call or WhatsApp actions now.
                </p>
              )}
              {incident.emailStatus === "unknown" && (
                <p className="text-sm text-alert">
                  The connection ended without a confirmed result. An email may
                  have been submitted. Automatic retry is disabled to avoid
                  duplicates.
                </p>
              )}
              <ol className="space-y-2 border-l border-panel-border pl-4 font-mono text-xs text-ink-muted">
                <li>
                  Activated · {new Date(incident.createdAt).toLocaleString()}
                </li>
                <li>
                  Attempt {incident.attempts} ·{" "}
                  {new Date(incident.lastAttemptAt).toLocaleString()}
                </li>
                <li>
                  {EMAIL_STATUS[incident.emailStatus]} ·{" "}
                  {new Date(incident.statusAt).toLocaleString()}
                </li>
                {incident.endedAt && (
                  <li>Ended · {new Date(incident.endedAt).toLocaleString()}</li>
                )}
              </ol>
              {incident.location && (
                <p className="text-xs text-ink-muted">
                  Shared location: {incident.location.lat.toFixed(5)},{" "}
                  {incident.location.lng.toFixed(5)} · ±
                  {Math.round(incident.location.accuracy)} m ·{" "}
                  {new Date(incident.location.capturedAt).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-ink-muted">
                Selected health fields:{" "}
                {incident.sharedFields.join(", ") || "none"}. The original
                health message is not stored with the incident.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className={outlineClass}
                  onClick={refresh}
                >
                  Refresh status
                </Button>
                {active && (
                  <Button
                    variant="outline"
                    className={outlineClass}
                    disabled={busy}
                    onClick={end}
                  >
                    End SOS
                  </Button>
                )}
              </div>
              <p className="text-xs text-ink-dim">
                Ending SOS closes this incident. It cannot recall an email or
                stop a submission already in progress.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-6">
            <Card className="border border-panel-border bg-panel text-ink">
              <CardHeader>
                <CardTitle>01 · Contact & sharing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {profile?.emergencyContactName || "No contact saved"}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {profile?.emergencyContactEmail ||
                        "Add an email for automatic alerts"}
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="text-sm text-trace underline"
                  >
                    Edit profile
                  </Link>
                </div>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className={outlineClass}
                    disabled={locating || busy}
                    onClick={captureLocation}
                  >
                    <MapPin />
                    {locating ? "Locating…" : "Capture / refresh location"}
                  </Button>
                  <p role="status" className="text-xs text-ink-muted">
                    {locationNote}
                  </p>
                  <p className="text-xs text-ink-dim">
                    Capturing location also sends coordinates to Mapbox to find
                    care. Email and WhatsApp sharing happen only through the
                    actions below.
                  </p>
                  {location && (
                    <div className="text-sm">
                      <p>
                        {location.lat.toFixed(5)}, {location.lng.toFixed(5)} · ±
                        {Math.round(location.accuracy)} m
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setLocation(null);
                          setPreview(null);
                          setFacilities([]);
                          setCareNote(
                            "Capture location to search nearby emergency care.",
                          );
                        }}
                      >
                        Remove location from next alert
                      </Button>
                    </div>
                  )}
                  <label className="block text-xs text-ink-muted">
                    Location description (used if GPS is unavailable)
                    <input
                      className={`${inputClass} mt-2`}
                      maxLength={300}
                      value={manualLocation}
                      onChange={(e) => {
                        setManualLocation(e.target.value);
                        setPreview(null);
                      }}
                      placeholder="Building, floor, landmark…"
                    />
                  </label>
                </div>
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">
                    Health summary to share
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    {HEALTH_FIELDS.map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={fields.includes(key)}
                          onChange={() => {
                            setFields((old) =>
                              old.includes(key)
                                ? old.filter((v) => v !== key)
                                : [...old, key],
                            );
                            setPreview(null);
                          }}
                          className="accent-trace"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">
                    Self-recorded profile information. Remove any fields you do
                    not want to share.
                  </p>
                </fieldset>
                {previewError && (
                  <p role="alert" className="text-sm text-alert">
                    {previewError}
                  </p>
                )}
                {preview && !preview.emailReady && (
                  <p className="text-sm text-alert">
                    Gmail sender is not configured. Activation can be recorded,
                    but automatic email will fail until setup is complete.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border border-panel-border bg-panel text-ink">
              <CardHeader>
                <CardTitle>02 · Review & activate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-ink-muted">
                  Confirming sends the preview below to{" "}
                  {preview?.recipient || "your saved contact"}. No email is sent
                  simply by opening this page.
                </p>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-panel-border bg-bg-deep p-4 font-mono text-xs leading-relaxed">
                  {preview?.message ||
                    (previewError
                      ? "A sharing preview is required before activating email. Update your contact or retry after checking the backend."
                      : "Preparing preview…")}
                </pre>
                {!active && (
                  <Button
                    className="h-auto w-full bg-alert py-4 font-bold text-[#3a0a0a] hover:bg-alert/80"
                    disabled={!loaded || !preview || busy || locating}
                    onClick={() => submit()}
                  >
                    <Send />
                    {busy
                      ? "Activating SOS…"
                      : "Confirm: activate SOS & email contact"}
                  </Button>
                )}
                {active && incident?.emailStatus === "failed" && (
                  <>
                    <Button
                      variant="destructive"
                      disabled={busy || !preview || incident.attempts >= 3}
                      onClick={() => submit(true)}
                    >
                      Confirm preview & retry email
                    </Button>
                    <p className="text-xs text-ink-muted">
                      Wait 60 seconds between attempts. Maximum three per
                      incident. Retry uses the preview and contact shown above.
                    </p>
                  </>
                )}
                {active && (
                  <p className="text-xs text-ink-muted">
                    SOS remains active until you end it. There is no automatic
                    escalation or repeated email.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border border-panel-border bg-panel text-ink">
              <CardHeader>
                <CardTitle>Fallback contact actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-ink-muted">
                  These actions open your calling or messaging app. On a laptop,
                  calling needs a configured app. WhatsApp requires you to press
                  Send.
                </p>
                {!phone && (
                  <p className="text-sm text-alert">
                    Save an international phone number (including country code)
                    in your profile to enable contact actions.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {phone && (
                    <>
                      <a href={`tel:+${phone}`} className={linkClass}>
                        <Phone size={16} />
                        Call contact
                      </a>
                      <a
                        href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        Open WhatsApp
                      </a>
                    </>
                  )}
                  <Button
                    variant="outline"
                    className={outlineClass}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(message);
                        setNotice("Message copied. No message was sent.");
                      } catch {
                        setNotice(
                          "Copy unavailable. Select the message below and copy it manually.",
                        );
                      }
                    }}
                  >
                    <Copy />
                    Copy message
                  </Button>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-trace">
                    Preview fallback message
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-ink-muted">
                    {message}
                  </pre>
                </details>
                {active && !sentMessage && (
                  <p className="text-xs text-ink-dim">
                    After reload, this fallback contains a help request and
                    saved location only. The original email health summary is
                    not retained.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border border-panel-border bg-panel text-ink">
              <CardHeader>
                <CardTitle>Nearby emergency care</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p role="status" className="text-xs text-ink-muted">
                  {careNote}
                </p>
                {facilities.map((facility) => (
                  <article
                    key={facility.id}
                    className="rounded-lg border border-panel-border p-4"
                  >
                    <h3 className="font-semibold">{facility.name}</h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {facility.address}
                    </p>
                    <a
                      href={directionsUrl(facility.lat, facility.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm text-trace"
                    >
                      <Navigation size={14} />
                      Open directions
                    </a>
                  </article>
                ))}
                <Link
                  href="/map"
                  className="inline-block text-sm text-trace underline"
                >
                  Open full care map
                </Link>
              </CardContent>
            </Card>
            <p className="text-xs leading-relaxed text-ink-dim">
              SOS needs someone to activate it and an internet connection for
              email. It does not detect unconsciousness. If this is an
              emergency, contact local emergency services; in India, call 112.
              Do not place emergency calls during a demonstration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
