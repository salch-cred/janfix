import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listWardsFn, listAuthoritiesFn } from "@/lib/queries.functions";
import {
  adminListRepresentativesFn,
  adminUpsertRepresentativeFn,
  adminDeleteRepresentativeFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Building2,
  Users,
  Map,
  Tags,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/admin/representatives")({
  component: AdminRepresentatives,
  ssr: false,
});

const emptyForm = {
  name: "",
  role: "",
  phone: "",
  email: "",
  photo_url: "",
  constituency: "",
  city: "",
  ward_id: "none",
  authority_id: "none",
  active: true,
};

function AdminRepresentatives() {
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

  const representatives = useQuery({
    queryKey: ["admin-representatives", session?.access_token],
    queryFn: () => adminListRepresentativesFn({ data: { access_token: session.access_token } }),
    enabled: !!session?.access_token,
  });

  const wards = useQuery({
    queryKey: ["wards"],
    queryFn: () => listWardsFn(),
  });

  const authorities = useQuery({
    queryKey: ["authorities"],
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

  const openEdit = (rep: any) => {
    setEditingId(rep.id);
    setForm({
      name: rep.name ?? "",
      role: rep.role ?? "",
      phone: rep.phone ?? "",
      email: rep.email ?? "",
      photo_url: rep.photo_url ?? "",
      constituency: rep.constituency ?? "",
      city: rep.city ?? "",
      ward_id: rep.ward_id ? String(rep.ward_id) : "none",
      authority_id: rep.authority_id ? String(rep.authority_id) : "none",
      active: rep.active ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.role.trim()) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminUpsertRepresentativeFn({
        data: {
          access_token: token,
          ...(editingId ? { id: editingId } : {}),
          name: form.name.trim(),
          role: form.role.trim(),
          phone: form.phone || null,
          email: form.email || null,
          photo_url: form.photo_url || null,
          constituency: form.constituency || null,
          city: form.city || null,
          ward_id: form.ward_id === "none" ? null : Number(form.ward_id),
          authority_id: form.authority_id === "none" ? null : Number(form.authority_id),
          active: form.active,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-representatives"] });
      queryClient.invalidateQueries({ queryKey: ["representatives"] });
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (e: any) {
      console.error("Failed to save representative", e);
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

      await adminDeleteRepresentativeFn({
        data: {
          access_token: token,
          id: deleteDialog.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-representatives"] });
      queryClient.invalidateQueries({ queryKey: ["representatives"] });
      setDeleteDialog({ open: false, id: null, name: "", deleting: false, error: null });
    } catch (e: any) {
      console.error("Failed to delete representative", e);
      setDeleteDialog((prev) => ({
        ...prev,
        deleting: false,
        error:
          e?.message ||
          "Failed to delete representative. They may still be assigned to reports or rules.",
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
            <h1 className="text-2xl font-bold tracking-tight">Representatives</h1>
            <p className="text-sm text-muted-foreground">
              Manage elected representatives and officials
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Representative
          </Button>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {representatives.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (representatives.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No representatives found
                  </TableCell>
                </TableRow>
              ) : (
                (representatives.data ?? []).map((rep: any) => (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">{rep.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rep.role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rep.ward ? `Ward ${rep.ward.number}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rep.authority?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{rep.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={rep.active ? "secondary" : "outline"}>
                        {rep.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rep)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              id: rep.id,
                              name: rep.name,
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
            <DialogTitle>{editingId ? "Edit Representative" : "Add Representative"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the representative's details"
                : "Fill in the details to add a new representative"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Role <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="MLA"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contact@..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Photo URL</label>
              <Input
                value={form.photo_url}
                onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Constituency</label>
                <Input
                  value={form.constituency}
                  onChange={(e) => setForm((f) => ({ ...f, constituency: e.target.value }))}
                  placeholder="Mangalore"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Mangaluru"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ward</label>
                <Select
                  value={form.ward_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, ward_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No ward</SelectItem>
                    {(wards.data ?? []).map((w: any) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        Ward {w.number} - {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Authority</label>
                <Select
                  value={form.authority_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, authority_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No authority</SelectItem>
                    {(authorities.data ?? []).map((a: any) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rep-active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, active: checked === true }))
                }
              />
              <label htmlFor="rep-active" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.role.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Representative"}
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
            <AlertDialogTitle>Delete Representative</AlertDialogTitle>
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
  { to: "/admin/authorities", label: "Authorities", icon: Building2 },
  { to: "/admin/representatives", label: "Representatives", icon: Users },
  { to: "/admin/wards", label: "Wards", icon: Map },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/rules", label: "Rules", icon: GitBranch },
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
