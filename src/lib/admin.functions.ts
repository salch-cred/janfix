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
					status: z.enum(["reported", "community_verified", "assigned", "work_started", "resolved", "community_confirmed", "closed"]).nullable().optional(),
					visibility: z.enum(["visible", "hidden", "duplicate", "spam"]).nullable().optional(),
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
		if (data.status !== undefined) patch.status = data.status as Tables<"issues">["status"];
		if (data.visibility !== undefined) patch.visibility = data.visibility as Tables<"issues">["visibility"];
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
			const { error: histErr } = await c.from("issue_status_history").insert({
				issue_id: data.issue_id,
				status: (data.status ?? null) as Tables<"issues">["status"] | null,
				note: data.note ?? null,
				photo_url: data.photo_url ?? null,
				photo_kind: data.photo_kind ?? null,
				by_admin: true,
			});
			if (histErr) throw histErr;
		}
		return { ok: true };
	});

// Permanently deletes an issue/report and all of its dependent rows (votes,
// supporters, thanks, comments, status history, official updates, watchers,
// photos cascade via FK ON DELETE CASCADE at the DB level). Admin/moderator
// only. Uses the service-role client because the anon/authenticated Postgres
// role has no DELETE grant on public.issues -- only service_role can delete.
export const adminDeleteIssueFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; issue_id: string }) =>
		z
			.object({
				access_token: z.string(),
				issue_id: z.string().uuid(),
			})
			.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("issues").delete().eq("id", data.issue_id);
		if (error) throw error;
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
		const { error } = await c.from("issue_comments").update({ hidden: data.hidden }).eq("id", data.comment_id);
		if (error) throw error;
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
			const { error } = await c.from("authorities").update(rest).eq("id", id);
			if (error) throw error;
		} else {
			const { error } = await c.from("authorities").insert(rest);
			if (error) throw error;
		}
		return { ok: true };
	});

// Deletes an authority. Uses the service-role client for the same reason as
// adminDeleteIssueFn: public.authorities has no DELETE grant for the
// anon/authenticated Postgres role, so a direct client-side
// supabase.from("authorities").delete() call always fails with a permission
// error, even for a logged-in admin. If the authority is still referenced by
// an existing issue or assignment rule, the database's foreign key
// constraint will reject the delete -- reassign or remove those first.
export const adminDeleteAuthorityFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z
			.object({
				access_token: z.string(),
				id: z.number().int(),
			})
			.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("authorities").delete().eq("id", data.id);
		if (error) throw error;
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
			const { error } = await c
				.from("assignment_rules")
				.update({ ...rest, version: (cur?.version ?? 1) + 1 })
				.eq("id", id);
			if (error) throw error;
		} else {
			const { error } = await c.from("assignment_rules").insert({ ...rest, version: 1 });
			if (error) throw error;
		}
		return { ok: true };
	});

// Deletes an assignment rule. Service-role client for the usual permission
// reason.
export const adminDeleteRuleFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("assignment_rules").delete().eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});

// Admin-only listing of assignment rules with resolved names for display.
export const adminListRulesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { data: rows, error } = await c
			.from("assignment_rules")
			.select(
				"*, category:categories(id, name_en), ward:wards(id, number, name), authority:authorities(id, name), representative:representatives(id, name)",
			)
			.order("id");
		if (error) throw error;
		return rows ?? [];
	});

// Admin-only listing of scope-aware jurisdiction rules (see the governance
// knowledge base) with resolved names for display. Unlike assignment_rules
// (ward-specific), these are keyed by category + scope (mcc / rural / state
// highway / national highway / any) and only apply as a fallback when no
// ward-specific assignment_rules row matches.
export const adminListJurisdictionRulesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { data: rows, error } = await c
			.from("jurisdiction_rules")
			.select(
				"*, category:categories(id, name_en), taluk:taluks(id, name), authority:authorities(id, name)",
			)
			.order("category_id")
			.order("priority", { ascending: false });
		if (error) throw error;
		return rows ?? [];
	});

