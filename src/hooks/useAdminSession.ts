/**
 * useAdminSession — reads janfix_admin_token from localStorage,
 * verifies it via the server, and redirects to /auth if invalid.
 *
 * Returns { token, checking } so the caller can gate render.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { adminVerifyFn } from "@/lib/admin.auth";

export const ADMIN_TOKEN_KEY = "janfix_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

export function setAdminToken(token: string) {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {}
}

export function useAdminSession() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const t = getAdminToken();
    if (!t) {
      navigate({ to: "/auth" });
      return;
    }
    adminVerifyFn({ data: { token: t } })
      .then(({ valid }) => {
        if (!valid) {
          clearAdminToken();
          navigate({ to: "/auth" });
        } else {
          setToken(t);
          setChecking(false);
        }
      })
      .catch(() => {
        navigate({ to: "/auth" });
      });
  }, [navigate]);

  const logout = () => {
    clearAdminToken();
    navigate({ to: "/auth" });
  };

  return { token, checking, logout };
}
