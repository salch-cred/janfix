import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ReverseGeocodeResult = {
  address: string;
  area: string | null;
  locality: string | null;
  pincode: string | null;
};

const LOCATIONIQ_REVERSE_BASE = "https://us1.locationiq.com/v1/reverse";
const LOCATIONIQ_SEARCH_BASE = "https://us1.locationiq.com/v1/search";
const NOMINATIM_REVERSE_BASE = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_BASE = "https://nominatim.openstreetmap.org/search";

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "JanFixMangaluru/1.0 (civic-accountability-platform)",
};

// LocationIQ is a free-tier-friendly upgrade over raw Nominatim (5,000
// requests/day free, no credit card needed) with better locality/postal
// matching for small Indian hamlets and villages. Add LOCATIONIQ_API_KEY
// (from locationiq.com, free signup) to the project's environment variables
// to enable it. Without a key, this transparently falls back to Nominatim so
// the app keeps working exactly as before.
export const reverseGeocodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lng: number }) =>
    z.object({ lat: z.number(), lng: z.number() }).parse(d),
  )
  .handler(async ({ data }): Promise<ReverseGeocodeResult> => {
    const { lat, lng } = data;
    const apiKey = process.env.LOCATIONIQ_API_KEY;

    if (apiKey) {
      try {
        const url =
          LOCATIONIQ_REVERSE_BASE +
          "?key=" + apiKey +
          "&lat=" + lat + "&lon=" + lng +
          "&format=json&zoom=18&addressdetails=1";
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const json: any = await res.json();
          const a = json.address ?? {};
          return {
            address: json.display_name ?? "",
            area: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.village ?? null,
            locality: a.city ?? a.town ?? a.village ?? a.county ?? null,
            pincode: a.postcode ?? null,
          };
        }
        console.error("LocationIQ reverse geocode failed", res.status, await res.text().catch(() => ""));
      } catch (e) {
        console.error("LocationIQ reverse geocode error", e);
      }
    }

    // Fallback: Nominatim (used when no LOCATIONIQ_API_KEY is set, or LocationIQ errored)
    try {
      const url =
        NOMINATIM_REVERSE_BASE + "?format=jsonv2&lat=" + lat + "&lon=" + lng + "&zoom=18&addressdetails=1";
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("geocode failed");
      const json: any = await res.json();
      const a = json.address ?? {};
      return {
        address: json.display_name ?? "",
        area: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.village ?? null,
        locality: a.city ?? a.town ?? a.village ?? a.county ?? null,
        pincode: a.postcode ?? null,
      };
    } catch {
      try {
        const url =
          NOMINATIM_REVERSE_BASE + "?format=jsonv2&lat=" + lat + "&lon=" + lng + "&zoom=14&addressdetails=1";
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error("geocode fallback failed");
        const json: any = await res.json();
        const a = json.address ?? {};
        return {
          address: json.display_name ?? "",
          area: a.city_district ?? a.municipality ?? a.county ?? null,
          locality: a.city ?? a.town ?? a.village ?? null,
          pincode: a.postcode ?? null,
        };
      } catch {
        return {
          address: lat.toFixed(5) + ", " + lng.toFixed(5),
          area: null,
          locality: "Mangaluru",
          pincode: null,
        };
      }
    }
  });

export const forwardGeocodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => z.object({ query: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ lat: number; lng: number; address: string }[]> => {
    const { query } = data;
    const apiKey = process.env.LOCATIONIQ_API_KEY;

    if (apiKey) {
      try {
        const url =
          LOCATIONIQ_SEARCH_BASE +
          "?key=" + apiKey +
          "&q=" + encodeURIComponent(query) +
          "&format=json&limit=5&addressdetails=1";
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const results: any[] = await res.json();
          return results.map((d: any) => ({
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            address: d.display_name,
          }));
        }
        console.error("LocationIQ search failed", res.status, await res.text().catch(() => ""));
      } catch (e) {
        console.error("LocationIQ search error", e);
      }
    }

    try {
      const url =
        NOMINATIM_SEARCH_BASE + "?format=jsonv2&q=" + encodeURIComponent(query) + "&limit=5&addressdetails=1";
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("search failed");
      const results: any[] = await res.json();
      return results.map((d: any) => ({
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        address: d.display_name,
      }));
    } catch {
      return [];
    }
  });
