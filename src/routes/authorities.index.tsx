import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAuthoritiesFn } from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, ShieldCheck, Clock, CheckCircle2, Building2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/authorities/")({
  component: AuthoritiesIndex,
});

function AuthoritiesIndex() {
  const [q, setQ] = useState("");
  const auths = useQuery({ queryKey: ["authorities"], queryFn: () => listAuthoritiesFn() });

  const filtered = (auths.data ?? []).filter((a: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return a.name.toLowerCase().includes(s) || (a.description ?? "").toLowerCase().includes(s);
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Authorities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {auths.data?.length ?? 0} agencies · Track performance and accountability
          </p>
        </header>

        {/* Mobile-only quick swap to Leaderboard (mirrors Leaderboard page's own Authorities tab) */}
        <div className="mb-4 flex w-fit gap-1 rounded-full border bg-card p-1 text-xs font-medium md:hidden">
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-primary-foreground">
            <Building2 className="h-4 w-4" /> Authorities
          </span>
          <Link
            to="/leaderboard"
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-muted-foreground transition hover:text-foreground"
          >
            <TrendingUp className="h-4 w-4" /> Leaderboard
          </Link>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search authority…"
            className="pl-9"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a: any) => {
            const authorityLinkParams = { authorityId: String(a.id) };
            return (
              <Link
                key={a.id}
                to="/authorities/$authorityId"
                params={authorityLinkParams}
                className="rounded-2xl border bg-card p-4 transition hover:bg-accent hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-lg">
                    {a.logo_url ? (
                      <img
                        src={a.logo_url}
                        className="h-full w-full rounded-xl object-cover"
                        alt=""
                      />
                    ) : (
                      a.name.slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{a.name}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" /> {a.resolved}/{a.total}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {a.avg_days ? `${a.avg_days.toFixed(1)}d` : "—"}
                      </span>
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
                </div>
                {a.description && (
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                )}
              </Link>
            );
          })}
          {auths.isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          {!auths.isLoading && auths.isError && (
            <div className="col-span-full rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
              Failed to load authorities. Please refresh, or try again shortly.
            </div>
          )}
          {!auths.isLoading && !auths.isError && filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
              No authorities match your search.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
