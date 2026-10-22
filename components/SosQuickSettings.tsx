"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import { HEALTH_FIELDS, type SosQuickPreferences } from "@/lib/sos";

export function SosQuickSettings() {
  const [settings, setSettings] = useState<SosQuickPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    apiFetch("/sos/preferences")
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            "Countdown settings could not load. Reload the page to try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function save() {
    if (!settings) return;
    setBusy(true);
    setNotice("");
    try {
      const data = await apiFetch("/sos/preferences", {
        method: "POST",
        body: JSON.stringify({
          enabled: settings.enabled,
          shareLocation: settings.shareLocation,
          fields: settings.fields,
        }),
      });
      setSettings(data);
      setNotice(
        data.enabled
          ? "Countdown SOS enabled. Tapping SOS starts a 10-second countdown; cancel before it ends to stop the email."
          : "Countdown SOS disabled. Manual activation below remains available.",
      );
    } catch {
      setNotice(
        "Could not save settings. Save a valid emergency contact email in Profile and check the backend.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      id="quick-setup"
      className="scroll-mt-24 border border-panel-border bg-panel text-ink"
    >
      <CardHeader>
        <CardTitle>Set up quick SOS once</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted">
          Save your sharing choices now. Afterwards, tapping SOS from the navbar
          or urgent chat starts a cancellable ten-second countdown and emails
          your contact automatically when it ends.
        </p>
        {settings && (
          <>
            <p className="text-sm">
              Recipient: {settings.contactName || "Emergency contact"} ·{" "}
              {settings.recipient || "No email saved"}{" "}
              <Link href="/profile" className="text-trace underline">
                Edit profile
              </Link>
            </p>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="mb-2 text-sm font-semibold">
                Saved health fields
              </legend>
              <div className="flex flex-wrap gap-4">
                {HEALTH_FIELDS.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      className="accent-trace"
                      type="checkbox"
                      checked={settings.fields.includes(key)}
                      onChange={() => {
                        setNotice("");
                        setSettings({
                          ...settings,
                          fields: settings.fields.includes(key)
                            ? settings.fields.filter((item) => item !== key)
                            : [...settings.fields, key],
                        });
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-1 accent-trace"
                type="checkbox"
                checked={settings.shareLocation}
                disabled={busy}
                onChange={(event) => {
                  setNotice("");
                  setSettings({
                    ...settings,
                    shareLocation: event.target.checked,
                  });
                }}
              />
              <span>
                Capture and share location when I tap SOS. Use shared
                coordinates for nearby-care search with Mapbox. If GPS is
                unavailable at expiry, send without it.
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert-dim p-4 text-sm">
              <input
                className="mt-1 accent-trace"
                type="checkbox"
                checked={settings.enabled}
                disabled={busy}
                onChange={(event) => {
                  setNotice("");
                  setSettings({ ...settings, enabled: event.target.checked });
                }}
              />
              <span>
                Enable countdown SOS. I agree that tapping SOS will
                automatically email the contact shown above with these selected
                health fields and available location after ten seconds, unless
                I cancel.
              </span>
            </label>
            {!settings.senderReady && (
              <p className="text-xs text-alert">
                The server email sender is not configured. Quick activation will
                stay unavailable until it is configured.
              </p>
            )}
            <Button
              disabled={busy}
              onClick={save}
              className="bg-trace text-[#052914] hover:bg-trace/80"
            >
              {busy ? "Saving…" : "Save countdown settings"}
            </Button>
          </>
        )}
        {notice && (
          <p role="status" className="text-sm text-ink-muted">
            {notice}
          </p>
        )}
        <p className="text-xs text-ink-dim">
          Opening this page or saving settings sends no alert. Changing the
          recipient in Profile disables countdown activation until you save
          these settings again. The app must be open and signed in; it cannot
          detect unconsciousness.
        </p>
      </CardContent>
    </Card>
  );
}
