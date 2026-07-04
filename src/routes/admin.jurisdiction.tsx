import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listCategoriesFn, listAuthoritiesFn, listTaluksFn } from "@/lib/queries.functions";
import {
  adminListJurisdictionRulesFn,
  adminUpsertJurisdictionRuleFn,
  adminDeleteJurisdictionRuleFn,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Smartphone,
  Building2,
  Users,
  Map,
  Tags,
  GitBranch,
  Compass,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/admin/jurisdiction")({
  component: AdminJurisdiction,
  ssr: false,
});

const SCOPE_TYPES = ["mcc", "rural", "state_highway", "national_highway", "any"];
const CONFIDENCE_LEVELS = ["high", "medium", "low"];

const scopeLabels: Record<string, string> = {
  mcc: "MCC (City)",
  rural: "Rural / Gram Panchayat",
  state_highway: "State Highway",
  national_highway: "National Highway",
  any: "Any",
};

const emptyForm = {
  category_id: "",
  scope_type: "mcc",
  taluk_id: "none",
  authority_id: "none",
  confidence: "high",
  notes: "",
  priority: "0",
  active: true,
};

function AdminJurisdiction() {
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

  const rules = useQuery({
    queryKey: ["admin-jurisdiction-rules", session?.access_token],
    queryFn: () => adminListJurisdictionRulesFn({ data: { access_token: session.access_token } }),
    enabled: !!session?.access_token,
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategoriesFn(),
  });

  const authorities = useQuery({
    queryKey: ["authorities"],
    queryFn: () => listAuthoritiesFn(),
  });

  const taluks = useQuery({
    queryKey: ["taluks"],
    queryFn: () => listTaluksFn(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: number | null;
    label: string;
    deleting: boolean;
    error: string | null;
  }>({ open: false, id: null, label: "", deleting: false, error: null });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditingId(rule.id);
    setForm({
      category_id: rule.category_id ? String(rule.category_id) : "",
      scope_type: rule.scope_type ?? "mcc",
      taluk_id: rule.taluk_id ? String(rule.taluk_id) : "none",
      authority_id: rule.authority_id ? String(rule.authority_id) : "none",
      confidence: rule.confidence ?? "high",
      notes: rule.notes ?? "",
      priority: rule.priority != null ? String(rule.priority) : "0",
      active: rule.active ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category_id || !form.scope_type) return;
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      await adminUpsertJurisdictionRuleFn({
        data: {
          access_token: token,
          ...(editingId ? { id: editingId } : {}),
          category_id: Number(form.category_id),
          scope_type: form.scope_type as any,
          taluk_id: form.taluk_id === "none" ? null : Number(form.taluk_id),
          authority_id: form.authority_id === "none" ? null : Number(form.authority_id),
          confidence: form.confidence as any,
          notes: form.notes || null,
          priority: form.priority ? Number(form.priority) : 0,
          active: form.active,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-jurisdiction-rules"] });
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (e: any) {
      console.error("Failed to save jurisdiction rule", e);
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

      await adminDeleteJurisdictionRuleFn({
        data: {
          access_token: token,
          id: deleteDialog.id,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-jurisdiction-rules"] });
      setDeleteDialog({ open: false, id: null, label: "", deleting: false, error: null });
    } catch (e: any) {
      console.error("Failed to delete jurisdiction rule", e);
      setDeleteDialog((prev) => ({
        ...prev,
        deleting: false,
        error: e?.message || "Failed to delete jurisdiction rule.",
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
            <h1 className="text-2xl font-bold tracking-tight">Jurisdiction Rules</h1>
            <p className="text-sm text-muted-foreground">
              Fallback routing by category and scope (city / rural / highways) when no
              ward-specific assignment rule matches
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Taluk</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (rules.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                    No jurisdiction rules found
                  </TableCell>
                </TableRow>
              ) : (
                (rules.data ?? []).map((rule: any) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.category?.name_en ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {scopeLabels[rule.scope_type] ?? rule.scope_type}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rule.taluk?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rule.authority?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {rule.confidence ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rule.priority ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.active ? "secondary" : "outline"}>
                        {rule.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              id: rule.id,
                              label: `${rule.category?.name_en ?? "rule"} → ${scopeLabels[rule.scope_type] ?? rule.scope_type}`,
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
            <DialogTitle>{editingId ? "Edit Jurisdiction Rule" : "Add Jurisdiction Rule"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this fallback routing rule"
                : "Define a fallback routing rule by category and scope"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Category <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Scope <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.scope_type}
                onValueChange={(v) => setForm((f) => ({ ...f, scope_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {scopeLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Taluk</label>
              <Select
                value={form.taluk_id}
                onValueChange={(v) => setForm((f) => ({ ...f, taluk_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any taluk</SelectItem>
                  {(taluks.data ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Confidence</label>
                <Select
                  value={form.confidence}
                  onValueChange={(v) => setForm((f) => ({ ...f, confidence: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCE_LEVELS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Reasoning or source for this rule..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="jr-active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, active: checked === true }))
                }
              />
              <label htmlFor="jr-active" className="text-sm font-medium">
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
              disabled={saving || !form.category_id || !form.scope_type}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Rule"}
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
            <AlertDialogTitle>Delete Jurisdiction Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rule (<strong>{deleteDialog.label}</strong>)?
              This action cannot be undone.
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
