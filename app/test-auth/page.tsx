"use client";

import { useSession, signOut, signInWithGoogle } from "@/lib/auth-client";

export default function TestAuthPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <div className="p-10 font-mono text-sm">Checking session...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-10 text-ink">
      <h1 className="font-display text-2xl font-bold">Auth test page</h1>

      {session ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-panel-border bg-panel p-6 font-mono text-sm">
          <p className="text-trace">✓ Logged in</p>
          <pre className="max-w-md whitespace-pre-wrap text-ink-muted">
            {JSON.stringify(session.user, null, 2)}
          </pre>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-panel-border px-4 py-2 hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          onClick={() => signInWithGoogle()}
          className="rounded-lg bg-trace px-5 py-3 font-semibold text-[#052914]"
        >
          Continue with Google
        </button>
      )}
    </div>
  );
}