import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminListFeedbackFn, adminMarkFeedbackReadFn, adminDeleteFeedbackFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
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
  Inbox,
  Trash2,
  Mail as MailIcon,
  CheckCheck,
} from "lucide-react";

export const Route = createFileRoute("/admin/feedback")({
  component: AdminFeedback,
  ssr: false,
});

function AdminFeedback() {
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

  const feedback = useQuery({
    queryKey: ["admin-feedback", session?.access_token],
    queryFn: () => adminListFeedbackFn({ data: { access_token: session.access_token } }),
    enabled: !!session?.access_token,
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
    deleting: boolean;
    error: string | null;
  }>({ open: false, id: null, deleting: false, error: null });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const toggleRead = async (row: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      await adminMarkFeedbackReadFn({
        data: { access_token: token, id: row.id, read: !row.read_at },
      });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
    } catch (e: any) {
      console.error("Failed to update feedback", e);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    setDeleteDialog((prev) => ({ ...prev, deleting: true, error: null }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      await adminDeleteFeedbackFn({ data: { access_token: token, id: deleteDialog.id } });
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      setDeleteDialog({ open: false, id: null, deleting: false, error: null });
    } catch (e: any) {
      console.error("Failed to delete feedback", e);
      setDeleteDialog((prev) => ({
        ...prev,
        deleting: false,
        error: e?.message || "Failed to delete feedback.",
      }));
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rows = feedback.data ?? [];
  const unreadCount = rows.filter((r: any) => !r.read_at).length;

  return (
    <AdminLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Messages citizens submitted through the site footer
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No feedback submitted yet
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any) => (
                  <TableRow key={row.id} className={!row.read_at ? "bg-primary/[0.03]" : ""}>
                    <TableCell className="max-w-[160px]">
                      <p className="truncate font-medium">{row.name || "Anonymous"}</p>
                      {row.email && (
                        <a
                          href={`mailto:${row.email}`}
                          className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                        >
                          <MailIcon className="h-3 w-3" /> {row.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <p className="whitespace-pre-wrap text-sm">{row.message}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.page_url || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.read_at ? "outline" : "secondary"}>
                        {row.read_at ? "Read" : "New"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleRead(row)}
                          title={row.read_at ? "Mark as unread" : "Mark as read"}
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialog({ open: true, id: row.id, deleting: false, error: null })}
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

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => (prev.deleting ? prev : { ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback message? This action cannot be undone.
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
