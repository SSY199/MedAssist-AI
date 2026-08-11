import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { EhrForm } from "@/components/EhrForm";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-bg px-6 py-14 text-ink">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="mb-2 font-display text-2xl font-bold">
          Let&apos;s set up your profile, {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-ink-muted">
          This becomes the single source of truth the chatbot, SOS, and
          reminders all read from. Most fields are optional — fill in what
          you know now, edit it anytime later.
        </p>
      </div>
      <EhrForm redirectTo="/dashboard" submitLabel="Save and continue" />
    </div>
  );
}