import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { resolveIssue } from "@/lib/resolver";
import { query } from "@/lib/db";

// ── Supabase client — used ONLY for Storage (photo uploads + signed URLs) ──
function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function storageClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL environment variable");
  if (!supabaseKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");

  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: { fetch: createSupabaseFetch(supabaseKey) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUrl(bucket: string, path: string): Promise<string> {
  const sb = storageClient();
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────

const createIssueInput = z.object({
  device_id: z.string().min(8),
  category_slug: z.string().min(1),
  description: z.string().min(5).max(250),
  severity: z.enum(["low", "medium", "high", "dangerous"]),
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  locality: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  ward_id: z.number().int().optional().nullable(),
  image_path: z.string().min(3),
  image_phash: z.string().optional().nullable(),
  extra_image_paths: z.array(z.string().min(3)).max(4).optional().nullable(),
});

export const createIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof createIssueInput>) => createIssueInput.parse(d))
  .handler(async ({ data }) => {
    // category lookup
    const { rows: catRows } = await query(
      `SELECT id, slug, name_en FROM public.categories WHERE slug = $1`,
      [data.category_slug],
    );
    if (!catRows.length) throw new Error("Unknown category");
    const cat = catRows[0] as any;

    // Resolve authority + representative via layered engine
    // NOTE: resolver.ts now uses the Neon pool directly
    const sb = storageClient();
    const resolution = await resolveIssue({
      category_id: cat.id,
      ward_id: data.ward_id,
      area: data.area,
      locality: data.locality,
      address: data.address,
    });

    // allocate public id via the DB sequence function
    const { rows: pidRows } = await query(`SELECT public.next_public_id() AS public_id`);
    if (!pidRows.length) throw new Error("Could not allocate ID");
    const public_id = (pidRows[0] as any).public_id as string;

    const slug = data.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 50);

    const reason = `Category=${cat.name_en}` + (resolution.reason ? `, ${resolution.reason}` : "");

    // upsert device + increment count
    await query(
      `INSERT INTO public.devices (device_id, last_seen)
       VALUES ($1, now())
       ON CONFLICT (device_id) DO UPDATE SET last_seen = now()`,
      [data.device_id],
    );
    await query(
      `UPDATE public.devices SET report_count = report_count + 1, last_seen = now() WHERE device_id = $1`,
      [data.device_id],
    );

    const image_url = await signUrl("issue-photos", data.image_path);

    // insert issue
    const { rows: insRows } = await query(
      `INSERT INTO public.issues
        (public_id, slug, category_id, description, severity, lat, lng,
         address, area, locality, pincode, ward_id, image_url, image_phash, device_id,
         assigned_authority_id, assigned_representative_id, assignment_reason,
         assignment_rule_version, needs_review, jurisdiction_confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id, public_id, slug`,
      [
        public_id, slug, cat.id, data.description, data.severity, data.lat, data.lng,
        data.address ?? null, data.area ?? null, data.locality ?? null, data.pincode ?? null,
        resolution.resolved_ward_id ?? data.ward_id ?? null,
        image_url, data.image_phash ?? null, data.device_id,
        resolution.authority_id, resolution.representative_id, reason,
        resolution.version, resolution.needs_review ?? false,
        resolution.jurisdiction_confidence ?? null,
      ],
    );
    if (!insRows.length) throw new Error("Failed to create issue");
    const ins = insRows[0] as any;

    await query(
      `INSERT INTO public.issue_status_history
        (issue_id, status, note, photo_url, photo_kind, by_admin, by_device_id)
       VALUES ($1, 'reported', 'Issue reported by citizen', $2, 'report', false, $3)`,
      [ins.id, image_url, data.device_id],
    );

    // Optional extra photos
    const extraPaths = (data.extra_image_paths ?? []).slice(0, 4);
    if (extraPaths.length > 0) {
      const extraRows = await Promise.all(
        extraPaths.map(async (p, idx) => ({
          issue_id: ins.id,
          url: await signUrl("issue-photos", p),
          path: p,
          position: idx + 1,
        })),
      );
      for (const row of extraRows) {
        await query(
          `INSERT INTO public.issue_photos (issue_id, url, path, position) VALUES ($1,$2,$3,$4)`,
          [row.issue_id, row.url, row.path, row.position],
        );
      }
    }

    return { public_id: ins.public_id, slug: ins.slug ?? "" };
  });

// ── Duplicate detection ──────────────────────────────────────────────────────
const findDupesInput = z.object({
  category_slug: z.string(),
  lat: z.number(),
  lng: z.number(),
  description: z.string(),
  image_phash: z.string().optional().nullable(),
});

export const findDuplicatesFn = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof findDupesInput>) => findDupesInput.parse(d))
  .handler(async ({ data }) => {
    const { rows: catRows } = await query(
      `SELECT id FROM public.categories WHERE slug = $1`,
      [data.category_slug],
    );
    if (!catRows.length) return { candidates: [] };
    const cat = catRows[0] as any;

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const delta = 0.0006;

    const { rows } = await query(
      `SELECT id, public_id, slug, description, lat, lng, image_phash, image_url, created_at, status, supporters_count
       FROM public.issues
       WHERE category_id = $1
         AND visibility = 'visible'
         AND created_at >= $2
         AND lat BETWEEN $3 AND $4
         AND lng BETWEEN $5 AND $6
       LIMIT 10`,
      [cat.id, since, data.lat - delta, data.lat + delta, data.lng - delta, data.lng + delta],
    );
    return { candidates: rows };
  });

