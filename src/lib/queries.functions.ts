import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "@/lib/db";

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
    const params: any[] = ["visible"];
    let paramIdx = 2;
    const conditions: string[] = ["i.visibility = $1"];

    if (data.status) {
      conditions.push(`i.status = $${paramIdx++}`);
      params.push(data.status);
    }
    if (data.severity) {
      conditions.push(`i.severity = $${paramIdx++}`);
      params.push(data.severity);
    }
    if (data.ward_id) {
      conditions.push(`i.ward_id = $${paramIdx++}`);
      params.push(data.ward_id);
    }
    if (data.authority_id) {
      conditions.push(`i.assigned_authority_id = $${paramIdx++}`);
      params.push(data.authority_id);
    }
    if (data.representative_id) {
      conditions.push(`i.assigned_representative_id = $${paramIdx++}`);
      params.push(data.representative_id);
    }
    if (data.category_slug) {
      conditions.push(`i.category_id = (SELECT id FROM public.categories WHERE slug = $${paramIdx++})`);
      params.push(data.category_slug);
    }
    if (data.q) {
      const term = data.q.trim();
      if (term.startsWith("MGR-")) {
        conditions.push(`i.public_id = $${paramIdx++}`);
        params.push(term);
      } else {
        conditions.push(
          `(i.description ILIKE $${paramIdx} OR i.area ILIKE $${paramIdx} OR i.locality ILIKE $${paramIdx} OR i.address ILIKE $${paramIdx})`
        );
        params.push(`%${term}%`);
        paramIdx++;
      }
    }

    const orderBy = data.sort === "heat" ? "i.heat_score DESC" : "i.created_at DESC";
    const limit = data.limit ?? 30;
    params.push(limit);

    const sql = `
      SELECT
        i.id, i.public_id, i.slug, i.description, i.severity, i.status,
        i.lat, i.lng, i.area, i.locality, i.address, i.ward_id, i.needs_review,
        i.image_url, i.supporters_count, i.thanked_count, i.views, i.heat_score,
        i.created_at, i.updated_at,
        json_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'icon', c.icon, 'color', c.color) AS category,
        CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name, 'logo_url', a.logo_url) ELSE NULL END AS authority,
        CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name, 'role', r.role, 'photo_url', r.photo_url) ELSE NULL END AS representative,
        CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'number', w.number, 'name', w.name) ELSE NULL END AS ward
      FROM public.issues i
      LEFT JOIN public.categories c ON c.id = i.category_id
      LEFT JOIN public.authorities a ON a.id = i.assigned_authority_id
      LEFT JOIN public.representatives r ON r.id = i.assigned_representative_id
      LEFT JOIN public.wards w ON w.id = i.ward_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${paramIdx}
    `;

    const { rows } = await query(sql, params);
    return rows.map((r: any) =>
      r.representative && isCorporator(r.representative.role)
        ? { ...r, representative: null }
        : r,
    );
  });

export const getIssueByPublicIdFn = createServerFn({ method: "POST" })
  .inputValidator((d: { public_id: string }) => z.object({ public_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { rows: issueRows } = await query(
      `SELECT
        i.*,
        json_build_object('id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'icon', c.icon, 'color', c.color) AS category,
        CASE WHEN a.id IS NOT NULL THEN row_to_json(a.*) ELSE NULL END AS authority,
        CASE WHEN r.id IS NOT NULL THEN row_to_json(r.*) ELSE NULL END AS representative,
        CASE WHEN w.id IS NOT NULL THEN row_to_json(w.*) ELSE NULL END AS ward
       FROM public.issues i
       LEFT JOIN public.categories c ON c.id = i.category_id
       LEFT JOIN public.authorities a ON a.id = i.assigned_authority_id
       LEFT JOIN public.representatives r ON r.id = i.assigned_representative_id
       LEFT JOIN public.wards w ON w.id = i.ward_id
       WHERE i.public_id = $1 AND i.visibility = 'visible'`,
      [data.public_id],
    );
    if (!issueRows.length) return null;
    const row: any = issueRows[0];

    if (row.representative && isCorporator(row.representative.role)) {
      row.representative = null;
    }

    const [history, official, comments, votes, watchers, photos] = await Promise.all([
      query(`SELECT * FROM public.issue_status_history WHERE issue_id = $1 ORDER BY created_at ASC`, [row.id]),
      query(`SELECT * FROM public.issue_official_updates WHERE issue_id = $1 ORDER BY created_at DESC`, [row.id]),
      query(`SELECT * FROM public.issue_comments WHERE issue_id = $1 AND hidden = false ORDER BY created_at DESC LIMIT 100`, [row.id]),
      query(`SELECT vote FROM public.issue_votes WHERE issue_id = $1`, [row.id]),
      query(`SELECT COUNT(*) AS count FROM public.issue_watchers WHERE issue_id = $1`, [row.id]),
      query(`SELECT * FROM public.issue_photos WHERE issue_id = $1 ORDER BY position ASC`, [row.id]),
    ]);

    return {
      issue: row,
      history: history.rows,
      official: official.rows,
      comments: comments.rows,
      photos: photos.rows,
      votes: {
        exists: votes.rows.filter((v: any) => v.vote === "exists").length,
        fixed: votes.rows.filter((v: any) => v.vote === "fixed").length,
      },
      watchers: parseInt((watchers.rows[0] as any)?.count ?? "0", 10),
    };
  });

export const listCategoriesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query(`SELECT * FROM public.categories ORDER BY sort_order, name_en`);
  return rows;
});

