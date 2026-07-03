const KEY = "janfix_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    // Safely verify window.crypto exists to avoid ReferenceError on older/non-secure browsers
    const hasCrypto = typeof window !== "undefined" && typeof window.crypto !== "undefined";
    id = (hasCrypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDeviceName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("janfix_device_name");
}

export function setDeviceName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("janfix_device_name", name);
}
