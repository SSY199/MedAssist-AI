import { getMyProfile } from "@/lib/profile-actions";
import { EhrForm } from "@/components/EhrForm";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await getMyProfile();
  const { saved } = await searchParams;

  return (
    <div className="min-h-screen bg-bg px-6 py-14 text-ink">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h1 className="mb-2 font-display text-2xl font-bold">Your profile</h1>
        <p className="text-ink-muted">
          Update your details anytime — the chatbot, SOS, and reminders
          always use the latest version.
        </p>
      </div>

      {saved && (
        <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-trace-dim bg-trace/5 px-4 py-2.5 text-center text-sm text-trace">
          Profile updated.
        </div>
      )}

      <EhrForm
        initialData={profile}
        redirectTo="/profile?saved=1"
        submitLabel="Save changes"
      />
    </div>
  );
}