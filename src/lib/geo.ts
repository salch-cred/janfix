export type ReverseGeocodeResult = {
  address: string;
  area: string | null;
  locality: string | null;
  pincode: string | null;
};

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "JanFixMangaluru/1.0 (civic-accountability-platform)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("geocode failed");
    const data: any = await res.json();
    const a = data.address ?? {};
    return {
      address: data.display_name ?? "",
      area: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.village ?? null,
      locality: a.city ?? a.town ?? a.village ?? a.county ?? null,
      pincode: a.postcode ?? null,
    };
  } catch {
    try {
      // Fallback: try with lower zoom
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "JanFixMangaluru/1.0 (civic-accountability-platform)",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error("geocode fallback failed");
      const data: any = await res.json();
      const a = data.address ?? {};
      return {
        address: data.display_name ?? "",
        area: a.city_district ?? a.municipality ?? a.county ?? null,
        locality: a.city ?? a.town ?? a.village ?? null,
        pincode: a.postcode ?? null,
      };
    } catch {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, area: null, locality: "Mangaluru", pincode: null };
    }
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
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "JanFixMangaluru/1.0 (civic-accountability-platform)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("search failed");
    const data: any[] = await res.json();
    return data.map((d) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      address: d.display_name,
    }));
  } catch {
    return [];
  }
}

export const MANGALURU_CENTER = { lat: 12.9141, lng: 74.856 };
