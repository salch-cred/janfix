import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listIssuesFn, listCategoriesFn, listWardsFn } from "@/lib/queries.functions";
import { adminUpdateIssueFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  LogOut,
  Shield,
  LayoutDashboard,
  FolderKanban,
  Building2,
  Users,
  Map,
  Tags,
  GitBranch,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/admin/issues")({
  component: AdminIssues,
  ssr: false,
});

const STATUSES = [
  "reported",
  "verified",
  "assigned",
  "in_progress",
  "resolved",
  "community_confirmed",
  "closed",
] as const;

const statusColors: Record<string, string> = {
  reported: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  verified: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  assigned: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  in_progress: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  community_confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

function AdminIssues() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        navigate({ to: "/auth" });
      } else {
        setSession(s);
        setChecking(false);
      }
    });
  }, [navigate]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [wardFilter, setWardFilter] = useState("");

  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    issue: any;
    newStatus: string;
    note: string;
    updating: boolean;
  }>({ open: false, issue: null, newStatus: "", note: "", updating: false });

  const issues = useQuery({
    queryKey: ["admin-issues", search, statusFilter, severityFilter, categoryFilter, wardFilter],
    queryFn: () =>
      listIssuesFn({
        data: {
          q: search || undefined,
          status: statusFilter || undefined,
          severity: severityFilter || undefined,
          category_slug: categoryFilter || undefined,
          ward_id: wardFilter ? Number(wardFilter) : undefined,
          limit: 100,
        },
      }),
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategoriesFn(),
  });

  const wards = useQuery({
    queryKey: ["wards"],
    queryFn: () => listWardsFn(),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const openUpdateDialog = (issue: any) => {
    setUpdateDialog({
      open: true,
      issue,
      newStatus: issue.status,
      note: "",
      updating: false,
    });
  };

  const handleUpdateStatus = async () => {
    if (!updateDialog.issue || !updateDialog.newStatus) return;
    setUpdateDialog((prev) => ({ ...prev, updating: true }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminUpdateIssueFn({
        data: {
          access_token: token,
          issue_id: updateDialog.issue.id,
          status: updateDialog.newStatus,
          note: updateDialog.note || null,
        },
      });

      issues.refetch();
      setUpdateDialog({
        open: false,
        issue: null,
        newStatus: "",
        note: "",
        updating: false,
      });
    } catch (e: any) {
      setUpdateDialog((prev) => ({ ...prev, updating: false }));
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground">Manage reported civic issues</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, keyword, area..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={wardFilter} onValueChange={setWardFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Ward" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wards</SelectItem>
              {(wards.data ?? []).map((w: any) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  Ward {w.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (issues.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                    No issues found
                  </TableCell>
                </TableRow>
              ) : (
                (issues.data ?? []).map((issue: any) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {issue.public_id}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="truncate text-sm">{issue.description}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[issue.status] ?? ""}>
                        {issue.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-semibold ${
                          issue.severity === "critical"
                            ? "text-destructive"
                            : issue.severity === "high"
                              ? "text-orange-500"
                              : issue.severity === "medium"
                                ? "text-amber-500"
                                : "text-muted-foreground"
                        }`}
                      >
                        {issue.severity}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{issue.category?.name_en ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {issue.ward ? `Ward ${issue.ward.number}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openUpdateDialog(issue)}>
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={updateDialog.open}
        onOpenChange={(open) => setUpdateDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>
              {updateDialog.issue?.public_id
                ? `Updating ${updateDialog.issue.public_id}`
                : "Update issue status and add a note"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select
                value={updateDialog.newStatus}
                onValueChange={(v) => setUpdateDialog((prev) => ({ ...prev, newStatus: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                value={updateDialog.note}
                onChange={(e) =>
                  setUpdateDialog((prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
                placeholder="Add an internal note about this change..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setUpdateDialog({
                  open: false,
                  issue: null,
                  newStatus: "",
                  note: "",
                  updating: false,
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updateDialog.updating}>
              {updateDialog.updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/issues", label: "Issues", icon: FolderKanban },
  { to: "/admin/authorities", label: "Authorities", icon: Building2 },
  { to: "/admin/representatives", label: "Representatives", icon: Users },
  { to: "/admin/wards", label: "Wards", icon: Map },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/rules", label: "Rules", icon: GitBranch },
];

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
                activeProps= className: "bg-accent text-foreground" 
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
