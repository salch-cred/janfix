/**
 * Simple admin auth — no Supabase required.
 *
 * The server signs a token with HMAC-SHA256 using ADMIN_JWT_SECRET.
 * The client stores it in localStorage under "janfix_admin_token".
 * All admin server functions verify this token instead of calling Supabase.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = "v1";

// ── Token helpers ─────────────────────────────────────────────────────────────

function getSecret(): string {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("ADMIN_JWT_SECRET env var is not set");
  return s;
}

export function signAdminToken(email: string): string {
  const payload = `${TOKEN_VERSION}:${email}:${Date.now()}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split(":");
    // parts: [version, email, timestamp, sig]
    if (parts.length !== 4) return false;
    const [version, email, ts, sig] = parts;
    if (version !== TOKEN_VERSION) return false;
    // Token valid for 30 days
    if (Date.now() - parseInt(ts, 10) > 30 * 24 * 60 * 60 * 1000) return false;
    const payload = `${version}:${email}:${ts}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ── Server functions ──────────────────────────────────────────────────────────

export const adminLoginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error("Admin credentials not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.");
    }

    const emailOk = data.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const passOk = data.password === ADMIN_PASSWORD;

    if (!emailOk || !passOk) {
      throw new Error("Invalid email or password.");
    }

    return { token: signAdminToken(data.email) };
  });

export const adminVerifyFn = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return { valid: verifyAdminToken(data.token) };
  });
