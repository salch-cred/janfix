import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/admin.auth";
import { query } from "@/lib/db";

// ── Simple HMAC token auth — no Supabase required ───────────────────────────
function requireAdmin(token: string | undefined | null) {
	if (!verifyAdminToken(token)) throw new Error("Not authenticated");
}

// ─────────────────────────────────────────────────────────────────────────────

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

		const setClauses: string[] = [];
		const params: any[] = [];
		let pi = 1;

		if (data.status !== undefined) { setClauses.push(`status = $${pi++}`); params.push(data.status); }
		if (data.visibility !== undefined) { setClauses.push(`visibility = $${pi++}`); params.push(data.visibility); }
		if (data.duplicate_of_id !== undefined) { setClauses.push(`duplicate_of_id = $${pi++}`); params.push(data.duplicate_of_id); }
		if (data.assigned_authority_id !== undefined) { setClauses.push(`assigned_authority_id = $${pi++}`); params.push(data.assigned_authority_id); }
		if (data.assigned_representative_id !== undefined) { setClauses.push(`assigned_representative_id = $${pi++}`); params.push(data.assigned_representative_id); }

		if (setClauses.length) {
			params.push(data.issue_id);
			await query(
				`UPDATE public.issues SET ${setClauses.join(", ")} WHERE id = $${pi}`,
				params,
			);
		}
		if (data.status || data.note || data.photo_url) {
			await query(
				`INSERT INTO public.issue_status_history (issue_id, status, note, photo_url, photo_kind, by_admin)
         VALUES ($1, $2, $3, $4, $5, true)`,
				[data.issue_id, data.status ?? null, data.note ?? null, data.photo_url ?? null, data.photo_kind ?? null],
			);
		}
		return { ok: true };
	});

// Permanently deletes an issue/report and all dependent rows.
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
		await query(`DELETE FROM public.issues WHERE id = $1`, [data.issue_id]);
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
		await query(
			`INSERT INTO public.issue_official_updates (issue_id, body, posted_by) VALUES ($1, $2, $3)`,
			[data.issue_id, data.body, user.id],
		);
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
		await query(
			`UPDATE public.issue_comments SET hidden = $1 WHERE id = $2`,
			[data.hidden, data.comment_id],
		);
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
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
			await query(
				`UPDATE public.authorities SET ${setClauses} WHERE id = $${keys.length + 1}`,
				[...keys.map((k) => rest[k]), id],
			);
		} else {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const cols = keys.join(", ");
			const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
			await query(
				`INSERT INTO public.authorities (${cols}) VALUES (${vals})`,
				keys.map((k) => rest[k]),
			);
		}
		return { ok: true };
	});

// Deletes an authority. If still referenced by an issue or assignment rule,
// the database's FK constraint will reject the delete.
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
		await query(`DELETE FROM public.authorities WHERE id = $1`, [data.id]);
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
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const { rows: cur } = await query<{ version: number }>(
				`SELECT version FROM public.assignment_rules WHERE id = $1`,
				[id],
			);
			const newVersion = (cur[0]?.version ?? 1) + 1;
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const setClauses = [...keys.map((k, i) => `${k} = $${i + 1}`), `version = $${keys.length + 1}`].join(", ");
			await query(
				`UPDATE public.assignment_rules SET ${setClauses} WHERE id = $${keys.length + 2}`,
				[...keys.map((k) => rest[k]), newVersion, id],
			);
		} else {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const cols = [...keys, "version"].join(", ");
			const vals = keys.map((_, i) => `$${i + 1}`).join(", ") + `, 1`;
			await query(
				`INSERT INTO public.assignment_rules (${cols}) VALUES (${vals})`,
				keys.map((k) => rest[k]),
			);
		}
		return { ok: true };
	});

// Deletes an assignment rule.
export const adminDeleteRuleFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(`DELETE FROM public.assignment_rules WHERE id = $1`, [data.id]);
		return { ok: true };
	});

// Admin-only listing of assignment rules with resolved names for display.
export const adminListRulesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const { rows } = await query(
			`SELECT ar.*,
        json_build_object('id', c.id, 'name_en', c.name_en) AS category,
        CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'number', w.number, 'name', w.name) ELSE NULL END AS ward,
        json_build_object('id', a.id, 'name', a.name) AS authority,
        CASE WHEN r.id IS NOT NULL THEN json_build_object('id', r.id, 'name', r.name) ELSE NULL END AS representative
       FROM public.assignment_rules ar
       LEFT JOIN public.categories c ON c.id = ar.category_id
       LEFT JOIN public.wards w ON w.id = ar.ward_id
       LEFT JOIN public.authorities a ON a.id = ar.authority_id
       LEFT JOIN public.representatives r ON r.id = ar.representative_id
       ORDER BY ar.id`,
		);
		return rows;
	});

