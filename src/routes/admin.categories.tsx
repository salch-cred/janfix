import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAdminSession } from "@/hooks/useAdminSession";
import { listCategoriesFn } from "@/lib/queries.functions";
import { adminUpsertCategoryFn, adminDeleteCategoryFn } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
  ssr: false,
});

const emptyForm = {
  slug: "",
  name_en: "",
  name_kn: "",
  icon: "",
  color: "",
  sort_order: "",
};

function swatchStyle(color: string): React.CSSProperties {
  return { backgroundColor: color };
}

function AdminCategories() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token: session, checking, logout } = useAdminSession();


  const categories = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => listCategoriesFn(),
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

  const handleLogout = logout;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditingId(cat.id);
    setForm({
      slug: cat.slug ?? "",
      name_en: cat.name_en ?? "",
      name_kn: cat.name_kn ?? "",
      icon: cat.icon ?? "",
      color: cat.color ?? "",
      sort_order: cat.sort_order != null ? String(cat.sort_order) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name_en.trim() || !form.slug.trim()) return;
    setSaving(true);
    try {
      if (!session) throw new Error("Not authenticated");
      const token = session;

      await adminUpsertCategoryFn({
        data: {
          access_token: token,
          ...(editingId ? { id: editingId } : {}),
          slug: form.slug.trim(),
          name_en: form.name_en.trim(),
          name_kn: form.name_kn || null,
          icon: form.icon || null,
          color: form.color || null,
          sort_order: form.sort_order ? Number(form.sort_order) : null,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (e: any) {
      console.error("Failed to save category", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    setDeleteDialog((prev) => ({ ...prev, deleting: true, error: null }));
    try {
      if (!session) throw new Error("Not authenticated");
      const token = session;

      await adminDeleteCategoryFn({
        data: {
          access_token: token,
          id: deleteDialog.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteDialog({ open: false, id: null, name: "", deleting: false, error: null });
    } catch (e: any) {
      console.error("Failed to delete category", e);
      setDeleteDialog((prev) => ({
        ...prev,
        deleting: false,
        error:
          e?.message ||
          "Failed to delete category. It may still have reports or rules assigned to it.",
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
            <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
            <p className="text-sm text-muted-foreground">Manage issue categories</p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name (EN)</TableHead>
                <TableHead>Name (KN)</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Icon</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (categories.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No categories found
                  </TableCell>
                </TableRow>
              ) : (
                (categories.data ?? []).map((cat: any) => (
                  <TableRow key={cat.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.sort_order ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">{cat.name_en}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.name_kn ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cat.slug}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.icon ?? "—"}
                    </TableCell>
                    <TableCell>
                      {cat.color ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className="h-3 w-3 rounded-full border"
                            style={swatchStyle(cat.color)}
                          />
                          {cat.color}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              id: cat.id,
                              name: cat.name_en,
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
            <DialogTitle>{editingId ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the category details"
                : "Fill in the details to add a new category"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Name (English) <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  placeholder="Potholes"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Name (Kannada)</label>
                <Input
                  value={form.name_kn}
                  onChange={(e) => setForm((f) => ({ ...f, name_kn: e.target.value }))}
                  placeholder="..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Slug <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="potholes"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Icon</label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="road"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#f97316"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name_en.trim() || !form.slug.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Category"}
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
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
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


