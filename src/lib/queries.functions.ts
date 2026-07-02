import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function sb() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isCorporator(role: unknown) {
  return String(role ?? "").trim().toLowerCase() === "corporator";
}

export const listIssuesFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d?: {
      sort?: "recent" | "heat";
      category_slug?: string;
      ward_id?: number;
      status?: string;
      severity?: string;
      q?: string;
      limit?: number;
    }) =>
      z
        .object({
          sort: z.enum(["recent", "heat"]).optional(),
          category_slug: z.string().optional(),
          ward_id: z.number().int().optional(),
          status: z.string().optional(),
          severity: z.string().optional(),
          q: z.string().optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const c = sb();
    let q = c
      .from("issues")
      .select(
        `
        id, public_id, slug, description, severity, status, lat, lng,
        area, locality, address, ward_id, needs_review, image_url, supporters_count,
        thanked_count, views, heat_score, created_at, updated_at,
        category:categories(id, slug, name_en, icon, color),
        authority:authorities!issues_assigned_authority_id_fkey(id, name, logo_url),
        representative:representatives!issues_assigned_representative_id_fkey(id, name, role, photo_url),
        ward:wards(id, number, name)
      `,
      )
      .eq("visibility", "visible")
      .limit(data.limit ?? 30);

    if (data.sort === "heat") q = q.order("heat_score", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    if (data.status) q = q.eq("status", data.status as any);
    if (data.severity) q = q.eq("severity", data.severity as any);
    if (data.ward_id) q = q.eq("ward_id", data.ward_id);
    if (data.category_slug) {
      const { data: cat } = await c
        .from("categories")
        .select("id")
        .eq("slug", data.category_slug)
        .single();
      if (cat) q = q.eq("category_id", cat.id);
    }
    if (data.q) {
      const term = data.q.trim();
      if (term.startsWith("MGR-")) q = q.eq("public_id", term);
      else
        q = q.or(
          `description.ilike.%${term}%,area.ilike.%${term}%,locality.ilike.%${term}%,address.ilike.%${term}%`,
        );
    }

    const { data: rows, error } = await q;
    if (error) throw error;
    // Job-role "Corporator" placeholders (one auto-generated per ward, not a
    // named individual) should never surface as an assigned representative.
    return (rows ?? []).map((r: any) =>
      r.representative && isCorporator(r.representative.role)
        ? { ...r, representative: null }
        : r,
    );
  });

export const getIssueByPublicIdFn = createServerFn({ method: "POST" })
  .inputValidator((d: { public_id: string }) => z.object({ public_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const c = sb();
    const { data: row, error } = await c
      .from("issues")
      .select(
        `
        *,
        category:categories(*),
        authority:authorities!issues_assigned_authority_id_fkey(*),
        representative:representatives!issues_assigned_representative_id_fkey(*),
        ward:wards(*)
      `,
      )
      .eq("public_id", data.public_id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    if ((row as any).representative && isCorporator((row as any).representative.role)) {
      (row as any).representative = null;
    }

    const [history, official, comments, votes, watchers, photos] = await Promise.all([
      c
        .from("issue_status_history")
        .select("*")
        .eq("issue_id", row.id)
        .order("created_at", { ascending: true }),
      c
        .from("issue_official_updates")
        .select("*")
        .eq("issue_id", row.id)
        .order("created_at", { ascending: false }),
      c
        .from("issue_comments")
        .select("*")
        .eq("issue_id", row.id)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(100),
      c.from("issue_votes").select("vote").eq("issue_id", row.id),
      c
        .from("issue_watchers")
        .select("device_id", { count: "exact", head: true })
        .eq("issue_id", row.id),
      c
        .from("issue_photos")
        .select("*")
        .eq("issue_id", row.id)
        .order("position", { ascending: true }),
    ]);

    return {
      issue: row,
      history: history.data ?? [],
      official: official.data ?? [],
      comments: comments.data ?? [],
      photos: photos.data ?? [],
      votes: {
        exists: votes.data?.filter((v) => v.vote === "exists").length ?? 0,
        fixed: votes.data?.filter((v) => v.vote === "fixed").length ?? 0,
      },
      watchers: watchers.count ?? 0,
    };
  });

export const listCategoriesFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c.from("categories").select("*").order("sort_order").order("name_en");
  if (error) throw error;
  return data ?? [];
});

export const listWardsFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c.from("wards").select("*").order("number");
  if (error) throw error;
  return data ?? [];
});

