const KEY = "janfix_device_id";

// Fallback in-memory store in case localStorage is blocked/restricted in the browser (e.g. private tabs, WebViews)
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (e) {
    console.warn("LocalStorage access failed/blocked. Falling back to memory store.", e);
  }
  return memoryStore[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (e) {
    console.warn("LocalStorage write failed/blocked. Storing in memory fallback.", e);
  }
  memoryStore[key] = value;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = safeGetItem(KEY);
  if (!id) {
    const hasCrypto = typeof window !== "undefined" && typeof window.crypto !== "undefined";
    id = (hasCrypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    safeSetItem(KEY, id);
  }
  return id;
}

export function getDeviceName(): string | null {
  if (typeof window === "undefined") return null;
  return safeGetItem("janfix_device_name");
}

export function setDeviceName(name: string) {
  if (typeof window === "undefined") return;
  safeSetItem("janfix_device_name", name);
}
