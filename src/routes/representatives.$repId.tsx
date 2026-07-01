import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listRepresentativesFn, listIssuesFn } from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { IssueCard } from "@/components/IssueCard";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MapPin, ShieldCheck, Building2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/representatives/$repId")({
  component: RepresentativeDetail,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
});

function RepresentativeDetail() {
  const { repId } = Route.useParams();

  const reps = useQuery({ queryKey: ["representatives"], queryFn: () => listRepresentativesFn() });
  const issues = useQuery({
    queryKey: ["issues", "recent"],
    queryFn: () => listIssuesFn({ data: { limit: 50 } }),
  });

  const rep = (reps.data ?? []).find((r: any) => String(r.id) === repId);

  const repIssues = useMemo(
    () => (issues.data ?? []).filter((i: any) => String(i.representative?.id) === repId),
    [issues.data, repId],
  );

  const stats = useMemo(() => {
    const total = repIssues.length;
    const resolved = repIssues.filter((i: any) =>
      ["resolved", "community_confirmed", "closed"].includes(i.status),
    ).length;
    const pending = total - resolved;
    const score = total ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, pending, score };
  }, [repIssues]);

  if (reps.isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl p-10">Loading…</div>
      </AppShell>
    );
  }
  if (!rep) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl p-10 text-center text-muted-foreground">
          Representative not found.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link
          to="/leaderboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Leaderboard
        </Link>

        <header className="flex flex-wrap items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold overflow-hidden">
            {rep.photo_url ? (
              <img src={rep.photo_url} className="h-full w-full object-cover" alt="" />
            ) : (
              rep.name.slice(0, 2)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{rep.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {rep.role && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {rep.role}
                </span>
              )}
              {rep.constituency && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {rep.constituency}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {rep.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {rep.phone}
                </span>
              )}
              {rep.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {rep.email}
                </span>
              )}
            </div>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-lg font-bold ${
              stats.score >= 70
                ? "bg-success/15 text-success"
                : stats.score >= 40
                  ? "bg-warning/15 text-warning"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            <ShieldCheck className="mr-1.5 inline h-5 w-5" />
            {stats.score}%
          </div>
        </header>

        {/* Assigned authority */}
        {rep.authority && (
          <section className="mt-6">
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Assigned authority
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{rep.authority.name}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total issues</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">
              {stats.total}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Resolved</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight text-success">
              {stats.resolved}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight text-warning">
              {stats.pending}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          <AlertCircle className="mr-1.5 inline h-3.5 w-3.5 text-warning" />
          This score is based only on publicly visible reports and community verification.
        </div>

        {/* Issues feed */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Issues ({repIssues.length})</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {repIssues.slice(0, 16).map((it: any) => (
              <IssueCard key={it.id} issue={it} />
            ))}
            {issues.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
              ))}
            {!issues.isLoading && repIssues.length === 0 && (
              <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No issues associated with this representative yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
