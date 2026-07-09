import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function sb() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL environment variable");
  if (!supabaseKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");

  return createClient<Database>(supabaseUrl, supabaseKey, {
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
      authority_id?: number;
      representative_id?: number;
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
          authority_id: z.number().int().optional(),
          representative_id: z.number().int().optional(),
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
    if (data.authority_id) q = q.eq("assigned_authority_id", data.authority_id);
    if (data.representative_id) q = q.eq("assigned_representative_id", data.representative_id);
    if (data.category_slug) {
      const { data: cat } = await c
        .from("categories")
        .select("id")
        .eq("slug", data.category_slug)
        .single();
      if (cat) q = q.eq("category_id", cat.id);
    }
    if (data.q) {
      const term = data.q.trim().replace(/[(),.]/g, '\\$&');
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
      .eq("visibility", "visible")
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
  const { data, error } = await c
    .from("authority_stats_view")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const listRepresentativesFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c
    .from("representative_stats_view")
    .select("*, authority:authorities(id, name), ward:wards(id, number, name)")
    .eq("active", true)
    .not("role", "ilike", "corporator")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const wardStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c
    .from("ward_stats_view")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const analyticsFn = createServerFn({ method: "GET" }).handler(async () => {
  const c = sb();
  const { data, error } = await c
    .from("analytics_view")
    .select("*")
    .single();
  if (error) throw error;
  return {
    total: Number(data.total ?? 0),
    today: Number(data.today ?? 0),
    week: Number(data.week ?? 0),
    resolved: Number(data.resolved ?? 0),
    avg_days: Number(data.avg_days ?? 0),
    top_ward_id: data.top_ward_id ? Number(data.top_ward_id) : null,
    top_category_id: data.top_category_id ? Number(data.top_category_id) : null,
  };
});
