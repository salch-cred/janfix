import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { resolveIssue } from "@/lib/resolver";

function serverClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL environment variable");
  if (!supabaseKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
  assigned_authority_id: z.number().int().optional().nullable(),
  assigned_representative_id: z.number().int().optional().nullable(),
});

async function signUrl(sb: ReturnType<typeof serverClient>, bucket: string, path: string) {
  const { data } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? "";
}

export const createIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof createIssueInput>) => createIssueInput.parse(d))
  .handler(async ({ data }) => {
    const sb = serverClient();

    // category lookup
    const { data: cat, error: catErr } = await sb
      .from("categories")
      .select("id, slug, name_en")
      .eq("slug", data.category_slug)
      .single();
    if (catErr || !cat) throw new Error("Unknown category");

    let authId = data.assigned_authority_id;
    let repId = data.assigned_representative_id;
    let resolvedWardId = data.ward_id;
    let reason = "Citizen Override";
    let ruleVersion = 1;
    let needsReview = false;
    let jurisdictionConfidence: string | null = null;

    if (!authId || !repId) {
      const resolution = await resolveIssue(sb, {
        category_id: cat.id,
        ward_id: data.ward_id,
        area: data.area,
        locality: data.locality,
        address: data.address,
      });
      if (!authId) authId = resolution.authority_id;
      if (!repId) repId = resolution.representative_id;
      resolvedWardId = resolution.resolved_ward_id ?? data.ward_id ?? null;
      reason = `Category=${cat.name_en}` + (resolution.reason ? `, ${resolution.reason}` : "");
      ruleVersion = resolution.version;
      needsReview = resolution.needs_review ?? false;
      jurisdictionConfidence = resolution.jurisdiction_confidence ?? null;
    }

    // public id
    const { data: pidRow, error: pidErr } = await sb.rpc("next_public_id");
    if (pidErr || !pidRow) throw new Error("Could not allocate ID");
    const public_id = pidRow as unknown as string;

    const slug = data.description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 50);

    const image_url = await signUrl(sb, "issue-photos", data.image_path);

    const { data: ins, error: insErr } = await sb
      .from("issues")
      .insert({
        public_id,
        slug,
        category_id: cat.id,
        description: data.description,
        severity: data.severity,
        lat: data.lat,
        lng: data.lng,
        address: data.address ?? null,
        area: data.area ?? null,
        locality: data.locality ?? null,
        pincode: data.pincode ?? null,
        ward_id: resolvedWardId,
        image_url,
        image_phash: data.image_phash ?? null,
        device_id: data.device_id,
        assigned_authority_id: authId,
        assigned_representative_id: repId,
        assignment_reason: reason,
        assignment_rule_version: ruleVersion,
        needs_review: needsReview,
        jurisdiction_confidence: jurisdictionConfidence,
      })
      .select("id, public_id, slug")
      .single();
    if (insErr || !ins) throw new Error(insErr?.message ?? "Failed to create");

    const { error: histErr } = await sb.from("issue_status_history").insert({
      issue_id: ins.id,
      status: "reported",
      note: "Issue reported by citizen",
      photo_url: image_url,
      photo_kind: "report",
      by_admin: false,
      by_device_id: data.device_id,
    });
    if (histErr) throw histErr;

    // Optional extra photos beyond the required primary one.
    const extraPaths = (data.extra_image_paths ?? []).slice(0, 4);
    if (extraPaths.length > 0) {
      const extraRows = await Promise.all(
        extraPaths.map(async (p, idx) => ({
          issue_id: ins.id,
          url: await signUrl(sb, "issue-photos", p),
          path: p,
          position: idx + 1,
        })),
      );
      const { error: extraErr } = await sb.from("issue_photos").insert(extraRows);
      if (extraErr) throw extraErr;
    }

    return { public_id: ins.public_id, slug: ins.slug ?? "" };
  });

// Duplicate detection
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
    const sb = serverClient();
    const { data: rows, error } = await sb.rpc("find_duplicate_issues", {
      p_category_slug: data.category_slug,
      p_lat: data.lat,
      p_lng: data.lng,
      p_desc: data.description,
      p_phash: data.image_phash || null,
      p_radius_deg: 0.002, // Look within ~220m radius
    });
    if (error) throw error;

    return {
      candidates: (rows ?? []).map((r: any) => ({
        ...r,
        _score: Number(r.similarity_score ?? 0),
        _meters: Number(r.distance_meters ?? 0),
      })),
    };
  });

