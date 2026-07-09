import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listIssuesFn, listWardsFn } from "@/lib/queries.functions";
import { AppShell } from "@/components/AppShell";
import { IssueCard } from "@/components/IssueCard";
import { IssueMap } from "@/components/IssueMap";
import { CATEGORIES, STATUS_META, SEVERITY_META, categoryBySlug, slugify } from "@/lib/civic";
import { Input } from "@/components/ui/input";
import { Search, Map as MapIcon, List } from "lucide-react";

export const Route = createFileRoute("/explore")({
  component: Explore,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
});

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function Explore() {
  const [view, setView] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<"recent" | "heat">("heat");
  const [cat, setCat] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [sev, setSev] = useState<string>("");
  const [wardId, setWardId] = useState<number | undefined>();
  const [searchVal, setSearchVal] = useState<string>("");
  const [q, setQ] = useState<string>("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setQ(searchVal);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  const wards = useQuery({ queryKey: ["wards"], queryFn: () => listWardsFn() });
  const issues = useQuery({
    queryKey: ["issues", sort, cat, status, sev, wardId, q],
    queryFn: () =>
      listIssuesFn({
        data: {
          sort,
          category_slug: cat || undefined,
          status: status || undefined,
          severity: sev || undefined,
          ward_id: wardId,
          q: q || undefined,
          limit: 60,
        },
      }),
  });

  const mapPoints = useMemo(
    () =>
      (issues.data ?? []).map((i: any) => {
        const c = i.category ?? categoryBySlug("others");
        const color = c.color ?? "#1d4ed8";
        const statusMeta =
          STATUS_META[i.status as keyof typeof STATUS_META] ?? STATUS_META.reported;
        const slug = i.slug || slugify(i.description ?? "");
        const href = `/issue/${encodeURIComponent(i.public_id)}/${encodeURIComponent(slug)}`;
        const description = String(i.description ?? "");
        const shortDescription =
          description.length > 90 ? `${description.slice(0, 90)}…` : description;
        const thumb = i.image_url
          ? `<img src="${escapeHtml(i.image_url)}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:6px;" />`
          : "";
        return {
          id: i.id,
          lat: i.lat,
          lng: i.lng,
          color,
          popup: `
            <div style="min-width:180px;max-width:220px;font-family:Inter,sans-serif;">
              ${thumb}
              <div style="font-size:11px;font-weight:700;color:${escapeHtml(color)};text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(c.name_en ?? "Issue")}</div>
              <div style="font-size:13px;font-weight:700;margin-top:2px;color:#0f172a;">${escapeHtml(i.public_id ?? "")}</div>
              <div style="font-size:12px;color:#475569;margin-top:2px;line-height:1.35;">${escapeHtml(shortDescription)}</div>
              <div style="margin-top:6px;font-size:11px;font-weight:700;color:#1e293b;">${escapeHtml(statusMeta.label)}</div>
              <a href="${href}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#1d4ed8;text-decoration:none;">View full report \u2192</a>
            </div>
          `,
        };
      }),
    [issues.data],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Explore issues</h1>
            <p className="text-sm text-muted-foreground">
              Filter by category, ward and status. Search for areas, MGR-IDs, or keywords.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border bg-card p-1 text-xs font-medium">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 ${view === "list" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1 rounded-full px-3 py-1 ${view === "map" ? "bg-primary text-primary-foreground" : ""}`}
            >
              <MapIcon className="h-3.5 w-3.5" /> Map
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search: pothole, Kankanady, MGR-2026-00091…"
              className="pl-9"
            />
          </div>

          <div className="-mx-1 overflow-x-auto">
            <div className="flex w-max gap-1 px-1 text-xs">
              <Chip active={!cat} onClick={() => setCat("")}>
                All categories
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.slug}
                  active={cat === c.slug}
                  onClick={() => setCat(c.slug)}
                  color={c.color}
                >
                  {c.name_en}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 text-xs">
            <Chip active={!status} onClick={() => setStatus("")}>
              Any status
            </Chip>
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {STATUS_META[s].label}
              </Chip>
            ))}
            <span className="mx-2 w-px self-stretch bg-border" />
            <Chip active={!sev} onClick={() => setSev("")}>
              Any severity
            </Chip>
            {(Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((s) => (
              <Chip key={s} active={sev === s} onClick={() => setSev(s)}>
                {SEVERITY_META[s].label}
              </Chip>
            ))}
            <span className="mx-2 w-px self-stretch bg-border" />
            <select
              value={wardId ?? ""}
              onChange={(e) => setWardId(e.target.value ? Number(e.target.value) : undefined)}
              className="rounded-full border bg-card px-3 py-1 text-xs"
            >
              <option value="">All wards</option>
              {(wards.data ?? []).map((w: any) => (
                <option key={w.id} value={w.id}>
                  Ward {w.number} · {w.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="rounded-full border bg-card px-3 py-1 text-xs"
            >
              <option value="heat">Sort: Heat</option>
              <option value="recent">Sort: Newest</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {view === "map" ? (
            <IssueMap points={mapPoints} height={520} />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {(issues.data ?? []).map((it: any) => (
                <IssueCard key={it.id} issue={it} />
              ))}
              {issues.isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
                ))}
              {!issues.isLoading && (issues.data ?? []).length === 0 && (
                <div className="col-span-full rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
                  No issues match these filters yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1 font-medium transition ${
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:bg-accent"
      }`}
      style={active && color ? { background: color, color: "white" } : undefined}
    >
      {children}
    </button>
  );
}
