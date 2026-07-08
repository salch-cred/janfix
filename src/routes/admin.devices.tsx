import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAdminSession } from "@/hooks/useAdminSession";
import { adminListDevicesFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  LogOut,
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
  Search,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/admin/devices")({
  component: AdminDevices,
  ssr: false,
});

function AdminDevices() {
  const navigate = useNavigate();
  const { token: session, checking, logout } = useAdminSession();
  const [search, setSearch] = useState("");


  const devices = useQuery({
    queryKey: ["admin-devices", session, search],
    queryFn: () =>
      adminListDevicesFn({
        data: { access_token: session, q: search || undefined, limit: 200 },
      }),
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

  return (
    <AdminLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reporters</h1>
          <p className="text-sm text-muted-foreground">
            Activity for each anonymous reporting device. JanFix does not collect citizen
            accounts, so reporters are tracked only by an on-device ID.
          </p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search device ID..."
            className="pl-9"
          />
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Reports</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Votes</TableHead>
                <TableHead>Thanks</TableHead>
                <TableHead>Supporters</TableHead>
                <TableHead>Comments</TableHead>
                <TableHead>Trust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (devices.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">
                    No reporting devices found
                  </TableCell>
                </TableRow>
              ) : (
                (devices.data ?? []).map((d: any) => (
                  <TableRow key={d.device_id}>
                    <TableCell className="font-mono text-xs">{d.device_id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {d.first_seen ? new Date(d.first_seen).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {d.last_seen ? new Date(d.last_seen).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{d.reports_total ?? 0}</TableCell>
                    <TableCell className="text-sm">{d.reports_resolved ?? 0}</TableCell>
                    <TableCell className="text-sm">{d.votes_cast ?? 0}</TableCell>
                    <TableCell className="text-sm">{d.thanks_given ?? 0}</TableCell>
                    <TableCell className="text-sm">{d.supporters_given ?? 0}</TableCell>
                    <TableCell className="text-sm">{d.comments_posted ?? 0}</TableCell>
                    <TableCell>
                      {d.trusted_at ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Trusted
                        </Badge>
                      ) : (
                        <Badge variant="outline">Untrusted</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

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

