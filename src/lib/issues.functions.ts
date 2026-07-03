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
  // Up to 4 optional additional photos, uploaded to storage by the caller;
  // these are stored in issue_photos alongside the required primary photo.
  extra_image_paths: z.array(z.string().min(3)).max(4).optional().nullable(),
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

    // Resolve authority + representative via layered engine
    const resolution = await resolveIssue(sb, {
      category_id: cat.id,
      ward_id: data.ward_id,
      area: data.area,
      locality: data.locality,
      address: data.address,
    });

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

    const reason = `Category=${cat.name_en}` + (resolution.reason ? `, ${resolution.reason}` : "");

    // upsert device + increment count
    const { error: devUpsertErr } = await sb
      .from("devices")
      .upsert(
        { device_id: data.device_id, last_seen: new Date().toISOString() },
        { onConflict: "device_id" },
      );
    if (devUpsertErr) throw devUpsertErr;

    const { data: dev, error: devSelErr } = await sb
      .from("devices")
      .select("report_count")
      .eq("device_id", data.device_id)
      .single();
    if (devSelErr) throw devSelErr;

    const { error: devUpdErr } = await sb
      .from("devices")
      .update({
        report_count: (dev?.report_count ?? 0) + 1,
        last_seen: new Date().toISOString(),
      })
      .eq("device_id", data.device_id);
    if (devUpdErr) throw devUpdErr;

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
        ward_id: resolution.resolved_ward_id ?? data.ward_id ?? null,
        image_url,
        image_phash: data.image_phash ?? null,
        device_id: data.device_id,
        assigned_authority_id: resolution.authority_id,
        assigned_representative_id: resolution.representative_id,
        assignment_reason: reason,
        assignment_rule_version: resolution.version,
        needs_review: resolution.needs_review ?? false,
        jurisdiction_confidence: resolution.jurisdiction_confidence ?? null,
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
    const { data: cat } = await sb
      .from("categories")
      .select("id")
      .eq("slug", data.category_slug)
      .single();
    if (!cat) return { candidates: [] };

    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    // bounding box ~0.0005 deg = ~55 m
    const delta = 0.0006;
    const { data: rows } = await sb
      .from("issues")
      .select(
        "id, public_id, slug, description, lat, lng, image_phash, image_url, created_at, status, supporters_count",
      )
      .eq("category_id", cat.id)
      .eq("visibility", "visible")
      .gte("created_at", since)
      .gte("lat", data.lat - delta)
      .lte("lat", data.lat + delta)
      .gte("lng", data.lng - delta)
      .lte("lng", data.lng + delta)
      .limit(10);
    return { candidates: rows ?? [] };
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
    await sb.from("issue_votes").upsert(
      {
        issue_id: data.issue_id,
        device_id: data.device_id,
        vote: data.vote,
      },
      { onConflict: "issue_id,device_id" },
    );

    // auto status flips
    const { data: votes } = await sb
      .from("issue_votes")
      .select("vote")
      .eq("issue_id", data.issue_id);
    const exists = votes?.filter((v) => v.vote === "exists").length ?? 0;
    const fixed = votes?.filter((v) => v.vote === "fixed").length ?? 0;
    const total = exists + fixed;

    const { data: issue } = await sb
      .from("issues")
      .select("status")
      .eq("id", data.issue_id)
      .single();

    if (issue) {
      if (issue.status === "reported" && exists >= 5 && exists / total >= 0.7) {
        await sb.from("issues").update({ status: "community_verified" }).eq("id", data.issue_id);
        await sb.from("issue_status_history").insert({
          issue_id: data.issue_id,
          status: "community_verified",
          note: "Auto-verified by community (≥70% agreement)",
          by_admin: false,
        });
      }
      if (issue.status === "resolved" && fixed >= 5 && fixed / total >= 0.7) {
        await sb.from("issues").update({ status: "community_confirmed" }).eq("id", data.issue_id);
        await sb.from("issue_status_history").insert({
          issue_id: data.issue_id,
          status: "community_confirmed",
          note: "Community confirmed fix (≥70% agreement)",
          by_admin: false,
        });
      }
    }
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
