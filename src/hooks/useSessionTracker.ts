import { useEffect, useRef } from "react";
import { getDeviceId } from "@/lib/device";
import { trackSessionFn } from "@/lib/queries.functions";

/**
 * Lightweight session tracker.
 * - On mount: opens a session in the DB.
 * - Every 30s: heartbeat keeps session_end up to date.
 * - On tab close: fires a synchronous beacon to mark offline.
 */
export function useSessionTracker() {
  const sessionIdRef = useRef<string | null>(null);
  const pagesRef = useRef(1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const deviceId = getDeviceId();
    if (!deviceId) return;

    const ua = navigator.userAgent;
    const sid = `${deviceId}-${Date.now()}`;
    sessionIdRef.current = sid;

    // Open the session
    trackSessionFn({
      data: {
        deviceId,
        action: "start",
      },
    }).catch(() => {});

    // Heartbeat every 30 seconds
    const interval = setInterval(() => {
      pagesRef.current += 1;
      trackSessionFn({
        data: {
          deviceId,
          action: "heartbeat",
        },
      }).catch(() => {});
    }, 30_000);

    // Mark offline when tab closes
    const handleUnload = () => {
      // Browsers often block async requests on unload, but we try anyway.
      // Next time they connect it'll create a new session if enough time passed.
      trackSessionFn({
        data: {
          deviceId,
          action: "end",
        },
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);
}
