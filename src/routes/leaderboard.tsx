import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  listAuthoritiesFn,
  listRepresentativesFn,
  wardStatsFn,
} from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { JanFixLogo } from "@/components/JanFixLogo";
import { AuthorityLogo } from "@/components/AuthorityLogo";
import {
  Building2,
  Users,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  Sparkles,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
});

type Tab = "authorities" | "representatives" | "wards";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "authorities", label: "Authorities", icon: Building2 },
  { key: "representatives", label: "Representatives", icon: Users },
  { key: "wards", label: "Wards", icon: MapPin },
];

function repProfileParams(r: any) {
  return { repId: String(r.id) };
}

function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("authorities");

  const auths = useQuery({ queryKey: ["authorities"], queryFn: () => listAuthoritiesFn() });
  const reps = useQuery({ queryKey: ["representatives"], queryFn: () => listRepresentativesFn() });
  const allStats = useQuery({ queryKey: ["wardStats"], queryFn: () => wardStatsFn() });

  const wardLeaderboard = useMemo(() => {
    return (allStats.data ?? []).sort((a: any, b: any) => b.resolved - a.resolved || b.total - a.total);
  }, [allStats.data]);

  const repLeaderboard = useMemo(() => {
    return (reps.data ?? []).sort((a: any, b: any) => b.score - a.score || b.resolved - a.resolved);
  }, [reps.data]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              Leaderboard — Positive Accountability
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Celebrating transparency, responsiveness, and civic progress across Mangaluru.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 rounded-full border bg-card p-1 text-xs font-medium w-fit">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 transition ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Authorities tab */}
        {tab === "authorities" && (
          <div className="mt-6 space-y-2">
            {(auths.data ?? [])
              .slice()
              .sort((a: any, b: any) => b.score - a.score)
              .map((a: any, idx: number) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-accent/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary overflow-hidden">
                    <AuthorityLogo url={a.logo_url} className="h-full w-full rounded-xl object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{a.name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" /> {a.resolved}/{a.total}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{" "}
                        {a.avg_days ? `${Number(a.avg_days).toFixed(1)}d avg` : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-warning" /> {a.pending} pending
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs text-muted-foreground md:inline">Score</span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        a.score >= 70
                          ? "bg-success/15 text-success"
                          : a.score >= 40
                            ? "bg-warning/15 text-warning"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {a.score}%
                    </span>
                  </div>
                </div>
              ))}
            {auths.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            {!auths.isLoading && (auths.data ?? []).length === 0 && (
              <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No authorities yet.
              </div>
            )}
          </div>
        )}

        {/* Representatives tab */}
        {tab === "representatives" && (
          <div className="mt-6 space-y-2">
            {repLeaderboard.map((r: any, idx: number) => (
              <Link
                key={r.id}
                to="/representatives/$repId"
                params={repProfileParams(r)}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-accent/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold overflow-hidden">
                  {r.photo_url ? (
                    <img src={r.photo_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <JanFixLogo className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {r.role && <span>{r.role}</span>}
                    {r.constituency && <span>· {r.constituency}</span>}
                    {r.authority && <span>· {r.authority.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground md:inline">Score</span>
                  <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-bold text-success">
                    {r.score}%
                  </span>
                </div>
              </Link>
            ))}
            {reps.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            {!reps.isLoading && (reps.data ?? []).length === 0 && (
              <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No representatives yet.
              </div>
            )}
          </div>
        )}

        {/* Wards tab */}
        {tab === "wards" && (
          <div className="mt-6 space-y-2">
            {wardLeaderboard.map((w: any, idx: number) => (
              <div
                key={w.id}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-accent/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">
                    Ward #{w.number}: {w.name}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {w.total} reported
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-success" /> {w.resolved} resolved
                    </span>
                    {w.score > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" /> {w.score}% resolved
                      </span>
                    )}
                  </div>
                </div>
                {w.resolved > 0 && (
                  <div className="rounded-full bg-success/15 px-3 py-1 text-sm font-bold text-success">
                    {w.resolved} fixed
                  </div>
                )}
              </div>
            ))}
            {allStats.isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            {!allStats.isLoading && wardLeaderboard.length === 0 && (
              <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No ward data yet.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
