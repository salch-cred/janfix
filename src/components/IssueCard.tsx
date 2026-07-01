import { Link } from "@tanstack/react-router";
import { MapPin, ThumbsUp, MessageSquare, Eye, Flame } from "lucide-react";
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
  return (
    <Link
      to="/issue/$publicId/$slug"
      params={{ publicId: issue.public_id, slug }}
      className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {issue.image_url ? (
          <img
            src={issue.image_url}
            alt={issue.description}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
            No photo
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span
            className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
            style={{ background: issue.category?.color ?? "#334155" }}
          >
            {issue.category?.name_en ?? "Issue"}
          </span>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${severity.color}`}>
            {severity.label}
          </span>
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          <Flame className="h-3 w-3" /> {Math.round(issue.heat_score)}
        </div>
      </div>
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{issue.description}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">
            {[issue.area, issue.locality].filter(Boolean).join(", ") ||
              (issue.ward ? `Ward ${issue.ward.number} · ${issue.ward.name}` : "Mangaluru")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge variant="outline" className={`text-[10px] font-semibold ${status.color}`}>
            {status.label}
          </Badge>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <ThumbsUp className="h-3 w-3" /> {issue.supporters_count}
            </span>
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {issue.views}
            </span>
          </div>
        </div>
        {issue.authority && (
          <div className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
            {issue.authority.logo_url && (
              <img src={issue.authority.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
            )}
            <span className="truncate font-medium text-foreground">{issue.authority.name}</span>
            {issue.representative?.photo_url && (
              <img
                src={issue.representative.photo_url}
                alt=""
                className="ml-auto h-5 w-5 rounded-full object-cover ring-1 ring-muted"
              />
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
