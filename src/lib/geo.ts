import { reverseGeocodeFn, forwardGeocodeFn, type ReverseGeocodeResult } from "./geo.functions";

export type { ReverseGeocodeResult };

// Reverse/forward geocoding now runs through a server function backed by
// LocationIQ (falling back to Nominatim automatically if no key is
// configured) — see geo.functions.ts. Call signatures are unchanged so all
// existing callers keep working without modification.
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    return await reverseGeocodeFn({ data: { lat, lng } });
  } catch {
    return { address: lat.toFixed(5) + ", " + lng.toFixed(5), area: null, locality: "Mangaluru", pincode: null };
  }
}

export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 60000,
      ...options,
    });
  });
}

export async function getPositionWithFallback(): Promise<{ lat: number; lng: number }> {
  try {
    const pos = await getCurrentPosition();
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e: any) {
    if (e.code === 1) throw new Error("Location permission denied. Enable GPS and reload.");
    // Fallback to low accuracy
    const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }
}

// Haversine distance in meters
export function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function forwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number; address: string }[]> {
  try {
    return await forwardGeocodeFn({ data: { query } });
  } catch {
    return [];
  }
}

export const MANGALURU_CENTER = { lat: 12.9141, lng: 74.856 };

/**
 * Validates that a coordinates and/or address belongs to the Dakshina Kannada district.
 * Checks bounding box first, then verifies using address text blacklist to filter other regions.
 */
export function isLocationInDakshinaKannada(lat: number, lng: number, address?: string | null): boolean {
  // 1. Coordinate check for Dakshina Kannada District bounding box:
  // Latitude: ~12.45 to 13.20
  // Longitude: ~74.75 to 75.70
  const isWithinBox = lat >= 12.45 && lat <= 13.20 && lng >= 74.75 && lng <= 75.70;
  if (!isWithinBox) return false;

  // 2. Text-based verification if address is available (to block cases like Kasaragod, Bangalore, Udupi)
  if (address) {
    const addrLower = address.toLowerCase();
    const blacklist = [
      "kerala", 
      "kasaragod", 
      "kasargod", 
      "udupi", 
      "bengaluru", 
      "bangalore", 
      "kodagu", 
      "coorg", 
      "chikkamagaluru", 
      "uttara kannada",
      "mysore",
      "mysuru",
      "hassan"
    ];
    for (const item of blacklist) {
      if (addrLower.includes(item)) {
        return false;
      }
    }
  }

  return true;
}

