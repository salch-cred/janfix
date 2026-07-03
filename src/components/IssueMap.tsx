import { useEffect, useRef, useState } from "react";
import type * as MapLibreNS from "maplibre-gl";
import { Maximize2, Minimize2 } from "lucide-react";

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

// Classic teardrop "pin point" marker icon, anchored at its bottom tip so it
// points exactly at the report's coordinates. Color is per-category.
function pinSvg(color: string) {
  return `<svg width="26" height="34" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))"><path d="M12 0C5.373 0 0 5.373 0 12c0 8.5 10.2 18.6 11.3 19.6a1 1 0 0 0 1.4 0C13.8 30.6 24 20.5 24 12c0-6.627-5.373-12-12-12z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="white"/></svg>`;
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
  const [fullscreen, setFullscreen] = useState(false);

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
      el.style.width = "26px";
      el.style.height = "34px";
      el.style.cursor = p.popup ? "pointer" : "default";
      el.innerHTML = pinSvg(color);
      const m = new ML.Marker({ element: el, anchor: "bottom" }).setLngLat([Number(p.lng), Number(p.lat)]);
      if (p.popup) m.setPopup(new ML.Popup({ offset: 30, maxWidth: "240px" }).setHTML(p.popup));
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

  // MapLibre doesn't observe container resizes automatically, so nudge it
  // whenever the fullscreen state flips the container's dimensions.
  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [fullscreen, ready]);

  // Lock page scroll while viewing the map full width/height.
  useEffect(() => {
    if (typeof document === "undefined" || !fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // Let Escape close the full width view.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.easeTo({ pitch: next ? 45 : 0, bearing: next ? -12 : 0, duration: 500 });
  };

  return (
    <div
      style={fullscreen ? undefined : { height }}
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
          : "w-full rounded-xl border bg-muted/30 relative overflow-hidden flex items-center justify-center"
      }
    >
      {/* Nested MapLibre container to isolate MapLibre DOM updates from React reconciliation */}
      <div ref={ref} className="absolute inset-0 h-full w-full" />

      {!shouldLoad && loadOn === "tap" && (
        <button
          type="button"
          onClick={() => setShouldLoad(true)}
          className="absolute inset-0 z-10 flex items-center justify-center text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          Tap to load map
        </button>
      )}
      {!shouldLoad && loadOn === "visible" && (
        <span className="z-10 text-xs text-muted-foreground">Loading map…</span>
      )}
      {shouldLoad && !ready && <span className="z-10 text-xs text-muted-foreground">Loading map…</span>}
      {ready && (
        <>
          <button
            type="button"
            onClick={toggle3D}
            className="absolute bottom-2 left-2 z-10 rounded-full border bg-card/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition hover:bg-accent"
          >
            {is3D ? "2D view" : "3D view"}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? "Exit full width view" : "View map full width"}
            className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full border bg-card/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition hover:bg-accent"
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            {fullscreen ? "Close" : "Full width"}
          </button>
        </>
      )}
    </div>
  );
}