export const adminUpsertJurisdictionRuleFn = createServerFn({ method: "POST" })
	.inputValidator(
		(d: {
			access_token: string;
			id?: number;
			category_id: number;
			scope_type: string;
			taluk_id?: number | null;
			authority_id?: number | null;
			confidence?: string;
			notes?: string | null;
			priority?: number;
			active?: boolean;
		}) =>
			z
				.object({
					access_token: z.string(),
					id: z.number().int().optional(),
					category_id: z.number().int(),
					scope_type: z.enum(["mcc", "rural", "state_highway", "national_highway", "any"]),
					taluk_id: z.number().int().nullable().optional(),
					authority_id: z.number().int().nullable().optional(),
					confidence: z.enum(["high", "medium", "low"]).optional(),
					notes: z.string().nullable().optional(),
					priority: z.number().int().optional(),
					active: z.boolean().optional(),
				})
				.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const { error } = await c.from("jurisdiction_rules").update(rest).eq("id", id);
			if (error) throw error;
		} else {
			const { error } = await c.from("jurisdiction_rules").insert(rest);
			if (error) throw error;
		}
		return { ok: true };
	});

// Deletes a jurisdiction rule. Service-role client for the usual permission
// reason.
export const adminDeleteJurisdictionRuleFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("jurisdiction_rules").delete().eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});

// Admin-only listing of ALL representatives (including inactive ones and
// Corporator placeholders), unlike the public listRepresentativesFn which
// filters those out for citizen-facing display.
export const adminListRepresentativesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { data: rows, error } = await c
			.from("representatives")
			.select("*, authority:authorities(id, name), ward:wards(id, number, name)")
			.order("name");
		if (error) throw error;
		return rows ?? [];
	});

export const adminUpsertRepresentativeFn = createServerFn({ method: "POST" })
	.inputValidator(
		(d: {
			access_token: string;
			id?: number;
			name: string;
			role: string;
			phone?: string | null;
			email?: string | null;
			photo_url?: string | null;
			constituency?: string | null;
			city?: string | null;
			authority_id?: number | null;
			ward_id?: number | null;
			active?: boolean;
		}) =>
			z
				.object({
					access_token: z.string(),
					id: z.number().int().optional(),
					name: z.string().min(2),
					role: z.string().min(2),
					phone: z.string().nullable().optional(),
					email: z.string().nullable().optional(),
					photo_url: z.string().nullable().optional(),
					constituency: z.string().nullable().optional(),
					city: z.string().nullable().optional(),
					authority_id: z.number().int().nullable().optional(),
					ward_id: z.number().int().nullable().optional(),
					active: z.boolean().optional(),
				})
				.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const { error } = await c.from("representatives").update(rest).eq("id", id);
			if (error) throw error;
		} else {
			const { error } = await c.from("representatives").insert(rest);
			if (error) throw error;
		}
		return { ok: true };
	});

// Deletes a representative. Service-role client for the usual permission
// reason. representatives is referenced by issues.assigned_representative_id
// (ON DELETE SET NULL, safe) and assignment_rules.representative_id (hard
// FK) -- remove/reassign any rules referencing this representative first if
// the delete fails.
export const adminDeleteRepresentativeFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("representatives").delete().eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});

export const adminUpsertWardFn = createServerFn({ method: "POST" })
	.inputValidator(
		(d: { access_token: string; id?: number; number: number; name: string; area?: string | null }) =>
			z
				.object({
					access_token: z.string(),
					id: z.number().int().optional(),
					number: z.number().int(),
					name: z.string().min(1),
					area: z.string().nullable().optional(),
				})
				.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const { error } = await c.from("wards").update(rest).eq("id", id);
			if (error) throw error;
		} else {
			const { error } = await c.from("wards").insert(rest);
			if (error) throw error;
		}
		return { ok: true };
	});

// Deletes a ward. Service-role client for the usual permission reason.
// wards is referenced by issues.ward_id (ON DELETE SET NULL, safe),
// representatives.ward_id (ON DELETE SET NULL, safe), and
// assignment_rules.ward_id (hard FK) -- remove/reassign any rules
// referencing this ward first if the delete fails.
export const adminDeleteWardFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("wards").delete().eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});

