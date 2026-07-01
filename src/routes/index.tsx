import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  MapsLocation01Icon,
  Building02Icon,
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
      "Take a photo of the pothole, garbage pile, or broken streetlight. Pin the location \u2014 no account required.",
  },
  {
    icon: Notification03Icon,
    title: "Right authority notified",
    description: "JanFix routes the report to the exact civic authority responsible, automatically.",
  },
  {
    icon: CheckmarkCircle02Icon,
    title: "Tracked until it's fixed",
    description:
      "Follow status updates publicly. Authorities are ranked on how fast and often they resolve issues.",
  },
];

const FEATURES = [
  {
    icon: Camera01Icon,
    title: "60-second reporting",
    description: "Snap a photo, drop a pin, and submit. No account, no forms, no friction.",
  },
  {
    icon: MapsLocation01Icon,
    title: "Live civic map",
    description: "See every open issue in Mangaluru plotted on an interactive map in real time.",
  },
  {
    icon: FireIcon,
    title: "Heat-ranked issues",
    description: "Reports are ranked by votes, age and severity so the worst problems surface first.",
  },
  {
    icon: Building02Icon,
    title: "Automatic routing",
    description: "Every issue is routed straight to the exact department or authority responsible.",
  },
  {
    icon: Shield01Icon,
    title: "Public accountability",
    description: "Authorities are scored on resolution speed and rate \u2014 fully visible to citizens.",
  },
  {
    icon: SparklesIcon,
    title: "Shareable posters",
    description: "Turn any report into a shareable poster to raise awareness in your neighbourhood.",
  },
];

const CHECKLIST = [
  "No login or app download required to report an issue",
  "Every report is routed to the correct civic authority automatically",
  "Public leaderboard keeps authorities accountable for resolution speed",
  "Track the full history of a report from submission to fix",
];

const heatSectionLink = { to: "/explore", label: "See all" };
const recentSectionLink = { to: "/explore", label: "Browse" };
const authoritiesSectionLink = { to: "/leaderboard", label: "Full leaderboard" };

function Home() {
  const heat = useQuery({
    queryKey: ["issues", "heat"],
    queryFn: () => listIssuesFn({ data: { sort: "heat", limit: 6 } }),
  });
  const recent = useQuery({
    queryKey: ["issues", "recent"],
    queryFn: () => listIssuesFn({ data: { sort: "recent", limit: 6 } }),
  });
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsFn() });
  const auths = useQuery({ queryKey: ["authorities"], queryFn: () => listAuthoritiesFn() });

  return (
    <AppShell>
      {/* Hero */}
      <section className="civic-gradient">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 md:pt-24 md:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
              <HugeiconsIcon icon={SparklesIcon} size={14} strokeWidth={1.5} /> Mangaluru civic accountability
            </span>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.03] tracking-tight md:text-7xl">
              Report it. Track it.
              <br />
              <span className="text-primary">Get it fixed.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Pothole, garbage, broken streetlight \u2014 snap a photo and the right authority gets
              notified. No login needed.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/report">
                <Button
                  size="lg"
                  className="gap-2 rounded-full bg-foreground px-7 text-background shadow-md hover:opacity-90"
                >
                  <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.5} /> Report an issue
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="gap-2 rounded-full px-7">
                  <HugeiconsIcon icon={Location01Icon} size={20} strokeWidth={1.5} /> Explore the map
                </Button>
              </Link>
            </div>

            <dl className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 text-center">
              <Stat label="Issues reported" value={analytics.data?.total ?? 0} />
              <Stat label="Resolved" value={analytics.data?.resolved ?? 0} />
              <Stat
                label="Avg. fix days"
                value={analytics.data?.avg_days ? analytics.data.avg_days.toFixed(1) : "\u2014"}
              />
            </dl>
          </div>

          <div className="relative mt-14">
            <div className="absolute -left-6 -top-10 hidden h-32 w-32 rounded-full bg-primary/15 blur-3xl md:block" />
            <div className="absolute -bottom-8 -right-2 hidden h-40 w-40 rounded-full bg-success/15 blur-3xl md:block" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(heat.data ?? []).slice(0, 4).map((it: any) => (
                <IssueCard key={it.id} issue={it} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-muted/20">
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
              <div key={step.title} className="relative rounded-3xl border bg-card p-6 shadow-sm">
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

      {/* Explore JanFix \u2014 feature grid */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Explore JanFix
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to hold your city accountable.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border bg-card p-6 shadow-sm transition hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={f.icon} size={20} strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionHeader
          eyebrow="Live right now"
          icon={<HugeiconsIcon icon={FireIcon} size={20} className="text-warning" strokeWidth={1.5} />}
          title="Hottest in Mangaluru"
          subtitle="Ranked by heat score \u2014 votes, age, severity & duplicates."
          link={heatSectionLink}
        />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(heat.data ?? []).map((it: any) => (
            <IssueCard key={it.id} issue={it} />
          ))}
          {heat.isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
            ))}
        </div>
      </section>

      {/* Recent */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <SectionHeader
          eyebrow="Fresh reports"
          icon={<HugeiconsIcon icon={SparklesIcon} size={20} className="text-primary" strokeWidth={1.5} />}
          title="Just reported"
          link={recentSectionLink}
        />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(recent.data ?? []).map((it: any) => (
            <IssueCard key={it.id} issue={it} />
          ))}
        </div>
      </section>

      {/* Problem solved \u2014 checklist */}
      <section className="border-y bg-muted/20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Why JanFix
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Civic problems, solved in the open.
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
              JanFix removes every excuse for a civic issue to go unresolved \u2014 reporting is
              instant, routing is automatic, and every authority's track record is public.
            </p>
          </div>
          <ul className="space-y-4">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.5} />
                </span>
                <span className="text-sm font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Authorities */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <SectionHeader
          eyebrow="Public accountability"
          icon={<HugeiconsIcon icon={Shield01Icon} size={20} className="text-success" strokeWidth={1.5} />}
          title="Authority leaderboard"
          subtitle="Who is fixing \u2014 and who isn't."
          link={authoritiesSectionLink}
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(auths.data ?? []).slice(0, 6).map((a: any) => (
            <Link
              key={a.id}
              to="/authorities"
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:bg-accent"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                {a.name.slice(0, 1)}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-muted-foreground">
                  {a.resolved}/{a.total} resolved
                  {a.avg_days ? ` \u00b7 avg ${a.avg_days.toFixed(1)}d` : ""}
                </div>
              </div>
              <div
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
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
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-center text-background shadow-xl md:px-16">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Seen something broken?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-background/70 md:text-base">
            It takes less than a minute to report \u2014 no account, no forms, just a photo and a pin
            on the map.
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
      <dd className="text-lg font-extrabold">{value}</dd>
    </div>
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
    <div className="flex items-end justify-between gap-3">
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
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {link.label} <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} />
        </Link>
      )}
    </div>
  );
}
