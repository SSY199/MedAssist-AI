import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center justify-between border-b border-panel-border px-7 py-4">
        <div className="flex items-center gap-2.5 font-display text-lg font-bold">
          <Activity size={22} className="text-trace" />
          MedAssistAI
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink-muted">
            {session.user.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}