export const adminUpsertCategoryFn = createServerFn({ method: "POST" })
	.inputValidator(
		(d: {
			access_token: string;
			id?: number;
			slug: string;
			name_en: string;
			name_kn?: string | null;
			icon?: string | null;
			color?: string | null;
			sort_order?: number | null;
		}) =>
			z
				.object({
					access_token: z.string(),
					id: z.number().int().optional(),
					slug: z.string().min(1),
					name_en: z.string().min(1),
					name_kn: z.string().nullable().optional(),
					icon: z.string().nullable().optional(),
					color: z.string().nullable().optional(),
					sort_order: z.number().int().nullable().optional(),
				})
				.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const { error } = await c.from("categories").update(rest).eq("id", id);
			if (error) throw error;
		} else {
			const { error } = await c.from("categories").insert(rest);
			if (error) throw error;
		}
		return { ok: true };
	});

// Deletes a category. Service-role client for the usual permission reason.
// categories is referenced by issues.category_id and
// assignment_rules.category_id (both hard FKs) -- the delete will be
// rejected if any report or rule still uses this category.
export const adminDeleteCategoryFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("categories").delete().eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});

// Admin-only listing of reporting devices. JanFix has no citizen account
// system -- reporters are tracked only by an anonymous on-device ID stored
// in public.devices. This aggregates activity (reports filed, votes cast,
// thanks given, supporters given, comments posted) per device for the
// admin "Reporters" page.
export const adminListDevicesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; q?: string; limit?: number }) =>
		z
			.object({
				access_token: z.string(),
				q: z.string().optional(),
				limit: z.number().int().min(1).max(500).optional(),
			})
			.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		let q = c.from("devices").select("*").order("last_seen", { ascending: false }).limit(data.limit ?? 200);
		if (data.q) q = q.ilike("device_id", `%${data.q}%`);
		const { data: devices, error } = await q;
		if (error) throw error;
		const ids = (devices ?? []).map((d) => d.device_id);
		if (!ids.length) return [];

		const [issuesRes, votesRes, thanksRes, supportersRes, commentsRes] = await Promise.all([
			c.from("issues").select("device_id, status").in("device_id", ids),
			c.from("issue_votes").select("device_id").in("device_id", ids),
			c.from("issue_thanks").select("device_id").in("device_id", ids),
			c.from("issue_supporters").select("device_id").in("device_id", ids),
			c.from("issue_comments").select("device_id").in("device_id", ids),
		]);
		if (issuesRes.error) throw issuesRes.error;
		if (votesRes.error) throw votesRes.error;
		if (thanksRes.error) throw thanksRes.error;
		if (supportersRes.error) throw supportersRes.error;
		if (commentsRes.error) throw commentsRes.error;

		const countFor = (rows: { device_id: string | null }[] | null, id: string) =>
			(rows ?? []).filter((r) => r.device_id === id).length;
		const resolvedStatuses = ["resolved", "community_confirmed", "closed"];

		return (devices ?? []).map((d) => {
			const mine = (issuesRes.data ?? []).filter((i) => i.device_id === d.device_id);
			const resolved = mine.filter((i) => resolvedStatuses.includes(i.status as string));
			return {
				...d,
				reports_total: mine.length,
				reports_resolved: resolved.length,
				votes_cast: countFor(votesRes.data, d.device_id),
				thanks_given: countFor(thanksRes.data, d.device_id),
				supporters_given: countFor(supportersRes.data, d.device_id),
				comments_posted: countFor(commentsRes.data, d.device_id),
			};
		});
	});

// Admin-only full detail for a single report: the raw issue row (regardless
// of visibility), plus photos, status history, official updates, comments,
// vote/thanks/supporter tallies, and watcher count. Powers the "View
// details" panel on the admin Issues page.
export const adminGetIssueDetailFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; issue_id: string }) =>
		z
			.object({
				access_token: z.string(),
				issue_id: z.string().uuid(),
			})
			.parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { data: row, error } = await c
			.from("issues")
			.select(
				`*, category:categories(*), authority:authorities!issues_assigned_authority_id_fkey(*), representative:representatives!issues_assigned_representative_id_fkey(*), ward:wards(*)`,
			)
			.eq("id", data.issue_id)
			.maybeSingle();
		if (error) throw error;
		if (!row) return null;

		const [history, official, comments, votes, thanks, supporters, watchers, photos] = await Promise.all([
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
				.order("created_at", { ascending: false }),
			c.from("issue_votes").select("vote").eq("issue_id", row.id),
			c.from("issue_thanks").select("device_id", { count: "exact", head: true }).eq("issue_id", row.id),
			c.from("issue_supporters").select("device_id", { count: "exact", head: true }).eq("issue_id", row.id),
			c.from("issue_watchers").select("device_id", { count: "exact", head: true }).eq("issue_id", row.id),
			c
				.from("issue_photos")
				.select("*")
				.eq("issue_id", row.id)
				.order("position", { ascending: true }),
		]);
		if (history.error) throw history.error;
		if (official.error) throw official.error;
		if (comments.error) throw comments.error;
		if (votes.error) throw votes.error;
		if (photos.error) throw photos.error;

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
			thanks: thanks.count ?? 0,
			supporters: supporters.count ?? 0,
			watchers: watchers.count ?? 0,
		};
	});