export const listWardsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query(`SELECT * FROM public.wards ORDER BY number`);
  return rows;
});

// DK's 9 taluks. Used by the admin jurisdiction-rules editor.
export const listTaluksFn = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query(`SELECT * FROM public.taluks ORDER BY name`);
  return rows;
});

export const listAuthoritiesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { rows: auths } = await query(`SELECT * FROM public.authorities ORDER BY name`);
  const { rows: agg } = await query(
    `SELECT assigned_authority_id, status, created_at, updated_at
     FROM public.issues
     ORDER BY created_at DESC
     LIMIT 10000`,
  );

  return auths.map((a: any) => {
    const mine = agg.filter((i: any) => i.assigned_authority_id === a.id);
    const resolved = mine.filter((i: any) =>
      ["resolved", "community_confirmed", "closed"].includes(i.status),
    );
    const pending = mine.length - resolved.length;
    const times = resolved.map(
      (i: any) =>
        new Date(i.updated_at).getTime() - new Date(i.created_at).getTime(),
    );
    const avgDays = times.length
      ? times.reduce((x: number, y: number) => x + y, 0) / times.length / 86400000
      : null;
    const total = mine.length;
    const score = total > 0 ? Math.round((resolved.length / total) * 100) : 0;
    return {
      ...a,
      total,
      resolved: resolved.length,
      pending,
      avg_days: avgDays,
      score,
    };
  });
});

export const listRepresentativesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { rows } = await query(
    `SELECT r.*,
       json_build_object('id', a.id, 'name', a.name) AS authority,
       CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'number', w.number, 'name', w.name) ELSE NULL END AS ward
     FROM public.representatives r
     LEFT JOIN public.authorities a ON a.id = r.authority_id
     LEFT JOIN public.wards w ON w.id = r.ward_id
     WHERE r.active = true AND lower(r.role) NOT LIKE 'corporator%'
     ORDER BY r.name`,
  );
  return rows;
});

export const wardStatsFn = createServerFn({ method: "GET" })
  .inputValidator((d?: { ward_id?: number }) =>
    z.object({ ward_id: z.number().int().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const params: any[] = [];
    let sql = `
      SELECT i.id, i.status, i.category_id, i.severity, i.lat, i.lng, i.ward_id, i.created_at,
        json_build_object('slug', c.slug, 'name_en', c.name_en, 'color', c.color) AS category
      FROM public.issues i
      LEFT JOIN public.categories c ON c.id = i.category_id
      WHERE i.visibility = 'visible'
    `;
    if (data.ward_id) {
      params.push(data.ward_id);
      sql += ` AND i.ward_id = $1`;
    }
    const { rows } = await query(sql, params);
    return rows;
  });

export const analyticsFn = createServerFn({ method: "GET" }).handler(async () => {
  const [issuesRes, visitsRes, weeklyRes, monthlyRes] = await Promise.all([
    query(
      `SELECT status, severity, ward_id, category_id, created_at, updated_at, assigned_authority_id
       FROM public.issues
       WHERE visibility = 'visible'`
    ),
    query(`SELECT count FROM public.site_visits WHERE id = 1`).catch(() => ({ rows: [] })),
    query(`SELECT SUM(count) as count FROM public.daily_visits WHERE date >= CURRENT_DATE - INTERVAL '7 days'`).catch(() => ({ rows: [] })),
    query(`SELECT SUM(count) as count FROM public.daily_visits WHERE date >= CURRENT_DATE - INTERVAL '30 days'`).catch(() => ({ rows: [] }))
  ]);
  const list = issuesRes.rows;
  const visitors = parseInt(visitsRes.rows[0]?.count ?? 0, 10) || 0;
  const visitors_week = parseInt(weeklyRes.rows[0]?.count ?? 0, 10) || 0;
  const visitors_month = parseInt(monthlyRes.rows[0]?.count ?? 0, 10) || 0;
  const now = Date.now();
  const dayAgo = now - 86400000;
  const weekAgo = now - 7 * 86400000;
  const today = list.filter((r: any) => new Date(r.created_at).getTime() >= dayAgo).length;
  const week = list.filter((r: any) => new Date(r.created_at).getTime() >= weekAgo).length;
  const resolved = list.filter((r: any) =>
    ["resolved", "community_confirmed", "closed"].includes(r.status),
  );
  const times = resolved.map(
    (r: any) => new Date(r.updated_at).getTime() - new Date(r.created_at).getTime(),
  );
  const avgDays = times.length ? times.reduce((a: number, b: number) => a + b, 0) / times.length / 86400000 : 0;

  const byWard: Record<string, number> = {};
  const byCat: Record<string, number> = {};
  list.forEach((r: any) => {
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
    visitors,
    visitors_week,
    visitors_month,
  };
});

export const trackVisitFn = createServerFn({ method: "POST" }).handler(async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS public.site_visits (
      id integer PRIMARY KEY DEFAULT 1,
      count integer NOT NULL DEFAULT 0
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS public.daily_visits (
      date date PRIMARY KEY,
      count integer NOT NULL DEFAULT 0
    );
  `);
  await query(`
    INSERT INTO public.site_visits (id, count) VALUES (1, 1)
    ON CONFLICT (id) DO UPDATE SET count = site_visits.count + 1;
  `);
  await query(`
    INSERT INTO public.daily_visits (date, count) VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET count = daily_visits.count + 1;
  `);
  return { ok: true };
});