// Admin-only listing of scope-aware jurisdiction rules.
export const adminListJurisdictionRulesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const { rows } = await query(
			`SELECT jr.*,
        json_build_object('id', c.id, 'name_en', c.name_en) AS category,
        CASE WHEN t.id IS NOT NULL THEN json_build_object('id', t.id, 'name', t.name) ELSE NULL END AS taluk,
        CASE WHEN a.id IS NOT NULL THEN json_build_object('id', a.id, 'name', a.name) ELSE NULL END AS authority
       FROM public.jurisdiction_rules jr
       LEFT JOIN public.categories c ON c.id = jr.category_id
       LEFT JOIN public.taluks t ON t.id = jr.taluk_id
       LEFT JOIN public.authorities a ON a.id = jr.authority_id
       ORDER BY jr.category_id, jr.priority DESC`,
		);
		return rows;
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
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
			await query(
				`UPDATE public.jurisdiction_rules SET ${setClauses} WHERE id = $${keys.length + 1}`,
				[...keys.map((k) => rest[k]), id],
			);
		} else {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const cols = keys.join(", ");
			const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
			await query(
				`INSERT INTO public.jurisdiction_rules (${cols}) VALUES (${vals})`,
				keys.map((k) => rest[k]),
			);
		}
		return { ok: true };
	});

// Deletes a jurisdiction rule.
export const adminDeleteJurisdictionRuleFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(`DELETE FROM public.jurisdiction_rules WHERE id = $1`, [data.id]);
		return { ok: true };
	});

// Admin-only listing of ALL representatives.
export const adminListRepresentativesFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const { rows } = await query(
			`SELECT r.*,
        json_build_object('id', a.id, 'name', a.name) AS authority,
        CASE WHEN w.id IS NOT NULL THEN json_build_object('id', w.id, 'number', w.number, 'name', w.name) ELSE NULL END AS ward
       FROM public.representatives r
       LEFT JOIN public.authorities a ON a.id = r.authority_id
       LEFT JOIN public.wards w ON w.id = r.ward_id
       ORDER BY r.name`,
		);
		return rows;
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
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
			await query(
				`UPDATE public.representatives SET ${setClauses} WHERE id = $${keys.length + 1}`,
				[...keys.map((k) => rest[k]), id],
			);
		} else {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const cols = keys.join(", ");
			const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
			await query(
				`INSERT INTO public.representatives (${cols}) VALUES (${vals})`,
				keys.map((k) => rest[k]),
			);
		}
		return { ok: true };
	});

// Deletes a representative. representatives.ward_id is ON DELETE SET NULL.
export const adminDeleteRepresentativeFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(`DELETE FROM public.representatives WHERE id = $1`, [data.id]);
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
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
			await query(
				`UPDATE public.wards SET ${setClauses} WHERE id = $${keys.length + 1}`,
				[...keys.map((k) => rest[k]), id],
			);
		} else {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const cols = keys.join(", ");
			const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
			await query(
				`INSERT INTO public.wards (${cols}) VALUES (${vals})`,
				keys.map((k) => rest[k]),
			);
		}
		return { ok: true };
	});

// Deletes a ward. wards.assignment_rules.ward_id is a hard FK — remove rules first.
export const adminDeleteWardFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(`DELETE FROM public.wards WHERE id = $1`, [data.id]);
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
		const { id, access_token: _t, ...rest } = data;
		if (id) {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
			await query(
				`UPDATE public.categories SET ${setClauses} WHERE id = $${keys.length + 1}`,
				[...keys.map((k) => rest[k]), id],
			);
		} else {
			const keys = Object.keys(rest) as (keyof typeof rest)[];
			const cols = keys.join(", ");
			const vals = keys.map((_, i) => `$${i + 1}`).join(", ");
			await query(
				`INSERT INTO public.categories (${cols}) VALUES (${vals})`,
				keys.map((k) => rest[k]),
			);
		}
		return { ok: true };
	});

// Deletes a category. Hard FK from issues + assignment_rules — reassign first.
export const adminDeleteCategoryFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: number }) =>
		z.object({ access_token: z.string(), id: z.number().int() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(`DELETE FROM public.categories WHERE id = $1`, [data.id]);
		return { ok: true };
	});