// ── Support an existing issue ────────────────────────────────────────────────
export const supportIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string }) =>
    z.object({ issue_id: z.string().uuid(), device_id: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      await query(
        `INSERT INTO public.issue_supporters (issue_id, device_id) VALUES ($1, $2)`,
        [data.issue_id, data.device_id],
      );
    } catch (e: any) {
      if (!e.message?.includes("duplicate") && !e.code?.includes("23505")) throw e;
    }

    const { rows } = await query(
      `SELECT supporters_count FROM public.issues WHERE id = $1`,
      [data.issue_id],
    );
    return { ok: true, supporters: (rows[0] as any)?.supporters_count ?? 0 };
  });

// ── Vote ─────────────────────────────────────────────────────────────────────
export const voteIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string; vote: "exists" | "fixed" }) =>
    z
      .object({
        issue_id: z.string().uuid(),
        device_id: z.string().min(8),
        vote: z.enum(["exists", "fixed"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await query(
      `INSERT INTO public.issue_votes (issue_id, device_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (issue_id, device_id) DO UPDATE SET vote = $3`,
      [data.issue_id, data.device_id, data.vote],
    );

    const { rows: votes } = await query(
      `SELECT vote FROM public.issue_votes WHERE issue_id = $1`,
      [data.issue_id],
    );
    const exists = votes.filter((v: any) => v.vote === "exists").length;
    const fixed = votes.filter((v: any) => v.vote === "fixed").length;
    const total = exists + fixed;

    const { rows: issueRows } = await query(
      `SELECT status FROM public.issues WHERE id = $1`,
      [data.issue_id],
    );
    const issue = issueRows[0] as any;

    if (issue) {
      if (issue.status === "reported" && exists >= 5 && exists / total >= 0.7) {
        await query(
          `UPDATE public.issues SET status = 'community_verified' WHERE id = $1`,
          [data.issue_id],
        );
        await query(
          `INSERT INTO public.issue_status_history (issue_id, status, note, by_admin)
           VALUES ($1, 'community_verified', 'Auto-verified by community (≥70% agreement)', false)`,
          [data.issue_id],
        );
      }
      if (issue.status === "resolved" && fixed >= 5 && fixed / total >= 0.7) {
        await query(
          `UPDATE public.issues SET status = 'community_confirmed' WHERE id = $1`,
          [data.issue_id],
        );
        await query(
          `INSERT INTO public.issue_status_history (issue_id, status, note, by_admin)
           VALUES ($1, 'community_confirmed', 'Community confirmed fix (≥70% agreement)', false)`,
          [data.issue_id],
        );
      }
    }
    return { ok: true, exists, fixed };
  });

// ── Thanks ────────────────────────────────────────────────────────────────────
export const thanksIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string }) =>
    z.object({ issue_id: z.string().uuid(), device_id: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      await query(
        `INSERT INTO public.issue_thanks (issue_id, device_id) VALUES ($1, $2)`,
        [data.issue_id, data.device_id],
      );
    } catch (e: any) {
      if (!e.message?.includes("duplicate") && !e.code?.includes("23505")) throw e;
    }
    const { rows } = await query(
      `SELECT thanked_count FROM public.issues WHERE id = $1`,
      [data.issue_id],
    );
    return { ok: true, thanks: (rows[0] as any)?.thanked_count ?? 0 };
  });

// ── Comment ───────────────────────────────────────────────────────────────────
export const commentIssueFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      issue_id: string;
      device_id: string;
      name?: string | null;
      body: string;
      quick_reply?: "also_saw" | "still_exists" | "already_fixed" | "other" | null;
    }) =>
      z
        .object({
          issue_id: z.string().uuid(),
          device_id: z.string().min(8),
          name: z.string().max(40).optional().nullable(),
          body: z.string().min(1).max(500),
          quick_reply: z
            .enum(["also_saw", "still_exists", "already_fixed", "other"])
            .optional()
            .nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await query(
      `INSERT INTO public.issue_comments (issue_id, device_id, name, body, quick_reply)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.issue_id, data.device_id, data.name ?? null, data.body, data.quick_reply ?? null],
    );
    return { ok: true };
  });

// ── Watch ─────────────────────────────────────────────────────────────────────
export const watchIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string; email?: string | null }) =>
    z
      .object({
        issue_id: z.string().uuid(),
        device_id: z.string().min(8),
        email: z.string().email().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      await query(
        `INSERT INTO public.issue_watchers (issue_id, device_id, email) VALUES ($1, $2, $3)`,
        [data.issue_id, data.device_id, data.email ?? null],
      );
    } catch (e: any) {
      if (!e.message?.includes("duplicate") && !e.code?.includes("23505")) throw e;
    }
    return { ok: true };
  });

// ── Citizen Photo ─────────────────────────────────────────────────────────────
export const addCitizenPhotoFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string; photo_url: string }) =>
    z
      .object({
        issue_id: z.string().uuid(),
        device_id: z.string().min(8),
        photo_url: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await query(
      `INSERT INTO public.issue_status_history
        (issue_id, status, note, photo_url, photo_kind, by_admin, by_device_id)
       VALUES ($1, NULL, 'Current photo added by citizen', $2, 'citizen_after', false, $3)`,
      [data.issue_id, data.photo_url, data.device_id],
    );
    return { ok: true };
  });

// ── Increment View ────────────────────────────────────────────────────────────
export const incrementViewFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string }) => z.object({ issue_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await query(
      `UPDATE public.issues SET views = views + 1 WHERE id = $1`,
      [data.issue_id],
    );
    return { ok: true };
  });