// Support an existing issue
export const supportIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string }) =>
    z.object({ issue_id: z.string().uuid(), device_id: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = serverClient();
    const { error } = await sb
      .from("issue_supporters")
      .insert({ issue_id: data.issue_id, device_id: data.device_id });
    if (error && !error.message.includes("duplicate")) throw error;
    
    // Count is automatically updated on the issues table by DB triggers.
    // Query it from the issues table to return the correct count.
    const { data: issueRow, error: getErr } = await sb
      .from("issues")
      .select("supporters_count")
      .eq("id", data.issue_id)
      .single();
    if (getErr) throw getErr;

    return { ok: true, supporters: issueRow?.supporters_count ?? 0 };
  });

// Vote
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
    const sb = serverClient();
    const { data: res, error } = await sb.rpc("vote_issue", {
      p_issue_id: data.issue_id,
      p_device_id: data.device_id,
      p_vote: data.vote,
    });
    if (error) throw error;

    const row = (res as any)?.[0] || { exists_count: 0, fixed_count: 0 };
    const exists = Number(row.exists_count ?? 0);
    const fixed = Number(row.fixed_count ?? 0);

    return { ok: true, exists, fixed };
  });

export const thanksIssueFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string; device_id: string }) =>
    z.object({ issue_id: z.string().uuid(), device_id: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = serverClient();
    const { error } = await sb.from("issue_thanks").insert({
      issue_id: data.issue_id,
      device_id: data.device_id,
    });
    if (error && !error.message.includes("duplicate")) throw error;

    // Count is automatically updated on the issues table by DB triggers.
    // Query it from the issues table to return the correct count.
    const { data: issueRow, error: getErr } = await sb
      .from("issues")
      .select("thanked_count")
      .eq("id", data.issue_id)
      .single();
    if (getErr) throw getErr;

    return { ok: true, thanks: issueRow?.thanked_count ?? 0 };
  });

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
    const sb = serverClient();
    const { error } = await sb.from("issue_comments").insert({
      issue_id: data.issue_id,
      device_id: data.device_id,
      name: data.name ?? null,
      body: data.body,
      quick_reply: data.quick_reply ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

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
    const sb = serverClient();
    const { error } = await sb.from("issue_watchers").insert({
      issue_id: data.issue_id,
      device_id: data.device_id,
      email: data.email ?? null,
    });
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

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
    const sb = serverClient();
    const { error } = await sb.from("issue_status_history").insert({
      issue_id: data.issue_id,
      status: null,
      note: "Current photo added by citizen",
      photo_url: data.photo_url,
      photo_kind: "citizen_after",
      by_admin: false,
      by_device_id: data.device_id,
    });
    if (error) throw error;
    return { ok: true };
  });

export const incrementViewFn = createServerFn({ method: "POST" })
  .inputValidator((d: { issue_id: string }) => z.object({ issue_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = serverClient();
    const { error } = await sb.rpc("increment_issue_views", { issue_id: data.issue_id });
    if (error) throw error;
    return { ok: true };
  });

export const previewAssignmentFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    category_slug: string;
    lat: number;
    lng: number;
    address?: string | null;
    area?: string | null;
    locality?: string | null;
    ward_id?: number | null;
  }) =>
    z
      .object({
        category_slug: z.string(),
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional().nullable(),
        area: z.string().optional().nullable(),
        locality: z.string().optional().nullable(),
        ward_id: z.number().int().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = serverClient();

    // category lookup
    const { data: cat } = await sb
      .from("categories")
      .select("id, slug, name_en")
      .eq("slug", data.category_slug)
      .single();
    if (!cat) throw new Error("Unknown category");

    const resolution = await resolveIssue(sb, {
      category_id: cat.id,
      ward_id: data.ward_id,
      area: data.area,
      locality: data.locality,
      address: data.address,
    });

    const [authRes, repRes] = await Promise.all([
      resolution.authority_id
        ? sb.from("authorities").select("id, name, department, logo_url").eq("id", resolution.authority_id).single()
        : Promise.resolve({ data: null }),
      resolution.representative_id
        ? sb.from("representatives").select("id, name, role, photo_url").eq("id", resolution.representative_id).single()
        : Promise.resolve({ data: null }),
    ]);

    return {
      authority: authRes.data,
      representative: repRes.data,
      resolved_ward_id: resolution.resolved_ward_id,
      reason: resolution.reason,
    };
  });
