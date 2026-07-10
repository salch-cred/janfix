import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, Activity, Monitor, Smartphone, Globe, AlertCircle } from "lucide-react";
import { adminSessionAnalyticsFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/visitors")({
  component: AdminVisitorsPage,
});

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AdminVisitorsPage() {
  const token = localStorage.getItem("admin_token") || "";

  const analyticsQuery = useQuery({
    queryKey: ["admin-session-analytics"],
    queryFn: () => adminSessionAnalyticsFn({ data: { access_token: token } }),
    refetchInterval: 10000, // Refetch every 10 seconds to see live online status
  });

  if (analyticsQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading analytics...</div>;
  }

  if (analyticsQuery.isError) {
    return (
      <div className="p-8 text-center text-red-500 flex flex-col items-center gap-2">
        <AlertCircle className="w-8 h-8" />
        <p>Failed to load visitor analytics.</p>
      </div>
    );
  }

  const data = analyticsQuery.data;
  if (!data) return null;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visitor Analytics</h1>
        <p className="text-muted-foreground mt-1">Real-time session tracking and device metrics.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Online Now</h3>
            <Activity className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-3xl font-bold">{data.onlineNow}</div>
          <p className="text-xs text-muted-foreground mt-1">Active in last 90 seconds</p>
        </div>
        
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Avg Session Time</h3>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold">{formatDuration(data.avgSessionSeconds)}</div>
          <p className="text-xs text-muted-foreground mt-1">Average time spent per user</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Today's Visitors</h3>
            <Users className="h-4 w-4 text-orange-500" />
          </div>
          <div className="text-3xl font-bold">
            {data.dailyVisitors.length > 0 ? data.dailyVisitors[data.dailyVisitors.length - 1].count : 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Unique devices today</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-row items-center justify-between pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Total Sessions</h3>
            <Globe className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold">{data.sessions.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Recorded in database</p>
        </div>
      </div>

      {/* Live Sessions Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">User Sessions (Live)</h2>
          <p className="text-sm text-muted-foreground">Detailed list of how many users are staying on the website, checked device info, and online status.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Device ID</th>
                <th className="px-6 py-4">Platform</th>
                <th className="px-6 py-4">Time Spent</th>
                <th className="px-6 py-4">Pages Visited</th>
                <th className="px-6 py-4">Last Seen</th>
                <th className="px-6 py-4">Session Start</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.sessions.map((session, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    {session.currently_online ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        Offline
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {session.device_id.substring(0, 12)}...
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {session.platform === "iOS" || session.platform === "Android" ? (
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{session.platform}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {formatDuration(session.duration_seconds)}
                  </td>
                  <td className="px-6 py-4">
                    {session.pages_visited} pages
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {session.currently_online ? "Just now" : timeAgo(session.session_end)}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(session.session_start).toLocaleDateString()} {new Date(session.session_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {data.sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No sessions recorded yet. Open the app in a new tab to see it here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
