"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  MessageSquare,
  Map,
  ShoppingBag,
  Clock,
  Watch,
  User,
  TriangleAlert,
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Activity },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/map", label: "Map", icon: Map },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/reminders", label: "Reminders", icon: Clock },
  { href: "/wearables", label: "Wearables", icon: Watch },
];

export function Navbar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-panel-border bg-bg/90 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Activity size={20} className="text-trace" />
          MedAssistAI
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-trace/10 text-trace"
                    : "text-ink-muted hover:bg-white/5 hover:text-ink"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            title="Your profile"
            className={`rounded-lg p-2 transition-colors ${
              pathname === "/profile"
                ? "bg-trace/10 text-trace"
                : "text-ink-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            <User size={16} />
          </Link>

          {/* Persistent SOS button — real geolocation/routing/alerting logic
              (spec section 7) isn't built yet. This is the visual placeholder
              so the affordance is always present, as the spec requires. */}
          <button
            title="Emergency SOS — coming soon"
            onClick={() =>
              alert(
                "Emergency SOS isn't wired up yet — this will send your location and EHR summary to emergency contacts and route you to the nearest ER."
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-alert/40 bg-alert-dim px-3 py-2 text-xs font-bold text-alert transition-colors hover:bg-alert/20"
          >
            <TriangleAlert size={14} />
            SOS
          </button>

          <span className="hidden font-mono text-[11px] text-ink-dim sm:inline">
            {userEmail}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}