import { Link } from "@tanstack/react-router";
import { MapPin, ThumbsUp, Eye, Flame, AlertCircle } from "lucide-react";
import { STATUS_META, SEVERITY_META, slugify } from "@/lib/civic";
import { Badge } from "@/components/ui/badge";

export type IssueCardData = {
  public_id: string;
  slug: string | null;
  description: string;
  severity: keyof typeof SEVERITY_META;
  status: keyof typeof STATUS_META;
  area: string | null;
  locality: string | null;
  image_url: string | null;
  supporters_count: number;
  thanked_count: number;
  views: number;
  heat_score: number;
  created_at: string;
  category: { name_en: string; slug: string; color: string | null } | null;
  authority?: { name: string; logo_url: string | null } | null;
  representative?: { name: string; role: string; photo_url: string | null } | null;
  ward?: { number: number; name: string } | null;
};

export function IssueCard({ issue }: { issue: IssueCardData }) {
  const status = STATUS_META[issue.status] ?? STATUS_META.reported;
  const severity = SEVERITY_META[issue.severity] ?? SEVERITY_META.medium;
  const slug = issue.slug || slugify(issue.description);
  const issueLinkParams = { publicId: issue.public_id, slug };
  const categoryBadgeStyle = { background: issue.category?.color ?? "#64748b" };
  const score = Math.round(issue.heat_score ?? 0);

  return (
    <Link
      to="/issue/$publicId/$slug"
      params={issueLinkParams}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {issue.image_url ? (
          <img
            src={issue.image_url}
            alt={issue.description}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-muted-foreground gap-2">
            <AlertCircle className="h-8 w-8 opacity-40 text-slate-500" />
            <span className="text-xs font-semibold tracking-wider uppercase opacity-60">No Photo Attached</span>
          </div>
        )}
        
        {/* Category & Severity Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 z-10">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm"
            style={categoryBadgeStyle}
          >
            {issue.category?.name_en ?? "Issue"}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${severity.color} shadow-sm`}>
            {severity.label}
          </span>
        </div>

        {/* Heat Score Flame Badge */}
        <div className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black text-white backdrop-blur shadow-sm transition-transform duration-300 group-hover:scale-105 ${
          score >= 70 ? "bg-red-600/90" : score >= 40 ? "bg-amber-500/90" : "bg-slate-900/60"
        }`}>
          <Flame className={`h-3.5 w-3.5 ${score >= 40 ? "animate-pulse" : ""}`} /> {score}
        </div>
      </div>
      
      <div className="space-y-3.5 p-4.5">
        <p className="line-clamp-2 text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">
          {issue.description}
        </p>
        
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary opacity-80" />
          <span className="truncate font-medium">
            {[issue.area, issue.locality].filter(Boolean).join(", ") ||
              (issue.ward ? `Ward ${issue.ward.number} · ${issue.ward.name}` : "Mangaluru")}
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className={`text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 ${status.color}`}>
            {status.label}
          </Badge>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
            <span className="flex items-center gap-1 hover:text-primary transition-colors">
              <ThumbsUp className="h-3.5 w-3.5" /> {issue.supporters_count}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {issue.views}
            </span>
          </div>
        </div>

        {/* Authority and Rep footer cards */}
        {issue.authority && (
          <div className="flex items-center gap-2 border-t pt-3 mt-1.5 text-xs text-muted-foreground">
            {issue.authority.logo_url && (
              <img src={issue.authority.logo_url} alt="" className="h-5.5 w-5.5 rounded-full object-cover border shadow-sm" />
            )}
            <span className="truncate font-bold text-slate-700 dark:text-slate-200">{issue.authority.name}</span>
            {issue.representative?.photo_url && (
              <div className="ml-auto flex items-center" title={`${issue.representative.name} (${issue.representative.role})`}>
                <img
                  src={issue.representative.photo_url}
                  alt={issue.representative.name}
                  className="h-5.5 w-5.5 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
