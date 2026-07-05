import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAuthoritiesFn } from "@/lib/queries.functions";
import { adminUpsertAuthorityFn, adminDeleteAuthorityFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AuthorityLogo } from "@/components/AuthorityLogo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Inbox,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/admin/authorities")({
  component: AdminAuthorities,
  ssr: false,
});

const emptyForm = {
  name: "",
  type: "",
  department: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  jurisdiction: "",
  logo_url: "",
};

function AdminAuthorities() {
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

  const authorities = useQuery({
    queryKey: ["admin-authorities"],
    queryFn: () => listAuthoritiesFn(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: number | null;
    name: string;
    deleting: boolean;
    error: string | null;
  }>({ open: false, id: null, name: "", deleting: false, error: null });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (auth: any) => {
    setEditingId(auth.id);
    setForm({
      name: auth.name ?? "",
      type: auth.type ?? "",
      department: auth.department ?? "",
      phone: auth.phone ?? "",
      email: auth.email ?? "",
      website: auth.website ?? "",
      address: auth.address ?? "",
      jurisdiction: auth.jurisdiction ?? "",
      logo_url: auth.logo_url ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminUpsertAuthorityFn({
        data: {
          access_token: token,
          ...(editingId ? { id: editingId } : {}),
          name: form.name.trim(),
          type: form.type || null,
          department: form.department || null,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          address: form.address || null,
          jurisdiction: form.jurisdiction || null,
          logo_url: form.logo_url || null,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-authorities"] });
      queryClient.invalidateQueries({ queryKey: ["authorities"] });
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (e: any) {
      console.error("Failed to save authority", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    setDeleteDialog((prev) => ({ ...prev, deleting: true, error: null }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminDeleteAuthorityFn({
        data: {
          access_token: token,
          id: deleteDialog.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-authorities"] });
      queryClient.invalidateQueries({ queryKey: ["authorities"] });
      setDeleteDialog({ open: false, id: null, name: "", deleting: false, error: null });
    } catch (e: any) {
      console.error("Failed to delete authority", e);
      setDeleteDialog((prev) => ({
        ...prev,
        deleting: false,
        error:
          e?.message ||
          "Failed to delete authority. It may still have reports or rules assigned to it.",
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

  return (
    <AdminLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Authorities</h1>
            <p className="text-sm text-muted-foreground">
              Manage civic authorities and departments
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Authority
          </Button>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {authorities.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (authorities.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No authorities found
                  </TableCell>
                </TableRow>
              ) : (
                (authorities.data ?? []).map((auth: any) => (
                  <TableRow key={auth.id}>
                    <TableCell>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 overflow-hidden font-bold text-primary">
                        <AuthorityLogo url={auth.logo_url} className="h-full w-full object-contain p-1" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{auth.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {auth.type ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {auth.department ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{auth.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm">{auth.email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(auth)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              id: auth.id,
                              name: auth.name,
                              deleting: false,
                              error: null,
                            })
                          }
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Authority" : "Add Authority"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the authority details"
                : "Fill in the details to add a new authority"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mangaluru City Corporation"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Input
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  placeholder="Municipal"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder="Public Works"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 824 222 0000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contact@mcc.gov.in"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Website</label>
              <Input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Full address..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jurisdiction</label>
                <Input
                  value={form.jurisdiction}
                  onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                  placeholder="Mangaluru City"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Logo URL</label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Authority"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog((prev) => (prev.deleting ? prev : { ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Authority</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteDialog.error && (
            <p className="text-sm text-destructive">{deleteDialog.error}</p>
          )}
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
