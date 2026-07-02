import { useEffect, useRef, useState } from "react";
import type * as MapLibreNS from "maplibre-gl";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  popup?: string;
};

// OpenFreeMap: fully free vector-tile hosting, no API key, no request limits.
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const MAPLIBRE_CSS_URL = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
const BUILDINGS_LAYER_ID = "jf-3d-buildings";

function isFiniteNumber(n: unknown): n is number {
  const v = typeof n === "string" ? Number(n) : n;
  return typeof v === "number" && Number.isFinite(v);
}

export function IssueMap({
  points,
  center,
  zoom = 12,
  height = 360,
  onClick,
  marker,
  loadOn = "visible",
}: {
  points?: MapPoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  onClick?: (lat: number, lng: number) => void;
  marker?: { lat: number; lng: number } | null;
  /** "visible" = lazy-init via IntersectionObserver, "tap" = wait for user tap, "eager" = init immediately */
  loadOn?: "visible" | "tap" | "eager";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const MLRef = useRef<typeof MapLibreNS | null>(null);
  const mapRef = useRef<MapLibreNS.Map | null>(null);
  const pointMarkersRef = useRef<MapLibreNS.Marker[]>([]);
  const pinMarkerRef = useRef<MapLibreNS.Marker | null>(null);
  const [shouldLoad, setShouldLoad] = useState(loadOn === "eager");
  const [ready, setReady] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const containerStyle = { height };

  // Visibility-based lazy trigger
  useEffect(() => {
    if (shouldLoad || loadOn !== "visible") return;
    if (typeof window === "undefined" || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoad, loadOn]);

  // Map init (only after shouldLoad)
  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!ref.current || mapRef.current) return;
      // Inject MapLibre CSS lazily, once
      if (!document.getElementById("maplibre-css")) {
        const link = document.createElement("link");
        link.id = "maplibre-css";
        link.rel = "stylesheet";
        link.href = MAPLIBRE_CSS_URL;
        document.head.appendChild(link);
      }
      const ML = await import("maplibre-gl");
      if (cancelled || !ref.current) return;
      MLRef.current = ML;
      const c = center ?? { lat: 12.9141, lng: 74.856 };
      const map = new ML.Map({
        container: ref.current,
        style: MAP_STYLE_URL,
        center: [c.lng, c.lat],
        zoom,
        pitch: 45,
        bearing: -12,
        attributionControl: { compact: true },
      });
      map.addControl(new ML.NavigationControl({ visualizePitch: true }), "top-right");
      if (onClick) map.on("click", (e) => onClick(e.lngLat.lat, e.lngLat.lng));
      map.on("load", () => {
        if (cancelled) return;
        try {
          const style = map.getStyle() as any;
          const sourceId = Object.keys(style?.sources ?? {}).find(
            (id) => style.sources[id]?.type === "vector",
          );
          if (sourceId && !map.getLayer(BUILDINGS_LAYER_ID)) {
            const labelLayer = (style?.layers ?? []).find(
              (l: any) => l.type === "symbol" && l.layout?.["text-field"],
            );
            map.addLayer(
              {
                id: BUILDINGS_LAYER_ID,
                source: sourceId,
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 13,
                paint: {
                  "fill-extrusion-color": "#c9d2dc",
                  "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
                  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                  "fill-extrusion-opacity": 0.85,
                },
              } as any,
              labelLayer?.id,
            );
          }
        } catch {
          // 3D buildings are a visual enhancement only; ignore failures so the
          // base map still works even if this style doesn't expose the layer.
        }
        renderPoints();
        renderMarker();
        setReady(true);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      pointMarkersRef.current.forEach((m) => m.remove());
      pointMarkersRef.current = [];
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad]);

  const renderPoints = () => {
    const ML = MLRef.current;
    const map = mapRef.current;
    if (!ML || !map) return;
    pointMarkersRef.current.forEach((m) => m.remove());
    pointMarkersRef.current = [];
    (points ?? []).forEach((p) => {
      if (!isFiniteNumber(p.lat) || !isFiniteNumber(p.lng)) return;
      const color = p.color ?? "#1d4ed8";
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "9999px";
      el.style.background = color;
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 0 1px rgba(0,0,0,.25)";
      el.style.cursor = p.popup ? "pointer" : "default";
      const m = new ML.Marker({ element: el }).setLngLat([Number(p.lng), Number(p.lat)]);
      if (p.popup) m.setPopup(new ML.Popup({ offset: 12 }).setHTML(p.popup));
      m.addTo(map);
      pointMarkersRef.current.push(m);
    });
  };

  const renderMarker = () => {
    const ML = MLRef.current;
    const map = mapRef.current;
    if (!ML || !map) return;
    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }
    if (!marker || !isFiniteNumber(marker.lat) || !isFiniteNumber(marker.lng)) return;
    pinMarkerRef.current = new ML.Marker({ color: "#1d4ed8" })
      .setLngLat([marker.lng, marker.lat])
      .addTo(map);
    map.flyTo({ center: [marker.lng, marker.lat], zoom: Math.max(map.getZoom(), 16) });
  };

  useEffect(() => {
    if (ready) renderPoints(); /* eslint-disable-next-line */
  }, [points, ready]);
  useEffect(() => {
    if (ready) renderMarker(); /* eslint-disable-next-line */
  }, [marker, ready]);

  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.easeTo({ pitch: next ? 45 : 0, bearing: next ? -12 : 0, duration: 500 });
  };

  return (
    <div
      ref={ref}
      style={containerStyle}
      className="w-full rounded-xl border bg-muted/30 relative overflow-hidden flex items-center justify-center"
    >
      {!shouldLoad && loadOn === "tap" && (
        <button
          type="button"
          onClick={() => setShouldLoad(true)}
          className="absolute inset-0 flex items-center justify-center text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          Tap to load map
        </button>
      )}
      {!shouldLoad && loadOn === "visible" && (
        <span className="text-xs text-muted-foreground">Loading map…</span>
      )}
      {shouldLoad && !ready && <span className="text-xs text-muted-foreground">Loading map…</span>}
      {ready && (
        <button
          type="button"
          onClick={toggle3D}
          className="absolute bottom-2 left-2 z-10 rounded-full border bg-card/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition hover:bg-accent"
        >
          {is3D ? "2D view" : "3D view"}
        </button>
      )}
    </div>
  );
}
