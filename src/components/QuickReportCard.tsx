import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { CATEGORIES, SEVERITY_META, slugify } from "@/lib/civic";
import { reverseGeocode, getPositionWithFallback, isLocationInDakshinaKannada } from "@/lib/geo";
import { computeImagePHash } from "@/lib/phash";
import { getDeviceId } from "@/lib/device";
import { supabase } from "@/integrations/supabase/client";
import { createIssueFn } from "@/lib/issues.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2, MapPin, X, ImagePlus } from "lucide-react";

const MAX_EXTRA_PHOTOS = 3;

type ReportResult = { public_id: string; slug: string };

// Compact version of the /report flow, meant to be embedded inline in the
// AI assistant chat so citizens can file a complaint without leaving the
// conversation. Mirrors the storage-upload + createIssueFn contract used by
// src/routes/report.tsx.
export function QuickReportCard({
  initialDescription,
  onReported,
  onCancel,
}: {
  initialDescription?: string;
  onReported: (result: ReportResult) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [phash, setPhash] = useState<string>("");
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [cat, setCat] = useState<string>("");
  const [sev, setSev] = useState<keyof typeof SEVERITY_META>("medium");
  const [desc, setDesc] = useState<string>(initialDescription ?? "");
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [addr, setAddr] = useState<{
    address: string;
    area: string | null;
    locality: string | null;
    pincode: string | null;
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  const safeRevokeObjectURL = (url: string | null | undefined) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Failed to revoke object URL:", url, e);
    }
  };

  const previewRef = useRef(preview);
  const extraPreviewsRef = useRef(extraPreviews);
  useEffect(() => {
    previewRef.current = preview;
    extraPreviewsRef.current = extraPreviews;
  }, [preview, extraPreviews]);

  useEffect(() => {
    return () => {
      safeRevokeObjectURL(previewRef.current);
      extraPreviewsRef.current.forEach((url) => {
        safeRevokeObjectURL(url);
      });
    };
  }, []);

  const onPickFile = async (f: File) => {
    setWorking(true);
    try {
      const compressed = await imageCompression(f, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });
      setFile(compressed);
      setPreview((prevUrl) => {
        safeRevokeObjectURL(prevUrl);
        return URL.createObjectURL(compressed);
      });
      const ph = await computeImagePHash(compressed);
      setPhash(ph);
      getGPS();
    } catch (e: any) {
      toast.error("Could not process image: " + (e?.message ?? "unknown"));
    } finally {
      setWorking(false);
    }
  };

  const onPickExtraFile = async (f: File) => {
    if (extraFiles.length >= MAX_EXTRA_PHOTOS) {
      toast.error(`Up to ${MAX_EXTRA_PHOTOS} extra photos`);
      return;
    }
    setWorking(true);
    try {
      const compressed = await imageCompression(f, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });
      setExtraFiles((prev) => [...prev, compressed]);
      setExtraPreviews((prev) => [...prev, URL.createObjectURL(compressed)]);
    } catch (e: any) {
      toast.error("Could not process image: " + (e?.message ?? "unknown"));
    } finally {
      setWorking(false);
    }
  };

  const removeExtraFile = (idx: number) => {
    safeRevokeObjectURL(extraPreviews[idx]);
    setExtraFiles((prev) => prev.filter((_, i) => i !== idx));
    setExtraPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const getGPS = async () => {
    if (gpsLoading) return;
    setGpsLoading(true);
    try {
      const pos = await getPositionWithFallback();
      const a = await reverseGeocode(pos.lat, pos.lng);
      if (!isLocationInDakshinaKannada(pos.lat, pos.lng, a.address)) {
        toast.error("Detected location is outside Dakshina Kannada district. Please report within Mangaluru / neighboring local areas.");
        return;
      }
      setLoc({ lat: pos.lat, lng: pos.lng });
      setAddr(a);
    } catch (e: any) {
      toast.error(e.message ?? "Could not get location");
    } finally {
      setGpsLoading(false);
    }
  };

  const submit = async () => {
    if (!file) return toast.error("Attach a photo first");
    if (!cat) return toast.error("Choose a category");
    if (!loc) return toast.error("Capture your location first");
    if (desc.trim().length < 5) return toast.error("Describe the issue briefly");
    setWorking(true);
    try {
      const device_id = getDeviceId();
      const path = `${device_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await supabase.storage.from("issue-photos").upload(path, file, {
        contentType: "image/jpeg",
        cacheControl: "3600",
      });
      if (up.error) throw up.error;

      const extraPaths = await Promise.all(
        extraFiles.map(async (ef, idx) => {
          const p = `${device_id}/${Date.now()}-x${idx}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const extraUp = await supabase.storage.from("issue-photos").upload(p, ef, {
            contentType: "image/jpeg",
            cacheControl: "3600",
          });
          if (extraUp.error) throw extraUp.error;
          return p;
        }),
      );

      const res = await createIssueFn({
        data: {
          device_id,
          category_slug: cat,
          description: desc.trim(),
          severity: sev,
          lat: loc.lat,
          lng: loc.lng,
          address: addr?.address ?? null,
          area: addr?.area ?? null,
          locality: addr?.locality ?? null,
          pincode: addr?.pincode ?? null,
          ward_id: null,
          image_path: path,
          image_phash: phash || null,
          extra_image_paths: extraPaths.length > 0 ? extraPaths : null,
        },
      });
      toast.success("Reported! Tracking " + res.public_id);
      onReported({ public_id: res.public_id, slug: res.slug || slugify(desc) });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">File a complaint</div>
        <button onClick={onCancel} className="text-muted-foreground transition hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!preview ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-background p-6 text-center transition hover:bg-accent/40"
        >
          <Camera className="h-6 w-6 text-primary" />
          <span className="text-xs text-muted-foreground">Attach a photo to start</span>
          {working && <Loader2 className="h-4 w-4 animate-spin" />}
        </button>
      ) : (
        <img src={preview} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />

      {preview && (
        <>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              More photos (optional)
            </div>
            <div className="flex flex-wrap gap-2">
              {extraPreviews.map((src, idx) => (
                <div key={idx} className="relative h-14 w-14 overflow-hidden rounded-lg border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExtraFile(idx)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {extraFiles.length < MAX_EXTRA_PHOTOS && (
                <button
                  type="button"
                  onClick={() => extraRef.current?.click()}
                  className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition hover:bg-accent/40"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              ref={extraRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickExtraFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => {
              const catStyle = cat === c.slug ? { background: c.color } : undefined;
              return (
                <button
                  key={c.slug}
                  onClick={() => setCat(c.slug)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    cat === c.slug ? "border-transparent text-white" : "bg-background text-muted-foreground"
                  }`}
                  style={catStyle}
                >
                  {c.name_en}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((s) => (
              <button
                key={s}
                onClick={() => setSev(s)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
                  sev === s ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground"
                }`}
              >
                {SEVERITY_META[s].label}
              </button>
            ))}
          </div>

          <Textarea
            rows={2}
            placeholder="Describe the issue briefly"
            value={desc}
            onChange={(e) => setDesc(e.target.value.slice(0, 250))}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {loc
                ? addr?.address
                  ? addr.address.split(",").slice(0, 2).join(",")
                  : `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
                : gpsLoading
                  ? "Getting location…"
                  : "No location yet"}
            </div>
            <button onClick={getGPS} disabled={gpsLoading} className="font-medium text-primary disabled:opacity-50">
              {gpsLoading ? "Getting…" : "Refresh GPS"}
            </button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={submit} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit complaint"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
