import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listIssuesFn, analyticsFn, listAuthoritiesFn } from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { IssueCard } from "@/components/IssueCard";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Location01Icon,
  FireIcon,
  SparklesIcon,
  Shield01Icon,
  ArrowRight01Icon,
  Camera01Icon,
  Notification03Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.prefetchQuery({
        queryKey: ["issues", "heat"],
        queryFn: () => listIssuesFn({ data: { sort: "heat", limit: 6 } }),
      }),
      context.queryClient.prefetchQuery({
        queryKey: ["issues", "recent"],
        queryFn: () => listIssuesFn({ data: { sort: "recent", limit: 6 } }),
      }),
      context.queryClient.prefetchQuery({
        queryKey: ["analytics"],
        queryFn: () => analyticsFn(),
      }),
    ]);
  },
});

const STEPS = [
  {
    icon: Camera01Icon,
    title: "Snap & report",
    description:
      "Take a photo of the pothole, garbage pile, or broken streetlight. Pin the location — no account required.",
  },
  {
    icon: Notification03Icon,
    title: "Right authority notified",
    description: "The report reaches the exact authority responsible.",
  },
  {
    icon: CheckmarkCircle02Icon,
    title: "Tracked until it's fixed",
    description:
      "Follow status updates publicly. Authorities are ranked on how fast and often they resolve issues.",
  },
];

const feedSectionLink = { to: "/explore", label: "See all reports" };
const authoritiesSectionLink = { to: "/leaderboard", label: "Full leaderboard" };