// DK's 9 taluks (see the governance knowledge base). Used by the admin
// jurisdiction-rules editor and available for any future taluk-aware UI.
export const listTaluksFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c.from("taluks").select("*").order("name");
  if (error) throw error;
  return data ?? [];
});

export const listAuthoritiesFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data: auths, error: authsError } = await c.from("authorities").select("*").order("name");
  if (authsError) throw authsError;
  // PERF: Fetching ALL issues is expensive as the table grows.
  // Consider using a materialized view or aggregate table instead.
  // For now, limit to the last 10,000 issues to keep response times reasonable.
  const { data: agg, error: aggError } = await c
    .from("issues")
    .select("assigned_authority_id, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(10000);
  if (aggError) throw aggError;

  return (auths ?? []).map((a) => {
    const mine = (agg ?? []).filter((i) => i.assigned_authority_id === a.id);
    const resolved = mine.filter((i) =>
      ["resolved", "community_confirmed", "closed"].includes(i.status as string),
    );
    const pending = mine.length - resolved.length;
    const times = resolved.map(
      (i) =>
        new Date(i.updated_at as string).getTime() - new Date(i.created_at as string).getTime(),
    );
    const avgDays = times.length
      ? times.reduce((x, y) => x + y, 0) / times.length / 86400000
      : null;
    const total = mine.length || 1;
    const score = Math.round((resolved.length / total) * 100);
    return {
      ...a,
      total: mine.length,
      resolved: resolved.length,
      pending,
      avg_days: avgDays,
      score,
    };
  });
});

export const listRepresentativesFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c
    .from("representatives")
    .select("*, authority:authorities(id, name), ward:wards(id, number, name)")
    .eq("active", true)
    .not("role", "ilike", "corporator")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const wardStatsFn = createServerFn({ method: "GET" })
  .inputValidator((d?: { ward_id?: number }) =>
    z.object({ ward_id: z.number().int().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const c = sb();
    let q = c
      .from("issues")
      .select(
        "id, status, category_id, severity, lat, lng, ward_id, created_at, category:categories(slug, name_en, color)",
      )
      .eq("visibility", "visible");
    if (data.ward_id) q = q.eq("ward_id", data.ward_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const analyticsFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data: rows, error } = await c
    .from("issues")
    .select("status, severity, ward_id, category_id, created_at, updated_at, assigned_authority_id")
    .eq("visibility", "visible");
  if (error) throw error;
  const list = rows ?? [];
  const now = Date.now();
  const dayAgo = now - 86400000;
  const weekAgo = now - 7 * 86400000;
  const today = list.filter((r) => new Date(r.created_at as string).getTime() >= dayAgo).length;
  const week = list.filter((r) => new Date(r.created_at as string).getTime() >= weekAgo).length;
  const resolved = list.filter((r) =>
    ["resolved", "community_confirmed", "closed"].includes(r.status as string),
  );
  const times = resolved.map(
    (r) => new Date(r.updated_at as string).getTime() - new Date(r.created_at as string).getTime(),
  );
  const avgDays = times.length ? times.reduce((a, b) => a + b, 0) / times.length / 86400000 : 0;

  const byWard: Record<string, number> = {};
  const byCat: Record<string, number> = {};
  list.forEach((r) => {
    if (r.ward_id) byWard[r.ward_id] = (byWard[r.ward_id] ?? 0) + 1;
    if (r.category_id) byCat[r.category_id] = (byCat[r.category_id] ?? 0) + 1;
  });
  const topWard = Object.entries(byWard).sort((a, b) => b[1] - a[1])[0];
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  return {
    total: list.length,
    today,
    week,
    resolved: resolved.length,
    avg_days: avgDays,
    top_ward_id: topWard ? Number(topWard[0]) : null,
    top_category_id: topCat ? Number(topCat[0]) : null,
  };
});
