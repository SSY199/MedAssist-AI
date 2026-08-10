"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { signInWithGoogle } from "@/lib/auth-client";

function LoginCard() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  return (
    <div className="w-full max-w-sm rounded-card border border-panel-border bg-panel p-8 text-center">
      <div className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-full border border-trace-dim bg-trace/10 text-trace">
        <Activity size={20} />
      </div>

      <h1 className="mb-2 font-display text-xl font-bold text-ink">
        Sign in to MedAssistAI
      </h1>
      <p className="mb-7 text-sm text-ink-muted">
        Your health record, in one place.
      </p>

      <button
        onClick={() => signInWithGoogle(redirectTo)}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-panel-border bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] transition hover:bg-white/90"
      >
        <FcGoogle size={18} />
        Continue with Google
      </button>

      <p className="mt-6 font-mono text-[11px] leading-relaxed text-ink-dim">
        MedAssistAI is informational only and does not replace professional
        medical advice.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      {/* useSearchParams needs a Suspense boundary in the App Router */}
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </div>
  );
}