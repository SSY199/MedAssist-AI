"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await signOut();
        router.push("/login");
        router.refresh();
      }}
      className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-white/5"
    >
      Sign out
    </button>
  );
}