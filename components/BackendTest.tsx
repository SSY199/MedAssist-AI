"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function BackendTest() {
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    setResult(null);
    setIsError(false);
    try {
      const data = await apiFetch("/ehr/me");
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setIsError(true);
      setResult(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-card border border-panel-border bg-panel p-6">
      <h2 className="mb-1 font-display text-sm font-bold text-ink">
        Backend connection test
      </h2>
      <p className="mb-4 text-xs text-ink-muted">
        Calls FastAPI&apos;s /ehr/me with a Better-Auth JWT — confirms the
        Next.js ↔ FastAPI bridge actually works.
      </p>
      <button
        onClick={runTest}
        disabled={loading}
        className="rounded-lg border border-panel-border px-4 py-2 text-xs font-semibold text-ink hover:bg-white/5 disabled:opacity-50"
      >
        {loading ? "Testing..." : "Test backend connection"}
      </button>

      {result && (
        <pre
          className={`mt-4 overflow-x-auto rounded-lg border p-3 font-mono text-xs ${
            isError
              ? "border-alert/40 bg-alert-dim text-alert"
              : "border-trace-dim bg-trace/5 text-ink"
          }`}
        >
          {result}
        </pre>
      )}
    </div>
  );
}