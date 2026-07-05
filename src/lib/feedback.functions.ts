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
    const c = sb();
    const { error } = await c.from("feedback").insert({
      name: data.name?.trim() || null,
      email: data.email?.trim() || null,
      message: data.message.trim(),
      device_id: data.device_id || null,
      page_url: data.page_url || null,
    });
    if (error) throw error;
    return { ok: true };
  });
