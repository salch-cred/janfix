import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAdminSession } from "@/hooks/useAdminSession";
import { analyticsFn } from "@/lib/queries.functions";
import { adminAnalyticsDetailFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Loader2,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Shield,
  LayoutDashboard,
  FolderKanban,
  Smartphone,
  Building2,
  Users,
  Map,
  Tags,
  GitBranch,
  Compass,
  Inbox,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
  ssr: false,
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/issues", label: "Issues", icon: FolderKanban },
  { to: "/admin/devices", label: "Reporters", icon: Smartphone },
  { to: "/admin/authorities", label: "Authorities", icon: Building2 },
  { to: "/admin/representatives", label: "Representatives", icon: Users },
  { to: "/admin/wards", label: "Wards", icon: Map },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/rules", label: "Rules", icon: GitBranch },
  { to: "/admin/jurisdiction", label: "Jurisdiction", icon: Compass },
  { to: "/admin/feedback", label: "Feedback", icon: Inbox },
];

const navLinkActiveProps = { className: "bg-accent text-foreground" };
const chartTooltipStyle = { borderRadius: 8, fontSize: 12 };

const statusBadgeVariant: Record<string, "secondary" | "outline" | "destructive"> = {
  reported: "outline",
  community_verified: "outline",
  assigned: "secondary",
  work_started: "secondary",
  resolved: "secondary",
  community_confirmed: "secondary",
  closed: "secondary",
};

function AdminDashboard() {
  const navigate = useNavigate();
  const { token: session, checking, logout } = useAdminSession();


  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => analyticsFn(),
  });

  const detail = useQuery({
    queryKey: ["admin-analytics-detail", session],
    queryFn: () => adminAnalyticsDetailFn({ data: { access_token: session } }),
    enabled: !!session,
  });

  const handleLogout = logout;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    {
      label: "Total Issues",
      value: analytics.data?.total ?? 0,
      icon: AlertTriangle,
      color: "text-blue-600 bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
    },
    {
      label: "Total Visitors",
      value: analytics.data?.visitors ?? 0,
      icon: Users,
      color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-400",
    },
    {
      label: "Reported Today",
      value: analytics.data?.today ?? 0,
      icon: TrendingUp,
      color: "text-green-600 bg-green-100 dark:bg-green-950 dark:text-green-400",
    },
    {
      label: "This Week",
      value: analytics.data?.week ?? 0,
      icon: Clock,
      color: "text-orange-600 bg-orange-100 dark:bg-orange-950 dark:text-orange-400",
    },
    {
      label: "Resolved",
      value: analytics.data?.resolved ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400",
    },
  ];

  const chartData = [
    { name: "Total", value: analytics.data?.total ?? 0 },
    { name: "Resolved", value: analytics.data?.resolved ?? 0 },
    {
      name: "Pending",
      value: (analytics.data?.total ?? 0) - (analytics.data?.resolved ?? 0),
    },
  ];

  const trendData = (detail.data?.daily_trend ?? []).map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  }));

  return (
    <AdminLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of JanFix Mangaluru</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold">{analytics.isLoading ? "..." : s.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">Average Resolution Time</h3>
            <p className="text-3xl font-bold text-primary">
              {analytics.data?.avg_days ? `${analytics.data.avg_days.toFixed(1)} days` : "—"}
            </p>
            <p className="text-sm text-muted-foreground">From report to resolution</p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">Issue Overview</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-4 font-semibold">Reports Trend (Last 30 Days)</h3>
          <div className="h-64">
            {detail.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">By Category</h3>
            {detail.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (detail.data?.by_category ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ul className="space-y-2">
                {(detail.data?.by_category ?? []).map((row) => (
                  <li key={row.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.name}</span>
                    <span className="font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">By Ward</h3>
            {detail.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (detail.data?.by_ward ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-auto">
                {(detail.data?.by_ward ?? []).map((row) => (
                  <li key={row.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.name}</span>
                    <span className="font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">By Status</h3>
            {detail.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(detail.data?.by_status ?? []).map((row) => (
                  <Badge key={row.name} variant={statusBadgeVariant[row.name] ?? "outline"}>
                    {row.name.replace(/_/g, " ")}: {row.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">By Severity</h3>
            {detail.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(detail.data?.by_severity ?? []).map((row) => (
                  <Badge key={row.name} variant="outline" className="capitalize">
                    {row.name}: {row.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-semibold">By Visibility</h3>
            {detail.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {(detail.data?.by_visibility ?? []).map((row) => (
                  <Badge key={row.name} variant="outline" className="capitalize">
                    {row.name}: {row.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-4 font-semibold">By Authority</h3>
          {detail.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (detail.data?.by_authority ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(detail.data?.by_authority ?? []).map((row) => (
                <li key={row.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.name}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function AdminLayout({ children, onLogout }: { children: React.ReactNode; onLogout?: () => void }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-tight">JanFix</div>
            <div className="-mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Admin
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                activeProps={navLinkActiveProps}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6 md:hidden">
          <span className="font-display text-sm font-bold">Admin</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

