import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

function service() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(token: string | undefined | null) {
  if (!token) throw new Error("Not authenticated");
  const c = service();
  const { data: userRes } = await c.auth.getUser(token);
  const user = userRes?.user;
  if (!user) throw new Error("Not authenticated");
  const { data: roles } = await c.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "moderator");
  if (!isAdmin) throw new Error("Not authorized");
  return { user };
}

export const adminUpdateIssueFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      access_token: string;
      issue_id: string;
      status?: string | null;
      visibility?: string | null;
      note?: string | null;
      photo_url?: string | null;
      photo_kind?: "report" | "repair" | "citizen_after" | null;
      duplicate_of_id?: string | null;
      assigned_authority_id?: number | null;
      assigned_representative_id?: number | null;
    }) =>
      z
        .object({
          access_token: z.string(),
          issue_id: z.string().uuid(),
          status: z.string().nullable().optional(),
          visibility: z.string().nullable().optional(),
          note: z.string().nullable().optional(),
          photo_url: z.string().url().nullable().optional(),
          photo_kind: z.enum(["report", "repair", "citizen_after"]).nullable().optional(),
          duplicate_of_id: z.string().uuid().nullable().optional(),
          assigned_authority_id: z.number().int().nullable().optional(),
          assigned_representative_id: z.number().int().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.access_token);
    const c = service();
    const patch: TablesUpdate<"issues"> = {};
    if (data.status) patch.status = data.status as Tables<"issues">["status"];
    if (data.visibility) patch.visibility = data.visibility as Tables<"issues">["visibility"];
    if (data.duplicate_of_id !== undefined) patch.duplicate_of_id = data.duplicate_of_id;
    if (data.assigned_authority_id !== undefined)
      patch.assigned_authority_id = data.assigned_authority_id;
    if (data.assigned_representative_id !== undefined)
      patch.assigned_representative_id = data.assigned_representative_id;
    if (Object.keys(patch).length) {
      const { error } = await c.from("issues").update(patch).eq("id", data.issue_id);
      if (error) throw error;
    }
    if (data.status || data.note || data.photo_url) {
      await c.from("issue_status_history").insert({
        issue_id: data.issue_id,
        status: (data.status ?? null) as Tables<"issues">["status"] | null,
        note: data.note ?? null,
        photo_url: data.photo_url ?? null,
        photo_kind: data.photo_kind ?? null,
        by_admin: true,
      });
    }
    return { ok: true };
  });

export const adminPostOfficialFn = createServerFn({ method: "POST" })
  .inputValidator((d: { access_token: string; issue_id: string; body: string }) =>
    z
      .object({
        access_token: z.string(),
        issue_id: z.string().uuid(),
        body: z.string().min(2).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requireAdmin(data.access_token);
    const c = service();
    const { error } = await c.from("issue_official_updates").insert({
      issue_id: data.issue_id,
      body: data.body,
      posted_by: user.id,
    });
    if (error) throw error;
    return { ok: true };
  });

export const adminHideCommentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { access_token: string; comment_id: string; hidden: boolean }) =>
    z
      .object({
        access_token: z.string(),
        comment_id: z.string().uuid(),
        hidden: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.access_token);
    const c = service();
    await c.from("issue_comments").update({ hidden: data.hidden }).eq("id", data.comment_id);
    return { ok: true };
  });

export const adminUpsertAuthorityFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      access_token: string;
      id?: number;
      name: string;
      type?: string | null;
      department?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      website?: string | null;
      jurisdiction?: string | null;
      logo_url?: string | null;
    }) =>
      z
        .object({
          access_token: z.string(),
          id: z.number().int().optional(),
          name: z.string().min(2),
          type: z.string().nullable().optional(),
          department: z.string().nullable().optional(),
          phone: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
          address: z.string().nullable().optional(),
          website: z.string().nullable().optional(),
          jurisdiction: z.string().nullable().optional(),
          logo_url: z.string().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.access_token);
    const c = service();
    const { id, access_token: _t, ...rest } = data;
    if (id) {
      await c.from("authorities").update(rest).eq("id", id);
    } else {
      await c.from("authorities").insert(rest);
    }
    return { ok: true };
  });

export const adminUpsertRuleFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      access_token: string;
      id?: number;
      category_id: number;
      ward_id?: number | null;
      authority_id: number;
      representative_id?: number | null;
      active?: boolean;
    }) =>
      z
        .object({
          access_token: z.string(),
          id: z.number().int().optional(),
          category_id: z.number().int(),
          ward_id: z.number().int().nullable().optional(),
          authority_id: z.number().int(),
          representative_id: z.number().int().nullable().optional(),
          active: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.access_token);
    const c = service();
    const { id, access_token: _t, ...rest } = data;
    if (id) {
      const { data: cur } = await c
        .from("assignment_rules")
        .select("version")
        .eq("id", id)
        .single();
      await c
        .from("assignment_rules")
        .update({ ...rest, version: (cur?.version ?? 1) + 1 })
        .eq("id", id);
    } else {
      await c.from("assignment_rules").insert({ ...rest, version: 1 });
    }
    return { ok: true };
  });
