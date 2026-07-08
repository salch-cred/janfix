import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { query } from "@/lib/db";

// Citizen-facing feedback submission (footer form). No login required --
// mirrors the rest of JanFix's anonymous, device-id-based model. Submitted
// feedback is only ever visible to admins/moderators via adminListFeedbackFn.
export const submitFeedbackFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name?: string | null;
      email?: string | null;
      message: string;
      device_id?: string | null;
      page_url?: string | null;
    }) =>
      z
        .object({
          name: z.string().max(120).nullable().optional(),
          email: z.string().max(200).nullable().optional(),
          message: z
            .string()
            .trim()
            .min(2, "Please write a bit more")
            .max(2000),
          device_id: z.string().max(200).nullable().optional(),
          page_url: z.string().max(500).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await query(
      `INSERT INTO public.feedback (name, email, message, device_id, page_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.name?.trim() || null,
        data.email?.trim() || null,
        data.message.trim(),
        data.device_id || null,
        data.page_url || null,
      ],
    );
    return { ok: true };
  });