// Admin-only listing of reporting devices with activity aggregates.
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

		const params: any[] = [data.limit ?? 200];
		let deviceSql = `SELECT * FROM public.devices ORDER BY last_seen DESC LIMIT $1`;
		if (data.q) {
			params.push(`%${data.q}%`);
			deviceSql = `SELECT * FROM public.devices WHERE device_id ILIKE $2 ORDER BY last_seen DESC LIMIT $1`;
		}
		const { rows: devices } = await query(deviceSql, params);
		const ids = devices.map((d: any) => d.device_id);
		if (!ids.length) return [];

		const placeholder = ids.map((_: any, i: number) => `$${i + 1}`).join(", ");

		const [issuesRes, votesRes, thanksRes, supportersRes, commentsRes] = await Promise.all([
			query(`SELECT device_id, status FROM public.issues WHERE device_id IN (${placeholder})`, ids),
			query(`SELECT device_id FROM public.issue_votes WHERE device_id IN (${placeholder})`, ids),
			query(`SELECT device_id FROM public.issue_thanks WHERE device_id IN (${placeholder})`, ids),
			query(`SELECT device_id FROM public.issue_supporters WHERE device_id IN (${placeholder})`, ids),
			query(`SELECT device_id FROM public.issue_comments WHERE device_id IN (${placeholder})`, ids),
		]);

		const countFor = (rows: { device_id: string | null }[], id: string) =>
			rows.filter((r) => r.device_id === id).length;
		const resolvedStatuses = ["resolved", "community_confirmed", "closed"];

		return devices.map((d: any) => {
			const mine = issuesRes.rows.filter((i: any) => i.device_id === d.device_id);
			const resolved = mine.filter((i: any) => resolvedStatuses.includes(i.status));
			return {
				...d,
				reports_total: mine.length,
				reports_resolved: resolved.length,
				votes_cast: countFor(votesRes.rows, d.device_id),
				thanks_given: countFor(thanksRes.rows, d.device_id),
				supporters_given: countFor(supportersRes.rows, d.device_id),
				comments_posted: countFor(commentsRes.rows, d.device_id),
			};
		});
	});

// Admin-only full detail for a single report.
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
		const { rows: issueRows } = await query(
			`SELECT i.*,
        row_to_json(c.*) AS category,
        row_to_json(a.*) AS authority,
        row_to_json(r.*) AS representative,
        row_to_json(w.*) AS ward
       FROM public.issues i
       LEFT JOIN public.categories c ON c.id = i.category_id
       LEFT JOIN public.authorities a ON a.id = i.assigned_authority_id
       LEFT JOIN public.representatives r ON r.id = i.assigned_representative_id
       LEFT JOIN public.wards w ON w.id = i.ward_id
       WHERE i.id = $1`,
			[data.issue_id],
		);
		if (!issueRows.length) return null;
		const row = issueRows[0] as any;

		const [history, official, comments, votes, thanks, supporters, watchers, photos] = await Promise.all([
			query(`SELECT * FROM public.issue_status_history WHERE issue_id = $1 ORDER BY created_at ASC`, [row.id]),
			query(`SELECT * FROM public.issue_official_updates WHERE issue_id = $1 ORDER BY created_at DESC`, [row.id]),
			query(`SELECT * FROM public.issue_comments WHERE issue_id = $1 ORDER BY created_at DESC`, [row.id]),
			query(`SELECT vote FROM public.issue_votes WHERE issue_id = $1`, [row.id]),
			query(`SELECT COUNT(*) AS count FROM public.issue_thanks WHERE issue_id = $1`, [row.id]),
			query(`SELECT COUNT(*) AS count FROM public.issue_supporters WHERE issue_id = $1`, [row.id]),
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
			thanks: parseInt((thanks.rows[0] as any)?.count ?? "0", 10),
			supporters: parseInt((supporters.rows[0] as any)?.count ?? "0", 10),
			watchers: parseInt((watchers.rows[0] as any)?.count ?? "0", 10),
		};
	});

// Admin-only deeper analytics.
export const adminAnalyticsDetailFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string }) => z.object({ access_token: z.string() }).parse(d))
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		const { rows } = await query(
			`SELECT i.status, i.severity, i.visibility, i.ward_id, i.category_id,
        i.created_at, i.updated_at, i.assigned_authority_id,
        row_to_json(c.*) AS category,
        row_to_json(w.*) AS ward,
        row_to_json(a.*) AS authority
       FROM public.issues i
       LEFT JOIN public.categories c ON c.id = i.category_id
       LEFT JOIN public.wards w ON w.id = i.ward_id
       LEFT JOIN public.authorities a ON a.id = i.assigned_authority_id`,
		);
		const list = rows as any[];

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
		const { rows } = await query(
			`SELECT * FROM public.feedback ORDER BY created_at DESC`,
		);
		return rows;
	});

// Marks a feedback submission as read/unread for admin triage.
export const adminMarkFeedbackReadFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: string; read: boolean }) =>
		z.object({ access_token: z.string(), id: z.string().uuid(), read: z.boolean() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(
			`UPDATE public.feedback SET read_at = $1 WHERE id = $2`,
			[data.read ? new Date().toISOString() : null, data.id],
		);
		return { ok: true };
	});

// Deletes a feedback submission.
export const adminDeleteFeedbackFn = createServerFn({ method: "POST" })
	.inputValidator((d: { access_token: string; id: string }) =>
		z.object({ access_token: z.string(), id: z.string().uuid() }).parse(d),
	)
	.handler(async ({ data }) => {
		await requireAdmin(data.access_token);
		await query(`DELETE FROM public.feedback WHERE id = $1`, [data.id]);
		return { ok: true };
	});
