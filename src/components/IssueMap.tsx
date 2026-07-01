import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  popup?: string;
};

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
  const LRef = useRef<typeof LeafletNS | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const layerRef = useRef<LeafletNS.LayerGroup | null>(null);
  const draggableMarker = useRef<LeafletNS.Marker | null>(null);
  const [shouldLoad, setShouldLoad] = useState(loadOn === "eager");
  const [ready, setReady] = useState(false);

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
      // Inject Leaflet CSS lazily, once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      LRef.current = L;
      const c = center ?? { lat: 12.9141, lng: 74.856 };
      const map = L.map(ref.current, { zoomControl: true }).setView([c.lat, c.lng], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      if (onClick) map.on("click", (e) => onClick(e.latlng.lat, e.latlng.lng));
      renderPoints();
      renderMarker();
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoad]);

  const renderPoints = () => {
    const L = LRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    (points ?? []).forEach((p) => {
      const color = p.color ?? "#1d4ed8";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(layer);
      if (p.popup) m.bindPopup(p.popup);
    });
  };

  const renderMarker = () => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !marker) return;
    if (draggableMarker.current) draggableMarker.current.remove();
    draggableMarker.current = L.marker([marker.lat, marker.lng]).addTo(map);
    map.setView([marker.lat, marker.lng], Math.max(map.getZoom(), 16));
  };

  useEffect(() => {
    if (ready) renderPoints(); /* eslint-disable-next-line */
  }, [points, ready]);
  useEffect(() => {
    if (ready) renderMarker(); /* eslint-disable-next-line */
  }, [marker, ready]);

  return (
    <div
      ref={ref}
      style={{ height }}
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
    </div>
  );
}
