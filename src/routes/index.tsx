import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listIssuesFn, analyticsFn, listAuthoritiesFn } from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { IssueCard } from "@/components/IssueCard";
import { Plus, MapPin, Flame, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
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
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 md:pt-16 md:pb-20">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Mangaluru civic accountability
              </span>
              <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                Report it.
                <br /> Track it.
                <br />
                <span className="text-primary">Get it fixed.</span>
              </h1>
              <p className="mt-4 max-w-md text-base text-muted-foreground">
                Pothole, garbage, broken streetlight — snap a photo and the right authority gets
                notified. No login needed.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/report">
                  <Button size="lg" className="gap-2 rounded-full px-6 shadow-md">
                    <Plus className="h-5 w-5" /> Report an issue
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button size="lg" variant="outline" className="gap-2 rounded-full px-6">
                    <MapPin className="h-5 w-5" /> Explore the map
                  </Button>
                </Link>
              </div>

              <dl className="mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
                <Stat label="Issues reported" value={analytics.data?.total ?? 0} />
                <Stat label="Resolved" value={analytics.data?.resolved ?? 0} />
                <Stat
                  label="Avg. fix days"
                  value={analytics.data?.avg_days ? analytics.data.avg_days.toFixed(1) : "—"}
                />
              </dl>
            </div>

            <div className="relative">
              <div className="absolute -left-6 -top-6 hidden h-32 w-32 rounded-full bg-primary/15 blur-3xl md:block" />
              <div className="absolute -bottom-8 -right-2 hidden h-40 w-40 rounded-full bg-success/15 blur-3xl md:block" />
              <div className="grid grid-cols-2 gap-3">
                {(heat.data ?? []).slice(0, 4).map((it: any) => (
                  <IssueCard key={it.id} issue={it} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionHeader
          icon={<Flame className="h-5 w-5 text-warning" />}
          title="Hottest in Mangaluru"
          subtitle="Ranked by heat score — votes, age, severity & duplicates."
          link={{ to: "/explore", label: "See all" }}
        />
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
      <section className="mx-auto max-w-6xl px-4 py-6">
        <SectionHeader
          icon={<Sparkles className="h-5 w-5 text-primary" />}
          title="Just reported"
          link={{ to: "/explore", label: "Browse" }}
        />
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(recent.data ?? []).map((it: any) => (
            <IssueCard key={it.id} issue={it} />
          ))}
        </div>
      </section>

      {/* Authorities */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionHeader
          icon={<ShieldCheck className="h-5 w-5 text-success" />}
          title="Authority leaderboard"
          subtitle="Who is fixing — and who isn't."
          link={{ to: "/leaderboard", label: "Full leaderboard" }}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
                  {a.avg_days ? ` · avg ${a.avg_days.toFixed(1)}d` : ""}
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
  icon,
  title,
  subtitle,
  link,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
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
          {link.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
