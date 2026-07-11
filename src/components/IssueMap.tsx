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

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
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
  loadOn?: "visible" | "tap" | "eager";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const MLRef = useRef<typeof MapLibreNS | null>(null);
  const mapRef = useRef<MapLibreNS.Map | null>(null);
  const pinMarkerRef = useRef<MapLibreNS.Marker | null>(null);
  const [shouldLoad, setShouldLoad] = useState(loadOn === "eager");
  const [ready, setReady] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Visibility lazy load
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

  // Map init
  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!ref.current || mapRef.current) return;

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
        center: [Number(c.lng), Number(c.lat)],
        zoom,
        pitch: 45,
        bearing: -12,
        attributionControl: { compact: true },
      });

      map.addControl(new ML.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("styleimagemissing", (e) => {
        const id = e.id;
        if (map.hasImage(id)) return;
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          map.addImage(id, ctx.getImageData(0, 0, 1, 1));
        }
      });

      if (onClick) {
        map.on("click", (e) => {
          onClick(e.lngLat.lat, e.lngLat.lng);
        });
      }

      map.on("load", () => {
        if (cancelled) return;

        // Add optional 3D Building Extrusions (dark theme tinted)
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
                  "fill-extrusion-color": "#1e293b",
                  "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
                  "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                  "fill-extrusion-opacity": 0.7,
                },
              } as any,
              labelLayer?.id,
            );
          }
        } catch {}

        renderMarker();
        setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [shouldLoad]);

  // ── WebGL clustered rendering for points ──────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !MLRef.current) return;
    const ML = MLRef.current;
    const map = mapRef.current;
    const pts = points ?? [];

    // Remove old cluster layers/source if they exist
    const layerIds = ["jf-clusters", "jf-cluster-count", "jf-unclustered-point", "jf-unclustered-glow"];
    layerIds.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    if (map.getSource("jf-issues")) map.removeSource("jf-issues");

    if (pts.length === 0) return;

    // Build GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pts
        .filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng))
        .map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [Number(p.lng), Number(p.lat)] },
          properties: { id: p.id, color: p.color ?? "#ef4444", popup: p.popup ?? "" },
        })),
    };

    map.addSource("jf-issues", {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Cluster circles — size + color based on point_count
    map.addLayer({
      id: "jf-clusters",
      type: "circle",
      source: "jf-issues",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step", ["get", "point_count"],
          "#22c55e",   // green < 10
          10, "#f59e0b", // amber 10-30
          30, "#ef4444", // red 30+
        ],
        "circle-radius": [
          "step", ["get", "point_count"],
          18,          // radius < 10
          10, 24,      // radius 10-30
          30, 32,      // radius 30+
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(255,255,255,0.25)",
      },
    });

    // Cluster count labels
    map.addLayer({
      id: "jf-cluster-count",
      type: "symbol",
      source: "jf-issues",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 13,
        "text-font": ["Open Sans Bold"],
      },
      paint: {
        "text-color": "#ffffff",
      },
    });

    // Unclustered point — glowing halo
    map.addLayer({
      id: "jf-unclustered-glow",
      type: "circle",
      source: "jf-issues",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 14,
        "circle-opacity": 0.2,
        "circle-blur": 1,
      },
    });

    // Unclustered point — core dot
    map.addLayer({
      id: "jf-unclustered-point",
      type: "circle",
      source: "jf-issues",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 7,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Cluster click → zoom in
    map.on("click", "jf-clusters", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["jf-clusters"] });
      if (!features.length) return;
      const clusterId = features[0].properties?.cluster_id;
      const src = map.getSource("jf-issues") as any;
      src?.getClusterExpansionZoom?.(clusterId, (err: any, zoom: number) => {
        if (!err) {
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        }
      });
    });

    // Single point click → popup
    map.on("click", "jf-unclustered-point", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["jf-unclustered-point"] });
      if (!features.length) return;
      const f = features[0];
      const coords = (f.geometry as any).coordinates.slice();
      const popupHtml = f.properties?.popup;
      if (popupHtml) {
        new ML.Popup({ offset: 12, maxWidth: "280px", className: "jf-dark-popup" })
          .setLngLat(coords)
          .setHTML(popupHtml)
          .addTo(map);
      }
    });

    // Cursor pointer on interactive layers
    map.on("mouseenter", "jf-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "jf-clusters", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "jf-unclustered-point", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "jf-unclustered-point", () => { map.getCanvas().style.cursor = ""; });
  }, [points, ready]);

  // Update center/marker
  const renderMarker = () => {
    const ML = MLRef.current;
    const map = mapRef.current;
    if (!ML || !map) return;
    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }
    if (!marker || !isFiniteNumber(marker.lat) || !isFiniteNumber(marker.lng)) return;

    // Pulsing marker element
    const el = document.createElement("div");
    el.className = "jf-pulse-marker";
    el.innerHTML = `
      <div style="width:20px;height:20px;background:#ef4444;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(239,68,68,0.6);position:relative;">
        <div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(239,68,68,0.4);animation:jf-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      </div>
    `;
    // Add animation keyframes if not present
    if (!document.getElementById("jf-pulse-style")) {
      const style = document.createElement("style");
      style.id = "jf-pulse-style";
      style.textContent = `@keyframes jf-ping{0%{transform:scale(1);opacity:1}75%,100%{transform:scale(2);opacity:0}}`;
      document.head.appendChild(style);
    }

    pinMarkerRef.current = new ML.Marker({ element: el })
      .setLngLat([marker.lng, marker.lat])
      .addTo(map);
    map.flyTo({ center: [marker.lng, marker.lat], zoom: Math.max(map.getZoom(), 16) });
  };

  useEffect(() => {
    if (ready) renderMarker();
  }, [marker, ready]);

  useEffect(() => {
    if (!ready) return;
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [fullscreen, ready]);

  useEffect(() => {
    if (typeof document === "undefined" || !fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

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
          : "w-full rounded-xl border border-border/50 bg-muted/30 relative overflow-hidden flex items-center justify-center"
      }
    >
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
      {shouldLoad && !ready && <span className="z-10 text-xs text-muted-foreground animate-pulse">Loading map…</span>}
      {ready && (
        <>
          <button
            type="button"
            onClick={toggle3D}
            className="absolute bottom-2 left-2 z-10 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-black/80"
          >
            {is3D ? "2D view" : "3D view"}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? "Exit full width view" : "View map full width"}
            className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur transition hover:bg-black/80"
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
