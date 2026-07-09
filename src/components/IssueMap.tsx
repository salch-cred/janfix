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

  // Build GeoJSON features
  const buildGeoJson = (pts: MapPoint[] | undefined) => {
    return {
      type: "FeatureCollection",
      features: (pts ?? [])
        .filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng))
        .map((p) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [Number(p.lng), Number(p.lat)],
          },
          properties: {
            id: p.id,
            color: p.color ?? "#1a5d2b",
            popup: p.popup,
          },
        })),
    };
  };

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
        center: [c.lng, c.lat],
        zoom,
        pitch: 45,
        bearing: -12,
        attributionControl: { compact: true },
      });

      map.addControl(new ML.NavigationControl({ visualizePitch: true }), "top-right");

      if (onClick) {
        map.on("click", (e) => {
          // If clicked a cluster or point, do not fire map click coordinates
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["clusters", "unclustered-point"],
          });
          if (features.length === 0) {
            onClick(e.lngLat.lat, e.lngLat.lng);
          }
        });
      }

      map.on("load", () => {
        if (cancelled) return;

        // Add GeoJSON source with clustering enabled
        map.addSource("issues-source", {
          type: "geojson",
          data: buildGeoJson(points) as any,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // Layer 1: Clusters Circle (visual coloring by size)
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "issues-source",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#16a34a", // green for small clusters < 10
              10,
              "#e4ac12", // yellow for medium clusters < 30
              30,
              "#dc2626", // red for large clusters >= 30
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              10,
              24,
              30,
              30,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Layer 2: Cluster count label text
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "issues-source",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count}",
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        // Layer 3: Unclustered individual points
        map.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "issues-source",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["coalesce", ["get", "color"], "#1a5d2b"],
            "circle-radius": 9,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Click on cluster - expand zoom
        map.on("click", "clusters", async (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          const clusterId = features[0].properties.cluster_id;
          const source = map.getSource("issues-source") as any;
          const expansionZoom = await source.getClusterExpansionZoom(clusterId);
          
          map.easeTo({
            center: (features[0].geometry as any).coordinates,
            zoom: expansionZoom,
          });
        });

        // Click on single point - open Popup
        map.on("click", "unclustered-point", (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const coordinates = (feat.geometry as any).coordinates.slice();
          const properties = feat.properties;

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          if (properties.popup) {
            new ML.Popup({ offset: 10, maxWidth: "280px" })
              .setLngLat(coordinates)
              .setHTML(properties.popup)
              .addTo(map);
          }
        });

        // Change cursor over interactive elements
        map.on("mouseenter", "clusters", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "clusters", () => { map.getCanvas().style.cursor = ""; });
        map.on("mouseenter", "unclustered-point", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "unclustered-point", () => { map.getCanvas().style.cursor = ""; });

        // Add optional 3D Building Extrusions
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

  // Update source points when prop changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const source = mapRef.current.getSource("issues-source") as any;
    if (source) {
      source.setData(buildGeoJson(points));
    }
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
    pinMarkerRef.current = new ML.Marker({ color: "#1a5d2b" })
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
          : "w-full rounded-xl border bg-muted/30 relative overflow-hidden flex items-center justify-center"
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
