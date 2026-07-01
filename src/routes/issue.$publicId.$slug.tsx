import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getIssueByPublicIdFn } from "@/lib/queries.functions";
import {
  voteIssueFn,
  supportIssueFn,
  thanksIssueFn,
  commentIssueFn,
  watchIssueFn,
  incrementViewFn,
} from "@/lib/issues.functions";
import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { IssueMap } from "@/components/IssueMap";
import { PosterGenerator } from "@/components/PosterGenerator";
import { STATUS_META, STATUS_ORDER, SEVERITY_META, categoryBySlug, slugify } from "@/lib/civic";
import { getDeviceId, getDeviceName } from "@/lib/device";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  ThumbsUp,
  ThumbsDown,
  Heart,
  MessageSquare,
  Eye,
  Bell,
  ShieldCheck,
  Megaphone,
  Image as ImgIcon,
  Share2,
} from "lucide-react";

export const Route = createFileRoute("/issue/$publicId/$slug")({
  component: IssuePage,
  ssr: false,
  pendingComponent: () => <div className="min-h-screen" />,
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-md p-10 text-center text-muted-foreground">
        Issue not found.
      </div>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-md p-10 text-center text-muted-foreground">
        Failed to load issue.
      </div>
    </AppShell>
  ),
});

function IssuePage() {
  const { publicId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["issue", publicId],
    queryFn: () => getIssueByPublicIdFn({ data: { public_id: publicId } }),
  });

  // count a view once per session
  useEffect(() => {
    if (!q.data?.issue?.id) return;
    const key = `v_${publicId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    incrementViewFn({ data: { issue_id: q.data.issue.id } }).catch(() => {});
  }, [q.data?.issue?.id, publicId]);

  if (q.isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-10">Loading…</div>
      </AppShell>
    );
  }
  const payload = q.data;
  if (!payload?.issue) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl p-10">Not found.</div>
      </AppShell>
    );
  }
  const i = payload.issue as any;
  const cat = i.category ?? categoryBySlug("others");
  const status = STATUS_META[i.status as keyof typeof STATUS_META] ?? STATUS_META.reported;
  const severity = SEVERITY_META[i.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.medium;

  // ensure URL slug matches (canonical)
  useEffect(() => {
    const canon = i.slug || slugify(i.description);
    const last = (location.pathname.split("/").pop() ?? "").trim();
    if (canon && last && last !== canon) {
      navigate({
        to: "/issue/$publicId/$slug",
        params: { publicId, slug: canon },
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["issue", publicId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const vote = (v: "exists" | "fixed") =>
    act(
      () => voteIssueFn({ data: { issue_id: i.id, device_id: getDeviceId(), vote: v } }),
      v === "exists" ? "Marked as still exists" : "Marked as fixed",
    );

  const support = () =>
    act(
      () => supportIssueFn({ data: { issue_id: i.id, device_id: getDeviceId() } }),
      "Added your support",
    );

  const thanks = () =>
    act(
      () => thanksIssueFn({ data: { issue_id: i.id, device_id: getDeviceId() } }),
      "Thanks recorded",
    );

  const watch = () => {
    const email = prompt("Optional email for updates (leave empty to just bookmark)") ?? "";
    return act(
      () =>
        watchIssueFn({ data: { issue_id: i.id, device_id: getDeviceId(), email: email || null } }),
      "Watching this issue",
    );
  };

  const stepIdx = STATUS_ORDER.indexOf(i.status as any);

  return (
    <AppShell>
      <article className="mx-auto max-w-3xl px-4 py-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: cat.color ?? "#334155" }}
            >
              {cat.name_en}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${severity.color}`}
            >
              {severity.label}
            </span>
            <Badge variant="outline" className={`text-[11px] ${status.color}`}>
              {status.label}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">{i.public_id}</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
            {i.description}
          </h1>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>
              {[i.area, i.locality].filter(Boolean).join(", ") || i.address || "Mangaluru"}
            </span>
            {i.ward && (
              <span>
                · Ward {i.ward.number} · {i.ward.name}
              </span>
            )}
          </div>
        </header>

        <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
          {i.image_url && (
            <img
              src={i.image_url}
              alt={i.description}
              className="aspect-[4/3] w-full object-cover"
            />
          )}
        </div>

        {/* Action bar */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ActionButton
            onClick={support}
            icon={<ThumbsUp className="h-4 w-4" />}
            label="Support"
            value={i.supporters_count}
          />
          <ActionButton
            onClick={() => vote("exists")}
            icon={<ThumbsDown className="h-4 w-4" />}
            label="Still exists"
            value={payload.votes.exists}
          />
          <ActionButton
            onClick={() => vote("fixed")}
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Fixed"
            value={payload.votes.fixed}
          />
          <ActionButton
            onClick={thanks}
            icon={<Heart className="h-4 w-4" />}
            label="Thanks"
            value={i.thanked_count}
          />
          <ActionButton
            onClick={watch}
            icon={<Bell className="h-4 w-4" />}
            label="Watch"
            value={payload.watchers}
          />
        </div>

        {/* Status timeline */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Progress</h2>
          <ol className="mt-3 flex flex-wrap gap-2">
            {STATUS_ORDER.map((s, idx) => {
              const meta = STATUS_META[s];
              const done = idx <= stepIdx;
              return (
                <li
                  key={s}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                    done ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      done ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  {meta.label}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Assignment — highlighted card */}
        <section className="mt-8">
          <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.04] to-primary/[0.09] shadow-sm">
            <div className="grid gap-0 md:grid-cols-2">
              {/* Authority */}
              <div className="border-b border-primary/20 p-5 md:border-b-0 md:border-r">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-primary/10">
                    {i.authority?.logo_url ? (
                      <img src={i.authority.logo_url} className="h-full w-full object-contain p-1.5" alt="" />
                    ) : (
                      <span className="text-lg font-bold text-primary">{i.authority?.name?.slice(0, 1) ?? "—"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned authority</div>
                    <div className="truncate text-base font-bold">{i.authority?.name ?? "Unassigned"}</div>
                    {i.authority?.phone && <div className="text-xs text-muted-foreground">{i.authority.phone}</div>}
                  </div>
                </div>
                {i.assignment_reason && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Routing: <span className="font-medium text-foreground">{i.assignment_reason}</span>
                    {i.assignment_rule_version != null && <> · v{i.assignment_rule_version}</>}
                  </div>
                )}
              </div>
              {/* Representative */}
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-primary/20">
                    {i.representative?.photo_url ? (
                      <img src={i.representative.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-bold text-muted-foreground">
                        {i.representative?.name?.slice(0, 1) ?? "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Local representative</div>
                    {i.representative ? (
                      <>
                        <div className="truncate text-base font-bold">{i.representative.name}</div>
                        <div className="text-xs text-muted-foreground">{i.representative.role}{i.representative.constituency ? ` · ${i.representative.constituency}` : ""}</div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not mapped yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Official updates */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Official update</h2>
          </div>
          {payload.official.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No update yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {payload.official.map((u: any) => (
                <li
                  key={u.id}
                  className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
                >
                  <div className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleString()}
                  </div>
                  <p className="mt-1">{u.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Timeline with photos */}
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <ImgIcon className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Timeline</h2>
          </div>
          <ol className="mt-3 space-y-3">
            {payload.history.map((h: any) => (
              <li key={h.id} className="flex gap-3 rounded-2xl border bg-card p-3">
                {h.photo_url ? (
                  <img src={h.photo_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted" />
                )}
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(h.created_at).toLocaleString()}</span>
                    {h.by_admin && (
                      <Badge variant="outline" className="text-[10px]">
                        Authority
                      </Badge>
                    )}
                    {h.photo_kind && (
                      <Badge variant="outline" className="text-[10px]">
                        {h.photo_kind.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  {h.status && (
                    <div className="mt-0.5 font-semibold">
                      {STATUS_META[h.status as keyof typeof STATUS_META]?.label ?? h.status}
                    </div>
                  )}
                  {h.note && <p className="mt-1 text-muted-foreground">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Map */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Location</h2>
          <div className="mt-3">
            <IssueMap
              height={260}
              center={{ lat: i.lat, lng: i.lng }}
              zoom={16}
              marker={{ lat: i.lat, lng: i.lng }}
            />
          </div>
        </section>

        {/* Comments */}
        <Comments
          issueId={i.id}
          comments={payload.comments}
          onPosted={() => qc.invalidateQueries({ queryKey: ["issue", publicId] })}
        />

        {/* Poster + share */}
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Share / Poster</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard");
              }}
              className="flex items-center gap-1.5 rounded-xl border bg-card px-4 py-2 text-sm font-semibold transition hover:bg-accent"
            >
              <Share2 className="h-4 w-4" /> Copy link
            </button>
          </div>
          <div className="mt-3">
            <PosterGenerator
              issue={i}
              publicUrl={typeof window !== "undefined" ? window.location.href : ""}
            />
          </div>
        </section>

        {/* SEO: route uses ssr:false, so SSR meta tags are not available.
            For production, consider adding a head() function or server-side
            rendering for meta tags. */}
        <div className="mt-6">
          <Disclaimer variant="inline" />
        </div>

        <div className="mt-10 text-center">
          <Link to="/explore" className="text-sm text-primary hover:underline">
            ← Back to all issues
          </Link>
        </div>
      </article>
    </AppShell>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  value,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-semibold transition hover:bg-accent"
    >
      {icon} {label}
      <span className="rounded-full bg-muted px-1.5 text-[10px] font-bold">{value ?? 0}</span>
    </button>
  );
}

function Comments({
  issueId,
  comments,
  onPosted,
}: {
  issueId: string;
  comments: any[];
  onPosted: () => void;
}) {
  const [name, setName] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setName(getDeviceName() ?? "");
  }, []);

  const quick = async (kind: "also_saw" | "still_exists" | "already_fixed", text: string) => {
    setWorking(true);
    try {
      await commentIssueFn({
        data: {
          issue_id: issueId,
          device_id: getDeviceId(),
          name: name || null,
          body: text,
          quick_reply: kind,
        },
      });
      toast.success("Thanks for confirming");
      onPosted();
    } finally {
      setWorking(false);
    }
  };

  const post = async () => {
    if (body.trim().length < 1) return;
    setWorking(true);
    try {
      await commentIssueFn({
        data: {
          issue_id: issueId,
          device_id: getDeviceId(),
          name: name || null,
          body: body.trim(),
          quick_reply: "other",
        },
      });
      setBody("");
      onPosted();
      toast.success("Comment posted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Comments ({comments.length})</h2>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => quick("also_saw", "I saw this too.")}
          disabled={working}
        >
          👀 I saw this too
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => quick("still_exists", "I passed today, still exists.")}
          disabled={working}
        >
          ⚠️ Still exists today
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => quick("already_fixed", "Already repaired.")}
          disabled={working}
        >
          ✅ Already fixed
        </Button>
      </div>

      <div className="mt-3 space-y-2 rounded-2xl border bg-card p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
        />
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          placeholder="Add a comment…"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{body.length}/500</span>
          <Button size="sm" onClick={post} disabled={working || body.length < 1}>
            Post
          </Button>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl border bg-card p-3 text-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{c.name || "Citizen"}</span>
              <span>· {new Date(c.created_at).toLocaleString()}</span>
              {c.quick_reply && c.quick_reply !== "other" && (
                <Badge variant="outline" className="text-[10px]">
                  quick
                </Badge>
              )}
            </div>
            <p className="mt-1">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="text-sm text-muted-foreground">Be the first to comment.</li>
        )}
      </ul>
    </section>
  );
}