// Admin-only deeper analytics: breakdowns by category, ward, status,
// severity, authority, and visibility, plus a daily report-count trend for
// the last 30 days. Unlike the public analyticsFn summary card, this is not
// restricted to visible issues -- admins should be able to see hidden/spam/
// duplicate volume too.
export const adminAnalyticsDetailFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { data: rows, error } = await c
			.from("issues")
			.select(
				"status, severity, visibility, ward_id, category_id, created_at, updated_at, assigned_authority_id, category:categories(name_en), ward:wards(number, name), authority:authorities!issues_assigned_authority_id_fkey(name)",
			);
		if (error) throw error;
		const list = (rows ?? []) as any[];

		const byCategory = new Map<string, number>();
		const byWard = new Map<string, number>();
		const byStatus = new Map<string, number>();
		const bySeverity = new Map<string, number>();
		const byAuthority = new Map<string, number>();
		const byVisibility = new Map<string, number>();

		const bump = (map: Map<string, number>, key: string | null | undefined) => {
			const k = key ?? "Unassigned";
			map.set(k, (map.get(k) ?? 0) + 1);
		};

		list.forEach((r) => {
			bump(byCategory, r.category?.name_en);
			bump(byWard, r.ward ? `Ward ${r.ward.number}` : null);
			bump(byStatus, r.status);
			bump(bySeverity, r.severity);
			bump(byAuthority, r.authority?.name);
			bump(byVisibility, r.visibility);
		});

		const toSorted = (map: Map<string, number>) =>
			Array.from(map.entries())
				.map(([name, count]) => ({ name, count }))
				.sort((a, b) => b.count - a.count);

		// Daily report-creation trend for the last 30 days.
		const days: { date: string; count: number }[] = [];
		const dayMs = 86400000;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (let i = 29; i >= 0; i--) {
			const d = new Date(today.getTime() - i * dayMs);
			days.push({ date: d.toISOString().slice(0, 10), count: 0 });
		}
		const dayIndex = new Map(days.map((d, idx) => [d.date, idx]));
		list.forEach((r) => {
			const key = String(r.created_at).slice(0, 10);
			const idx = dayIndex.get(key);
			if (idx !== undefined) days[idx].count += 1;
		});

		return {
			by_category: toSorted(byCategory),
			by_ward: toSorted(byWard),
			by_status: toSorted(byStatus),
			by_severity: toSorted(bySeverity),
			by_authority: toSorted(byAuthority),
			by_visibility: toSorted(byVisibility),
			daily_trend: days,
		};
	});

// Admin-only listing of citizen feedback submitted via the site footer form.
export const adminListFeedbackFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { data: rows, error } = await c
			.from("feedback")
			.select("*")
			.order("created_at", { ascending: false });
		if (error) throw error;
		return rows ?? [];
	});

// Marks a feedback submission as read/unread for admin triage.
export const adminMarkFeedbackReadFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: string; read: boolean }) =>
		z.object({ access_token: z.string(), id: z.string().uuid(), read: z.boolean() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c
			.from("feedback")
			.update({ read_at: data.read ? new Date().toISOString() : null })
			.eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});

// Deletes a feedback submission. Service-role client for the usual permission reason.
export const adminDeleteFeedbackFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: string }) =>
		z.object({ access_token: z.string(), id: z.string().uuid() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const c = service();
		const { error } = await c.from("feedback").delete().eq("id", data.id);
		if (error) throw error;
		return { ok: true };
	});
