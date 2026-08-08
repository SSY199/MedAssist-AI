"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  Map,
  ShoppingBag,
  Clock,
  Watch,
  TriangleAlert,
  ShieldCheck,
  Menu,
} from "lucide-react";

/* ---------- scroll-reveal wrapper ---------- */
function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- small building blocks ---------- */
function Eyebrow({ label, color = "trace" }: { label: string; color?: "trace" | "alert" }) {
  const dotColor = color === "alert" ? "bg-alert shadow-[0_0_8px_#FB6A6A]" : "bg-trace shadow-[0_0_8px_#4ADE80]";
  const textColor = color === "alert" ? "text-alert" : "text-trace";
  return (
    <div className={`flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] ${textColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </div>
  );
}

function Chip({ children, variant = "before" }: { children: ReactNode; variant?: "before" | "after" }) {
  return (
    <span
      className={
        variant === "before"
          ? "rounded-full border border-panel-border px-3 py-1.75 font-mono text-xs text-ink-dim"
          : "rounded-full border border-trace-dim bg-trace/5 px-3 py-1.75 font-mono text-xs text-ink"
      }
    >
      {children}
      {variant === "before" && <span className="ml-1 opacity-40">↗</span>}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-bg-deep p-7 transition-colors duration-200 hover:bg-panel">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[9px] border border-trace-dim bg-trace/8 text-trace">
        {icon}
      </div>
      <h3 className="mb-2 font-display text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="text-[14.5px] text-ink-muted">{desc}</p>
    </div>
  );
}

/* ---------- page ---------- */
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* scanline texture */}
      <div
        className="pointer-events-none fixed inset-0 z-1"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-panel-border bg-bg/80 backdrop-blur-md">
        <nav className="relative mx-auto flex max-w-295 items-center justify-between px-7 py-[18px]">
          <div className="flex items-center gap-2.5 font-display text-[19px] font-bold tracking-tight">
            <Activity className="h-[26px] w-6.5 text-trace" strokeWidth={2} />
            MedAssistAI
          </div>

          <ul className="hidden items-center gap-8 text-[14.5px] text-ink-muted md:flex">
            <li><a href="#product" className="transition-colors hover:text-ink">Product</a></li>
            <li><a href="#how" className="transition-colors hover:text-ink">How it works</a></li>
            <li><a href="#triage" className="transition-colors hover:text-ink">Emergency care</a></li>
            <li><a href="#safety" className="transition-colors hover:text-ink">Safety</a></li>
          </ul>

          <div className="hidden items-center gap-4 md:flex">
            <a href="#" className="rounded-[9px] border border-panel-border px-5 py-2.5 text-[14.5px] font-semibold transition-all hover:border-trace-dim hover:bg-trace/6">
              Log in
            </a>
            <a href="#" className="rounded-[9px] bg-trace px-5 py-2.5 text-[14.5px] font-semibold text-[#052914] transition-all hover:-translate-y-px hover:bg-[#65e89a]">
              Create your profile
            </a>
          </div>

          <button
            aria-label="Open menu"
            className="text-ink md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu size={22} />
          </button>

          {menuOpen && (
            <ul className="absolute left-0 right-0 top-full flex flex-col gap-4 border-b border-panel-border bg-bg/95 px-7 py-5 md:hidden">
              <li><a href="#product" className="text-ink-muted">Product</a></li>
              <li><a href="#how" className="text-ink-muted">How it works</a></li>
              <li><a href="#triage" className="text-ink-muted">Emergency care</a></li>
              <li><a href="#safety" className="text-ink-muted">Safety</a></li>
              <li><a href="#" className="font-semibold text-trace">Create your profile</a></li>
            </ul>
          )}
        </nav>
      </header>

      <main className="relative z-[2]">
        {/* HERO */}
        <section className="overflow-hidden px-7 pb-15 pt-[88px]">
          <div className="mx-auto grid max-w-[1180px] items-center gap-14 md:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Eyebrow label="Live health record" />
              <h1 className="mt-5 mb-[22px] font-display text-[38px] font-bold leading-[1.06] tracking-[-0.02em] sm:text-[48px] lg:text-[60px]">
                Your entire health
                <br />
                system, on <span className="text-trace">one screen.</span>
              </h1>
              <p className="mb-8 max-w-[480px] text-lg text-ink-muted">
                Stop juggling apps for pharmacies, labs, and doctor visits. MedAssistAI
                holds your record, reads your vitals, and knows your nearest ER —
                before you have to ask.
              </p>
              <div className="mb-9 flex flex-wrap gap-3.5">
                <a href="#" className="rounded-[10px] bg-trace px-[26px] py-3.5 text-[15px] font-semibold text-[#052914] transition-all hover:-translate-y-px hover:bg-[#65e89a]">
                  Create your profile
                </a>
                <a href="#how" className="rounded-[10px] border border-panel-border px-[26px] py-3.5 text-[15px] font-semibold transition-all hover:border-trace-dim hover:bg-trace/[0.06]">
                  See how it works
                </a>
              </div>
              <div className="flex flex-wrap gap-6 font-mono text-[12.5px] text-ink-dim">
                <span className="flex items-center gap-[7px]">
                  <ShieldCheck size={14} /> Data encrypted end to end
                </span>
                <span className="flex items-center gap-[7px]">
                  <Clock size={14} /> Free to set up
                </span>
                <span className="flex items-center gap-[7px]">
                  <TriangleAlert size={14} /> Not a diagnosis, always your data
                </span>
              </div>
            </div>

            {/* MONITOR PANEL */}
            <Reveal>
              <div className="rounded-[18px] border border-panel-border bg-panel px-[22px] pt-[22px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between border-b border-panel-border pb-4 font-mono text-[11.5px] text-ink-dim">
                  <span>PATIENT MONITOR · DEMO VIEW</span>
                  <span className="flex items-center gap-1.5 text-trace">
                    <span className="h-1.5 w-1.5 rounded-full bg-trace shadow-[0_0_8px_#4ADE80]" />
                    SYNCED
                  </span>
                </div>

                <div className="py-[18px]">
                  <svg viewBox="0 0 480 110" preserveAspectRatio="none" className="w-full">
                    <path
                      d="M0,55 L60,55 L80,55 L92,20 L104,95 L116,10 L128,55 L150,55 L440,55 L460,55 L470,30 L480,55"
                      fill="none"
                      stroke="#4ADE80"
                      strokeWidth={2}
                      opacity={0.15}
                    />
                    <path
                      d="M0,55 L60,55 L80,55 L92,20 L104,95 L116,10 L128,55 L150,55 L440,55 L460,55 L470,30 L480,55"
                      fill="none"
                      stroke="#4ADE80"
                      strokeWidth={2}
                      className="motion-safe:animate-draw"
                      style={{ strokeDasharray: 1400, strokeDashoffset: 1400 }}
                    />
                  </svg>
                </div>

                <div className="grid grid-cols-2 border-t border-panel-border sm:grid-cols-4">
                  <div className="border-r border-panel-border px-[14px] pb-5 pt-4">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-dim">Heart rate</div>
                    <div className="font-mono text-[19px] font-medium text-trace">72 bpm</div>
                  </div>
                  <div className="border-panel-border px-[14px] pb-5 pt-4 sm:border-r">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-dim">SpO₂</div>
                    <div className="font-mono text-[19px] font-medium text-cyan">98%</div>
                  </div>
                  <div className="border-r border-t border-panel-border px-[14px] pb-5 pt-4 sm:border-t-0">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-dim">Steps today</div>
                    <div className="font-mono text-[19px] font-medium">6,412</div>
                  </div>
                  <div className="border-t border-panel-border px-[14px] pb-5 pt-4 sm:border-t-0">
                    <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-dim">Next dose</div>
                    <div className="font-mono text-[19px] font-medium text-amber">6:30 PM</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FRAGMENTATION */}
        <section id="product" className="px-7 py-24">
          <div className="mx-auto max-w-[1180px]">
            <Reveal className="mb-14 max-w-[640px]">
              <Eyebrow label="The problem" />
              <h2 className="my-3.5 font-display text-[28px] font-bold tracking-[-0.015em] sm:text-[34px] lg:text-[38px]">
                Right now, your health data lives in eleven different places.
              </h2>
              <p className="text-[16.5px] text-ink-muted">
                One app for medicines, another for lab tests, a group chat for
                reminders, a hospital&apos;s own portal for records. None of them
                talk to each other — and in an emergency, that gap costs time.
              </p>
            </Reveal>

            <Reveal className="grid gap-7 md:grid-cols-2">
              <div className="rounded-card border border-panel-border bg-white/[0.015] p-7">
                <h3 className="mb-[18px] font-display text-[17px] text-ink-muted">Without MedAssistAI</h3>
                <div className="flex flex-wrap gap-2">
                  <Chip>Pharmacy app</Chip>
                  <Chip>Lab booking app</Chip>
                  <Chip>Fitness tracker app</Chip>
                  <Chip>WhatsApp reminders</Chip>
                  <Chip>Paper prescriptions</Chip>
                  <Chip>Hospital portal login</Chip>
                  <Chip>Printed lab reports</Chip>
                </div>
              </div>
              <div className="rounded-card border border-trace-dim bg-gradient-to-b from-trace/[0.06] to-transparent p-7">
                <h3 className="mb-[18px] font-display text-[17px] text-trace">With MedAssistAI</h3>
                <div className="flex flex-wrap gap-2">
                  <Chip variant="after">One profile</Chip>
                  <Chip variant="after">One chat for questions</Chip>
                  <Chip variant="after">One map for care nearby</Chip>
                  <Chip variant="after">One reminder system</Chip>
                  <Chip variant="after">One report, always current</Chip>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FEATURES */}
        <section id="how" className="px-7 py-24">
          <div className="mx-auto max-w-[1180px]">
            <Reveal className="mb-14 max-w-[640px]">
              <Eyebrow label="What's inside" />
              <h2 className="my-3.5 font-display text-[28px] font-bold tracking-[-0.015em] sm:text-[34px] lg:text-[38px]">
                Everything routes back to one record.
              </h2>
              <p className="text-[16.5px] text-ink-muted">
                Every part of MedAssistAI reads from the same profile, so the answer you
                get is specific to you — your conditions, your allergies, your
                current vitals.
              </p>
            </Reveal>

            <Reveal>
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-panel-border bg-panel-border sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard
                  icon={<Activity size={18} />}
                  title="Ask, and get an answer built on your record"
                  desc="Explains a symptom, a condition, or a lab result in plain language — already aware of what you're allergic to and what you're taking."
                />
                <FeatureCard
                  icon={<Map size={18} />}
                  title="Find care near you, in seconds"
                  desc="Clinics, 24-hour pharmacies, and diagnostic labs on one map, with routes and travel time from wherever you are."
                />
                <FeatureCard
                  icon={<ShoppingBag size={18} />}
                  title="Compare prices before you book"
                  desc="Search a medicine or a lab test once and see it ranked by price and delivery time across every partner pharmacy and lab."
                />
                <FeatureCard
                  icon={<Clock size={18} />}
                  title="Never miss a dose"
                  desc="Reads your active prescriptions and sends a WhatsApp reminder when it's time — with a one-tap reorder before you run out."
                />
                <FeatureCard
                  icon={<Watch size={18} />}
                  title="Your wearable, already connected"
                  desc="Link Fitbit, Garmin, or Oura once. Heart rate, sleep, and activity flow straight into your record automatically."
                />
                <FeatureCard
                  icon={<TriangleAlert size={18} />}
                  title="One button, for when it's serious"
                  desc="SOS sends your location and a vital summary to your emergency contacts and routes you to the nearest ER — instantly."
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* TRIAGE */}
        <section id="triage" className="border-y border-panel-border bg-bg-deep px-7 py-24">
          <div className="mx-auto max-w-[1180px]">
            <Reveal className="mb-14 max-w-[640px]">
              <Eyebrow label="Emergency care" color="alert" />
              <h2 className="my-3.5 font-display text-[28px] font-bold tracking-[-0.015em] sm:text-[34px] lg:text-[38px]">
                When a symptom is serious, MedAssistAI doesn&apos;t wait for you to
                figure that out.
              </h2>
              <p className="text-[16.5px] text-ink-muted">
                Every conversation is scored for urgency as you type. A mild
                question gets a calm answer. A dangerous one changes the entire
                screen.
              </p>
            </Reveal>

            <Reveal className="grid items-center gap-14 md:grid-cols-[0.9fr_1.1fr]">
              <div className="flex flex-col gap-2.5">
                {[
                  { n: 1, desc: "Informational — general health question", high: false },
                  { n: 2, desc: "Mild — manageable at home", high: false },
                  { n: 3, desc: "Moderate — worth seeing a doctor soon", high: false },
                  { n: 4, desc: "Urgent — seek care today", high: true },
                  { n: 5, desc: "Life-threatening — chest pain, stroke signs, difficulty breathing", high: true },
                ].map((row) => (
                  <div
                    key={row.n}
                    className={`flex items-center gap-3.5 rounded-[9px] border px-3.5 py-2.5 font-mono text-[13px] ${
                      row.high
                        ? "border-alert/40 bg-alert-dim text-ink"
                        : "border-panel-border text-ink-muted"
                    }`}
                  >
                    <span
                      className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[11.5px] ${
                        row.high ? "bg-alert text-[#3a0a0a]" : "bg-white/[0.06]"
                      }`}
                    >
                      {row.n}
                    </span>
                    <span>{row.desc}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-4 rounded-card border border-alert/45 bg-alert-dim p-6">
                <TriangleAlert className="mt-0.5 flex-shrink-0 text-alert" size={26} />
                <div>
                  <h4 className="mb-1.5 font-display text-base text-alert">
                    Score 4 or 5 triggers a Red Alert
                  </h4>
                  <p className="text-sm text-ink-muted">
                    Standard chat stops immediately. The screen switches to your
                    nearest emergency room, routed and ready, while MedAssistAI
                    prepares your vital summary to send ahead of you.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* SAFETY */}
        <section id="safety" className="px-7 py-24">
          <div className="mx-auto max-w-[1180px]">
            <Reveal className="mb-14 max-w-[640px]">
              <Eyebrow label="Before you begin" />
              <h2 className="my-3.5 font-display text-[28px] font-bold tracking-[-0.015em] sm:text-[34px] lg:text-[38px]">
                What MedAssistAIssistAI is, and isn&apos;t.
              </h2>
            </Reveal>
            <Reveal className="grid gap-10 md:grid-cols-2">
              <div className="border-l-2 border-trace-dim pl-5">
                <h4 className="mb-2 font-display text-base">It&apos;s a guide, not a diagnosis</h4>
                <p className="text-[14.5px] text-ink-muted">
                  MedAssistAIssistAI explains what your symptoms and results might mean, and
                  helps you decide what to do next. It doesn&apos;t replace a
                  licensed physician. If something feels seriously wrong, get
                  care immediately.
                </p>
              </div>
              <div className="border-l-2 border-trace-dim pl-5">
                <h4 className="mb-2 font-display text-base">Your record stays yours</h4>
                <p className="text-[14.5px] text-ink-muted">
                  Your profile, prescriptions, and vitals are encrypted and never
                  sold. You choose what&apos;s shared, and with whom, every time.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="px-7 py-[90px] text-center sm:py-[110px]">
          <div className="mx-auto max-w-[1180px]">
            <Eyebrow label="Takes about four minutes" />
            <div className="mx-auto mt-2 flex justify-center">
              <span className="sr-only">centered eyebrow</span>
            </div>
            <Reveal>
              <h2 className="mx-auto mt-4 mb-4 max-w-[640px] font-display text-[30px] font-bold tracking-[-0.02em] sm:text-[38px] lg:text-[44px]">
                Set up your profile once.
                <br />
                Use it everywhere your health does.
              </h2>
              <p className="mb-8 text-ink-muted">
                Free to start. No app to install — it runs right in your browser.
              </p>
              <a href="#" className="inline-block rounded-[10px] bg-trace px-[26px] py-3.5 text-[15px] font-semibold text-[#052914] transition-all hover:-translate-y-px hover:bg-[#65e89a]">
                Create your profile
              </a>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-panel-border px-7 py-9">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 text-[13px] text-ink-dim">
          <div>© 2026 MedAssistAIssistAIistAI Health. Not a substitute for professional medical advice.</div>
          <div className="flex gap-5">
            <a href="#" className="transition-colors hover:text-ink-muted">Privacy</a>
            <a href="#" className="transition-colors hover:text-ink-muted">Terms</a>
            <a href="#" className="transition-colors hover:text-ink-muted">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}