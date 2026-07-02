import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listAuthoritiesFn, listIssuesFn } from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { IssueCard } from "@/components/IssueCard";
import { AuthorityLogo } from "@/components/AuthorityLogo";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  TrendingUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { STATUS_META } from "@/lib/civic";

export const Route = createFileRoute("/authorities/$authorityId")({
  component: AuthorityDetail,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
});

const CHART_COLORS = ["#ef4444", "#f59e0b", "#16a34a"];

function AuthorityDetail() {
  const { authorityId } = Route.useParams();

  const auths = useQuery({ queryKey: ["authorities"], queryFn: () => listAuthoritiesFn() });
  const issues = useQuery({
    queryKey: ["issues", "authority", authorityId],
    queryFn: () => listIssuesFn({ data: { limit: 50 } }),
  });

  const authority = (auths.data ?? []).find((a: any) => String(a.id) === authorityId);

  const assignedIssues = useMemo(
    () => (issues.data ?? []).filter((i: any) => String(i.authority?.id) === authorityId),
    [issues.data, authorityId],
  );

  const resolutionTrend = useMemo(() => {
    const months: Record<
      string,
      { month: string; resolved: number; pending: number; reported: number }
    > = {};
    assignedIssues.forEach((i: any) => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { month: key, resolved: 0, pending: 0, reported: 0 };
      months[key].reported++;
      if (["resolved", "community_confirmed", "closed"].includes(i.status)) {
        months[key].resolved++;
      } else {
        months[key].pending++;
      }
    });
    return Object.values(months)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [assignedIssues]);

  if (auths.isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl p-10">Loading…</div>
      </AppShell>
    );
  }
  if (!authority) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl p-10 text-center text-muted-foreground">
          Authority not found.
        </div>
      </AppShell>
    );
  }

  const stats = [
    {
      icon: <AlertCircle className="h-4 w-4 text-warning" />,
      label: "Total reports",
      value: authority.total,
    },
    {
      icon: <CheckCircle2 className="h-4 w-4 text-success" />,
      label: "Resolved",
      value: authority.resolved,
    },
    {
      icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
      label: "Pending",
      value: authority.pending,
    },
    {
      icon: <Clock className="h-4 w-4 text-primary" />,
      label: "Avg resolution",
      value: authority.avg_days ? `${authority.avg_days.toFixed(1)}d` : "—",
    },
  ];

  const chartTickStyle = { fontSize: 11 };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link
          to="/authorities"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← All authorities
        </Link>

        {/* Header */}
        <header className="flex flex-wrap items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-primary/10 overflow-hidden font-bold text-primary text-2xl">
            <AuthorityLogo url={authority.logo_url} className="h-full w-full rounded-2xl object-contain p-1.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {authority.name}
            </h1>
            {(authority as any).description && (
              <p className="mt-1 text-sm text-muted-foreground">{(authority as any).description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {authority.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {authority.phone}
                </span>
              )}
              {authority.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {authority.email}
                </span>
              )}
              {authority.website && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> {authority.website}
                </span>
              )}
              {authority.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {authority.address}
                </span>
              )}
            </div>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-lg font-bold ${
              authority.score >= 70
                ? "bg-success/15 text-success"
                : authority.score >= 40
                  ? "bg-warning/15 text-warning"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            <ShieldCheck className="mr-1.5 inline h-5 w-5" />
            {authority.score}%
          </div>
        </header>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                {s.icon}
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <div className="mt-2 font-display text-2xl font-extrabold tracking-tight">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Resolution trend */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Resolution trend (monthly)</h2>
          <div className="mt-3 rounded-2xl border bg-card p-4">
            {resolutionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={resolutionTrend}>
                  <XAxis dataKey="month" tick={chartTickStyle} />
                  <YAxis tick={chartTickStyle} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="reported"
                    name="Reported"
                    stackId="a"
                    fill="#ef4444"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" />
                  <Bar
                    dataKey="resolved"
                    name="Resolved"
                    stackId="a"
                    fill="#16a34a"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough data for a trend chart.</p>
            )}
          </div>
        </section>

        {/* Issues feed */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              Issues assigned ({assignedIssues.length})
            </h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {assignedIssues.slice(0, 16).map((it: any) => (
              <IssueCard key={it.id} issue={it} />
            ))}
            {issues.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
              ))}
            {!issues.isLoading && assignedIssues.length === 0 && (
              <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No issues assigned yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
