import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listIssuesFn, listCategoriesFn, listWardsFn } from "@/lib/queries.functions";
import { adminUpdateIssueFn, adminDeleteIssueFn, adminGetIssueDetailFn } from "@/lib/admin.functions";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Search,
  Trash2,
  Eye,
  Pencil,
} from "lucide-react";

export const Route = createFileRoute("/admin/issues")({
  component: AdminIssues,
  ssr: false,
});

// Must match the `issue_status` Postgres enum exactly (see
// src/integrations/supabase/types.ts) or updates/filters will fail.
const STATUSES = [
  "reported",
  "community_verified",
  "assigned",
  "work_started",
  "resolved",
  "community_confirmed",
  "closed",
] as const;

const SEVERITIES = ["low", "medium", "high", "dangerous"] as const;
const VISIBILITIES = ["visible", "hidden", "duplicate", "spam"] as const;

const statusColors: Record<string, string> = {
  reported: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  community_verified: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  assigned: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  work_started: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  community_confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

function AdminIssues() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    issue: any;
    status: string;
    visibility: string;
    note: string;
    saving: boolean;
    error: string | null;
  }>({ open: false, issue: null, status: "", visibility: "", note: "", saving: false, error: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    issue: any;
    deleting: boolean;
    error: string | null;
  }>({ open: false, issue: null, deleting: false, error: null });

  const [viewDialog, setViewDialog] = useState<{
    open: boolean;
    loading: boolean;
    detail: any;
    error: string | null;
  }>({ open: false, loading: false, detail: null, error: null });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const openUpdateDialog = (issue: any) => {
    setUpdateDialog({
      open: true,
      issue,
      status: issue.status ?? "",
      visibility: issue.visibility ?? "",
      note: "",
      saving: false,
      error: null,
    });
  };

  const handleUpdate = async () => {
    if (!updateDialog.issue) return;
    setUpdateDialog((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminUpdateIssueFn({
        data: {
          access_token: token,
          issue_id: updateDialog.issue.id,
          status: (updateDialog.status || undefined) as any,
          visibility: (updateDialog.visibility || undefined) as any,
          note: updateDialog.note || undefined,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
      setUpdateDialog({
        open: false,
        issue: null,
        status: "",
        visibility: "",
        note: "",
        saving: false,
        error: null,
      });
    } catch (e: any) {
      console.error("Failed to update issue", e);
      setUpdateDialog((prev) => ({ ...prev, saving: false, error: e?.message || "Failed to update report" }));
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.issue) return;
    setDeleteDialog((prev) => ({ ...prev, deleting: true, error: null }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminDeleteIssueFn({
        data: {
          access_token: token,
          issue_id: deleteDialog.issue.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-issues"] });
      setDeleteDialog({ open: false, issue: null, deleting: false, error: null });
    } catch (e: any) {
      console.error("Failed to delete issue", e);
      setDeleteDialog((prev) => ({ ...prev, deleting: false, error: e?.message || "Failed to delete report" }));
    }
  };

  const openViewDialog = async (issue: any) => {
    setViewDialog({ open: true, loading: true, detail: null, error: null });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const detail = await adminGetIssueDetailFn({
        data: { access_token: token, issue_id: issue.id },
      });
      setViewDialog({ open: true, loading: false, detail, error: null });
    } catch (e: any) {
      console.error("Failed to load report details", e);
      setViewDialog({
        open: true,
        loading: false,
        detail: null,
        error: e?.message || "Failed to load report details",
      });
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
          <p className="text-sm text-muted-foreground">All reports submitted across JanFix Mangaluru</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="pl-9"
            />
          </div>

          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
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

          <Select value={severityFilter || "all"} onValueChange={(v) => setSeverityFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All categories" />
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

          <Select value={wardFilter || "all"} onValueChange={(v) => setWardFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wards</SelectItem>
              {(wards.data ?? []).map((w: any) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  Ward {w.number} - {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (issues.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No reports found
                  </TableCell>
                </TableRow>
              ) : (
                (issues.data ?? []).map((issue: any) => (
                  <TableRow key={issue.id}>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-medium">{issue.description}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {issue.address || issue.locality || issue.area || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{issue.category?.name_en ?? "—"}</TableCell>
                    <TableCell className="text-sm">{issue.ward ? `Ward ${issue.ward.number}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[issue.status] ?? ""}>
                        {String(issue.status ?? "").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{issue.severity ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openViewDialog(issue)} title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openUpdateDialog(issue)} title="Update">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialog({ open: true, issue, deleting: false, error: null })}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
        onOpenChange={(open) => setUpdateDialog((prev) => (prev.saving ? prev : { ...prev, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Report</DialogTitle>
            <DialogDescription>Change status, visibility, and add a note</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={updateDialog.status || "none"}
                  onValueChange={(v) => setUpdateDialog((prev) => ({ ...prev, status: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No change</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Visibility</label>
                <Select
                  value={updateDialog.visibility || "none"}
                  onValueChange={(v) =>
                    setUpdateDialog((prev) => ({ ...prev, visibility: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No change</SelectItem>
                    {VISIBILITIES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Note (added to status history)</label>
              <Textarea
                value={updateDialog.note}
                onChange={(e) => setUpdateDialog((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional note about this update..."
                rows={3}
              />
            </div>
            {updateDialog.error && <p className="text-sm text-destructive">{updateDialog.error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateDialog((prev) => ({ ...prev, open: false }))}
              disabled={updateDialog.saving}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateDialog.saving}>
              {updateDialog.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => (prev.deleting ? prev : { ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report
              {deleteDialog.issue ? `: "${String(deleteDialog.issue.description ?? "").slice(0, 80)}"` : ""}?
              This also removes its votes, comments, photos, and history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteDialog.error && <p className="text-sm text-destructive">{deleteDialog.error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDialog.deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteDialog.deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDialog.deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={viewDialog.open}
        onOpenChange={(open) =>
          setViewDialog((prev) => (open ? prev : { open: false, loading: false, detail: null, error: null }))
        }
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              {viewDialog.detail?.issue?.public_id
                ? `Full details for report ${viewDialog.detail.issue.public_id}`
                : "Loading report details..."}
            </DialogDescription>
          </DialogHeader>

          {viewDialog.loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : viewDialog.error ? (
            <p className="text-sm text-destructive">{viewDialog.error}</p>
          ) : viewDialog.detail ? (
            <div className="space-y-5 py-2 text-sm">
              <div>
                <p className="font-medium">{viewDialog.detail.issue.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className={statusColors[viewDialog.detail.issue.status] ?? ""}>
                    {String(viewDialog.detail.issue.status ?? "").replace("_", " ")}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {viewDialog.detail.issue.severity}
                  </Badge>
                  <Badge variant="outline">{viewDialog.detail.issue.visibility}</Badge>
                  {viewDialog.detail.issue.needs_review && <Badge variant="destructive">Needs Review</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 sm:grid-cols-6">
                <div>
                  <p className="text-xs text-muted-foreground">Exists</p>
                  <p className="font-semibold">{viewDialog.detail.votes.exists}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fixed</p>
                  <p className="font-semibold">{viewDialog.detail.votes.fixed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Supporters</p>
                  <p className="font-semibold">{viewDialog.detail.supporters}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Thanks</p>
                  <p className="font-semibold">{viewDialog.detail.thanks}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Watchers</p>
                  <p className="font-semibold">{viewDialog.detail.watchers}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Views</p>
                  <p className="font-semibold">{viewDialog.detail.issue.views ?? 0}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Location</p>
                <p>
                  {viewDialog.detail.issue.address ||
                    viewDialog.detail.issue.locality ||
                    viewDialog.detail.issue.area ||
                    "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {viewDialog.detail.issue.lat}, {viewDialog.detail.issue.lng}
                  {viewDialog.detail.issue.pincode ? ` · PIN ${viewDialog.detail.issue.pincode}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Reporter device</p>
                  <p className="font-mono text-xs">{viewDialog.detail.issue.device_id ?? "—"}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Assigned to</p>
                  <p className="text-xs">
                    {viewDialog.detail.issue.authority?.name ?? "—"}
                    {viewDialog.detail.issue.representative?.name
                      ? ` · ${viewDialog.detail.issue.representative.name}`
                      : ""}
                  </p>
                </div>
              </div>

              {(viewDialog.detail.photos ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {viewDialog.detail.photos.map((p: any) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                        <img src={p.url} className="h-24 w-full rounded-md object-cover" alt="" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status history</p>
                <div className="space-y-2">
                  {(viewDialog.detail.history ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No status changes recorded</p>
                  ) : (
                    viewDialog.detail.history.map((h: any) => (
                      <div key={h.id} className="rounded-md border p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{h.status ? h.status.replace("_", " ") : "Note"}</span>
                          <span className="text-muted-foreground">
                            {h.created_at ? new Date(h.created_at).toLocaleString() : ""}
                          </span>
                        </div>
                        {h.note && <p className="mt-1 text-muted-foreground">{h.note}</p>}
                        <p className="mt-1 text-muted-foreground">{h.by_admin ? "By admin" : "By citizen"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {(viewDialog.detail.official ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Official updates</p>
                  <div className="space-y-2">
                    {viewDialog.detail.official.map((o: any) => (
                      <div key={o.id} className="rounded-md border p-2 text-xs">
                        <p>{o.body}</p>
                        <p className="mt-1 text-muted-foreground">
                          {o.created_at ? new Date(o.created_at).toLocaleString() : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Comments ({(viewDialog.detail.comments ?? []).length})
                </p>
                <div className="space-y-2">
                  {(viewDialog.detail.comments ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments</p>
                  ) : (
                    viewDialog.detail.comments.map((cm: any) => (
                      <div key={cm.id} className="rounded-md border p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {cm.quick_reply ? String(cm.quick_reply).replace("_", " ") : "Comment"}
                          </span>
                          <span className="text-muted-foreground">
                            {cm.created_at ? new Date(cm.created_at).toLocaleString() : ""}
                          </span>
                        </div>
                        <p className="mt-1">{cm.body}</p>
                        {cm.hidden && (
                          <Badge variant="outline" className="mt-1">
                            Hidden
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialog({ open: false, loading: false, detail: null, error: null })}
            >
              Close
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
  { to: "/admin/devices", label: "Reporters", icon: Smartphone },
  { to: "/admin/authorities", label: "Authorities", icon: Building2 },
  { to: "/admin/representatives", label: "Representatives", icon: Users },
  { to: "/admin/wards", label: "Wards", icon: Map },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/rules", label: "Rules", icon: GitBranch },
  { to: "/admin/jurisdiction", label: "Jurisdiction", icon: Compass },
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
