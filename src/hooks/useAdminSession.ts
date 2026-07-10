/**
 * useAdminSession — reads janfix_admin_token from localStorage,
 * verifies it via the server, and redirects to /auth if invalid.
 *
 * Returns { token, checking } so the caller can gate render.
 */
import { useEffect, useRef, useState } from "react";
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
  const navigateRef = useRef(navigate);
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Keep ref current so effect closure always has the latest navigate
  // without re-running the effect when navigate reference changes.
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    const t = getAdminToken();
    if (!t) {
      navigateRef.current({ to: "/auth" });
      return;
    }
    adminVerifyFn({ data: { token: t } })
      .then(({ valid }) => {
        if (!valid) {
          clearAdminToken();
          navigateRef.current({ to: "/auth" });
        } else {
          setToken(t);
          setChecking(false);
        }
      })
      .catch(() => {
        navigateRef.current({ to: "/auth" });
      });
  }, []); // run once on mount only

  const logout = () => {
    clearAdminToken();
    navigateRef.current({ to: "/auth" });
  };

  return { token, checking, logout };
}
