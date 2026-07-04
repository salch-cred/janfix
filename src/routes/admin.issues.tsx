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

  const [updateDialog, setUpdateDialog] = useState<{
    open: boolean;
    issue: any;
