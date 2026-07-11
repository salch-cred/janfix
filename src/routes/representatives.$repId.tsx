import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listRepresentativesFn, listIssuesFn } from "@/lib/queries.functions";
import { fetchGovReportCardFn } from "@/lib/gov-report.functions";
import { AppShell } from "@/components/AppShell";
import { IssueCard } from "@/components/IssueCard";
import { JanFixLogo } from "@/components/JanFixLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone, Mail, MapPin, ShieldCheck, Building2, AlertCircle,
  ThumbsUp, CheckCircle2, Clock, FileText, IndianRupee,
  BarChart3, ExternalLink, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/representatives/$repId")({
  component: RepresentativeDetail,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
});

const COMPLETED_STATUSES = ["resolved", "community_confirmed", "closed"];

function RepresentativeDetail() {
  const { repId } = Route.useParams();

  const reps = useQuery({ queryKey: ["representatives"], queryFn: () => listRepresentativesFn() });
  const issues = useQuery({
    queryKey: ["issues", "representative", repId],
    queryFn: () => listIssuesFn({ data: { representative_id: Number(repId), limit: 50 } }),
  });

  const rep = (reps.data ?? []).find((r: any) => String(r.id) === repId);

  const repIssues = useMemo(
    () => (issues.data ?? []).filter((i: any) => String(i.representative?.id) === repId),
    [issues.data, repId],
  );

  const completedIssues = useMemo(
    () => repIssues.filter((i: any) => COMPLETED_STATUSES.includes(i.status)),
    [repIssues],
  );

  const pendingIssues = useMemo(
    () => repIssues.filter((i: any) => !COMPLETED_STATUSES.includes(i.status)),
    [repIssues],
  );

  const totalVotes = useMemo(
    () => repIssues.reduce((sum: number, i: any) => sum + (i.supporters_count ?? 0), 0),
    [repIssues],
  );

  const stats = useMemo(() => {
    const total = repIssues.length;
    const resolved = completedIssues.length;
    const pending = pendingIssues.length;
    const score = total ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, pending, score };
  }, [repIssues, completedIssues, pendingIssues]);

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
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-primary/20 text-primary text-2xl font-bold overflow-hidden">
            {rep.photo_url ? (
              <img src={rep.photo_url} className="h-full w-full object-cover" alt="" />
            ) : (
              <JanFixLogo className="h-12 w-12" />
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
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total issues</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight">
              {stats.total}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight text-success">
              {stats.resolved}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Not completed</div>
            <div className="mt-1 font-display text-2xl font-extrabold tracking-tight text-warning">
              {stats.pending}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">People's votes</div>
            <div className="mt-1 flex items-center gap-1.5 font-display text-2xl font-extrabold tracking-tight text-primary">
              <ThumbsUp className="h-5 w-5" /> {totalVotes}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          <AlertCircle className="mr-1.5 inline h-3.5 w-3.5 text-warning" />
          This score is based only on publicly visible reports and community verification.
        </div>

        {/* ── Budget Report Card ──────────────────────────────────────── */}
        <BudgetReportSection repName={rep.name} constituency={rep.constituency} />

        {/* Completed works */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <CheckCircle2 className="h-5 w-5 text-success" /> Completed works ({completedIssues.length})
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {completedIssues.slice(0, 16).map((it: any) => (
              <IssueCard key={it.id} issue={it} />
            ))}
            {issues.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
              ))}
            {!issues.isLoading && completedIssues.length === 0 && (
              <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No completed issues yet.
              </div>
            )}
          </div>
        </section>

        {/* Not completed / pending works */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Clock className="h-5 w-5 text-warning" /> Not completed works ({pendingIssues.length})
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {pendingIssues.slice(0, 16).map((it: any) => (
              <IssueCard key={it.id} issue={it} />
            ))}
            {issues.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
              ))}
            {!issues.isLoading && pendingIssues.length === 0 && (
              <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No pending issues — all caught up!
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function BudgetReportSection({ repName, constituency }: { repName: string; constituency: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

  const budgetQuery = useQuery({
    queryKey: ["govBudgetReport", repName, constituency],
    queryFn: () => fetchGovReportCardFn({ data: { rep_name: repName, constituency } }),
    enabled: isOpen, // Only load when user expands the section
  });

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card shadow-sm overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Government Budget & Expenditure Card</h3>
            <p className="text-xs text-muted-foreground">
              {isOpen ? "Latest live fiscal breakdown for this constituency" : "Click to load and view live budget breakdown & bills"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border p-5 bg-card">
          {budgetQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              Fetching official datasets...
            </div>
          ) : budgetQuery.isError ? (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              Failed to load budget datasets. Please try again later.
            </div>
          ) : budgetQuery.data ? (
            <div className="space-y-6">
              {/* Aggregates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-muted/40 border">
                  <div className="text-xs text-muted-foreground">Total Budget Allocated</div>
                  <div className="mt-1 font-display text-2xl font-black text-foreground">
                    ₹{budgetQuery.data.totalAllocated} Lakhs
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-success/5 border border-success/10">
                  <div className="text-xs text-success/80">Total Budget Utilized</div>
                  <div className="mt-1 font-display text-2xl font-black text-success">
                    ₹{budgetQuery.data.totalUtilized} Lakhs
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="text-xs text-primary/80">Utilization Rate</div>
                  <div className="mt-1 flex items-baseline gap-2 font-display text-2xl font-black text-primary">
                    {budgetQuery.data.utilizationPercent}%
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Fund Utilization</span>
                  <span className="text-foreground">{budgetQuery.data.utilizationPercent}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${budgetQuery.data.utilizationPercent}%` }}
                  />
                </div>
              </div>

              {/* Table breakdown */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" /> Fund Breakdown by Development Sector
                </h4>
                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="p-3 font-semibold text-muted-foreground">Development Head / Sector</th>
                        <th className="p-3 font-semibold text-muted-foreground text-right">Allocated</th>
                        <th className="p-3 font-semibold text-muted-foreground text-right">Utilized</th>
                        <th className="p-3 font-semibold text-muted-foreground text-right">Pending / Bills</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {budgetQuery.data.breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-medium text-foreground">{item.head}</td>
                          <td className="p-3 text-right font-mono">₹{item.allocated}L</td>
                          <td className="p-3 text-right font-mono text-success">₹{item.utilized}L</td>
                          <td className="p-3 text-right font-mono text-warning">₹{item.pending}L</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sources footer */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border text-xs">
                <div className="space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Data Transparency Source
                  </div>
                  <div className="text-muted-foreground max-w-lg">
                    {budgetQuery.data.source}. Last fetched: {new Date(budgetQuery.data.lastUpdated).toLocaleDateString()}.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {budgetQuery.data.sourceUrls.map((lnk, idx) => (
                    <a
                      key={idx}
                      href={lnk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all"
                    >
                      {lnk.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