function Home() {
  const [feedTab, setFeedTab] = useState<"trending" | "recent">("trending");

  const heat = useQuery({
    queryKey: ["issues", "heat"],
    queryFn: () => listIssuesFn({ data: { sort: "heat", limit: 8 } }),
  });
  const recent = useQuery({
    queryKey: ["issues", "recent"],
    queryFn: () => listIssuesFn({ data: { sort: "recent", limit: 8 } }),
  });
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsFn() });
  const auths = useQuery({ queryKey: ["authorities"], queryFn: () => listAuthoritiesFn() });

  const currentFeedData = feedTab === "trending" ? heat.data : recent.data;
  const feedLoading = feedTab === "trending" ? heat.isLoading : recent.isLoading;

  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-24 md:pt-20 md:pb-32">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="animate-fade-in-up stagger-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-2 text-xs font-semibold ring-1 ring-inset ring-primary-foreground/20">
                <HugeiconsIcon icon={Location01Icon} size={14} strokeWidth={1.5} /> Ask JanFix. Where do
                I report an issue?
              </span>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-white/10 px-4 py-2.5 backdrop-blur-md ring-1 ring-white/20 max-w-fit">
                <span className="text-sm font-black uppercase tracking-wider text-yellow-300">
                  undu dada avassthe mare, yapa sari malpuni??
                </span>
              </div>
              <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.03] tracking-tight md:text-6xl">
                Report it. Track it.
                <br />
                Get it fixed.
              </h1>
              <p className="mt-5 max-w-md text-base text-primary-foreground/80 md:text-lg">
                Pothole, garbage, broken streetlight — snap a photo and the right civic
                authority gets notified. No login needed.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/report">
                  <Button
                    size="lg"
                    className="gap-2 rounded-full bg-background px-7 text-foreground shadow-md hover:bg-background/90"
                  >
                    Report an issue{" "}
                    <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={1.5} />
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button
                    size="lg"
                    className="gap-2 rounded-full bg-primary-foreground/10 px-7 text-primary-foreground ring-1 ring-inset ring-primary-foreground/25 hover:bg-primary-foreground/15"
                  >
                    <HugeiconsIcon icon={Location01Icon} size={18} strokeWidth={1.5} /> Explore the map
                  </Button>
                </Link>
              </div>

              <dl className="mt-10 grid max-w-md grid-cols-3 gap-3">
                <Stat label="Issues reported" value={analytics.data?.total ?? 0} />
                <Stat label="Resolved" value={analytics.data?.resolved ?? 0} />
                <Stat
                  label="Avg. fix days"
                  value={analytics.data?.avg_days ? Number(analytics.data.avg_days).toFixed(1) : "\u2014"}
                />
              </dl>
            </div>

            <div className="relative mx-auto w-full max-w-[300px] animate-fade-in-up stagger-2">
              <div className="overflow-hidden rounded-[2.5rem] border-[6px] border-foreground/90 bg-background text-foreground shadow-2xl">
                <div className="flex items-center gap-2 border-b px-4 py-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <HugeiconsIcon icon={Location01Icon} size={12} strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-bold">janfix.app</span>
                </div>
                <div className="space-y-3 px-4 py-5">
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <HugeiconsIcon icon={Notification03Icon} size={12} strokeWidth={1.5} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs">
                      Hi! What's the issue you'd like to report?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-xs text-primary-foreground">
                      Pothole near MG Road, outside the bus stop.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <HugeiconsIcon icon={Notification03Icon} size={12} strokeWidth={1.5} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs">
                      Got it — routed to PWD Mangaluru for you.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} strokeWidth={1.5} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-success/10 px-3 py-2 text-xs text-success">
                      Reported! Tracking ID #JF-4521.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t px-3 py-3">
                  <div className="flex flex-1 items-center gap-2 rounded-full bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                    <HugeiconsIcon icon={Camera01Icon} size={14} strokeWidth={1.5} /> Attach a photo...
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.5} />
                  </div>
                </div>
                <div className="border-t px-4 py-2 text-center text-[10px] text-muted-foreground">
                  Powered by JanFix
                </div>
              </div>
            </div>
          </div>
        </div>

        <WaveDivider className="absolute inset-x-0 bottom-0 h-10 w-full text-background md:h-14" />
      </section>

      {/* How it works */}
      <section className="border-y bg-muted/20 animate-fade-in-up stagger-3">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              How JanFix works
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Three steps to a fixed street.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative rounded-3xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <HugeiconsIcon icon={step.icon} size={20} strokeWidth={1.5} />
                </div>
                <div className="mt-4 text-xs font-bold text-muted-foreground">Step {i + 1}</div>
                <h3 className="mt-1 font-display text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Toggleable Civic Feed Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 animate-fade-in-up stagger-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Live Feed
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight mt-1">
              Explore reported issues
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Active citizen reports from across Dakshina Kannada.
            </p>
          </div>

          <div className="flex items-center gap-4.5 mt-2 md:mt-0">
            {/* Feed Toggles */}
            <div className="flex gap-1 rounded-full border bg-muted/30 p-1 text-xs font-semibold">
              <button
                onClick={() => setFeedTab("trending")}
                className={`flex items-center gap-1.5 rounded-full px-4.5 py-1.5 transition ${
                  feedTab === "trending"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={FireIcon} size={14} /> Trending
              </button>
              <button
                onClick={() => setFeedTab("recent")}
                className={`flex items-center gap-1.5 rounded-full px-4.5 py-1.5 transition ${
                  feedTab === "recent"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={SparklesIcon} size={14} /> Recent
              </button>
            </div>

            <Link
              to={feedSectionLink.to}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {feedSectionLink.label} <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(currentFeedData ?? []).map((it: any) => (
            <IssueCard key={it.id} issue={it} />
          ))}
          {feedLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted/60" />
            ))}
        </div>
      </section>

      {/* Authorities Leaderboard */}
      <section className="mx-auto max-w-6xl px-4 py-16 border-t animate-fade-in-up">
        <SectionHeader
          eyebrow="Public accountability"
          icon={<HugeiconsIcon icon={Shield01Icon} size={20} className="text-success" strokeWidth={1.5} />}
          title="Authority leaderboard"
          subtitle="Who is fixing — and who isn't."
          link={authoritiesSectionLink}
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(auths.data ?? []).slice(0, 6).map((a: any) => (
            <Link
              key={a.id}
              to="/authorities/$authorityId"
              params={{ authorityId: String(a.id) }}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all duration-300 hover:shadow-md hover:bg-muted/10"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-black text-primary">
                {a.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{a.name}</div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">
                  {a.resolved}/{a.total} resolved
                  {a.avg_days ? ` \u00b7 avg ${Number(a.avg_days).toFixed(1)}d` : ""}
                </div>
              </div>
              <div
                className={`rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${
                  a.score >= 70
                    ? "bg-success/15 text-success"
                    : a.score >= 40
                      ? "bg-warning/15 text-warning"
                      : "bg-destructive/15 text-destructive"
                }`}
              >
                {a.score}%
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 animate-fade-in-up">
        <div className="overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-center text-background shadow-xl md:px-16">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Seen something broken?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-background/70 md:text-base">
            Less than a minute to report — no account needed, just a photo and a pin on the map.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/report">
              <Button
                size="lg"
                className="gap-2 rounded-full bg-background px-7 text-foreground hover:bg-background/90"
              >
                <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.5} /> Report an issue
              </Button>
            </Link>
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-1 text-sm font-semibold text-background/80 hover:text-background"
            >
              See authority leaderboard <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* Floating quick-report bubble */}
      <Link
        to="/report"
        className="fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl transition hover:opacity-90 md:flex"
      >
        <HugeiconsIcon icon={Camera01Icon} size={18} strokeWidth={1.5} /> Quick report
      </Link>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-2 backdrop-blur">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-lg font-extrabold text-foreground">{value}</dd>
    </div>
  );
}

function WaveDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 20" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path
        d="M0,10 C25,0 25,20 50,10 C75,0 75,20 100,10 C125,0 125,20 150,10 C175,0 175,20 200,10 L200,20 L0,20 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SectionHeader({
  eyebrow,
  icon,
  title,
  subtitle,
  link,
}: {
  eyebrow?: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b pb-5">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
            {eyebrow}
          </div>
        )}
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {link && (
        <Link
          to={link.to}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          {link.label} <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} />
        </Link>
      )}
    </div>
  );
}
