import Link from "next/link";
import { headers } from "next/headers";
import { Pencil, MessageSquare, Map, ShoppingBag, Clock, Watch } from "lucide-react";
import { auth } from "@/lib/auth";
import { getMyProfile } from "@/lib/profile-actions";

const QUICK_LINKS = [
  { href: "/chat", label: "Chat", icon: MessageSquare, ready: true },
  { href: "/map", label: "Map", icon: Map, ready: true },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag, ready: false },
  { href: "/reminders", label: "Reminders", icon: Clock, ready: false },
  { href: "/wearables", label: "Wearables", icon: Watch, ready: false },
];

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const profile = await getMyProfile();
  const firstName = session?.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="p-10">
      <h1 className="mb-8 font-display text-2xl font-bold">
        Welcome back, {firstName}
      </h1>

      {/* profile summary */}
      <div className="mb-10 rounded-card border border-panel-border bg-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink">Your profile</h2>
          <Link
            href="/profile"
            className="flex items-center gap-1 text-xs font-semibold text-trace hover:underline"
          >
            <Pencil size={12} /> Edit
          </Link>
        </div>

        {!profile ? (
          <p className="text-sm text-ink-muted">
            You haven&apos;t completed your profile yet.{" "}
            <Link href="/onboarding" className="text-trace hover:underline">
              Set it up now
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                Age
              </p>
              <p className="text-sm text-ink">{profile.age}</p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                Gender
              </p>
              <p className="text-sm capitalize text-ink">
                {profile.gender.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                Medications
              </p>
              <p className="text-sm text-ink">
                {profile.currentMedications.length || "None recorded"}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                Emergency contact
              </p>
              <p className="text-sm text-ink">
                {profile.emergencyContactName || "Not set"}
              </p>
            </div>

            {profile.chronicIllnesses.length > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                  Chronic conditions
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.chronicIllnesses.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-panel-border px-3 py-1 font-mono text-xs text-ink"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.allergies.length > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                  Allergies
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-alert/40 bg-alert-dim px-3 py-1 font-mono text-xs text-alert"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* quick links */}
      <h2 className="mb-4 font-display text-base font-bold text-ink">Quick access</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK_LINKS.map(({ href, label, icon: Icon, ready }) =>
          ready ? (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-card border border-panel-border p-5 text-center transition-colors hover:border-trace-dim hover:bg-trace/5"
            >
              <Icon size={20} className="text-trace" />
              <span className="text-xs font-medium text-ink">{label}</span>
            </Link>
          ) : (
            <div
              key={href}
              className="flex cursor-not-allowed flex-col items-center gap-2 rounded-card border border-panel-border p-5 text-center opacity-50"
            >
              <Icon size={20} className="text-ink-dim" />
              <span className="text-xs font-medium text-ink">{label}</span>
              <span className="font-mono text-[10px] text-ink-dim">Coming soon</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}